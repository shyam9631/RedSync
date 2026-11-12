"""Blood stock rules in one place, so every screen and the donation form change stock the same way.

BloodStock.units is the total per blood group (the public site and both dashboards read it).
StockBatch rows describe what the total is made of. StockLedger records every change.
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BloodStock, Hospital
from app.models_more import StockBatch, StockLedger
from app.utils import BLOOD_GROUPS

# Usual shelf life in days when the hospital does not give an expiry date.
SHELF_DAYS = {"Whole Blood": 35, "Packed Red Cells": 42, "Platelets": 5, "Plasma": 365}
DEFAULT_TARGET = 40
EXPIRY_WARNING_HOURS = 72


def stock_rows(db: Session, hospital_id: int) -> dict:
    """The 8 BloodStock rows of a hospital, created when missing."""
    rows = {s.blood_group: s for s in db.scalars(select(BloodStock).where(BloodStock.hospital_id == hospital_id))}
    for group in BLOOD_GROUPS:
        if group not in rows:
            row = BloodStock(hospital_id=hospital_id, blood_group=group, units=0)
            db.add(row)
            rows[group] = row
    db.flush()
    return rows


def default_expiry(component: str, start: Optional[date] = None) -> date:
    return (start or date.today()) + timedelta(days=SHELF_DAYS.get(component, 35))


def batches(db: Session, hospital_id: int, group: str, component: Optional[str] = None) -> list:
    query = select(StockBatch).where(
        StockBatch.hospital_id == hospital_id,
        StockBatch.blood_group == group,
        StockBatch.units_remaining > 0,
    )
    if component:
        query = query.where(StockBatch.component == component)
    return list(db.scalars(query.order_by(StockBatch.expiry_date, StockBatch.id)))


def unbatched(db: Session, hospital_id: int, group: str, total: int) -> int:
    """Units counted in the total that no batch accounts for (entered before batches existed)."""
    held = db.scalar(
        select(func.coalesce(func.sum(StockBatch.units_remaining), 0)).where(
            StockBatch.hospital_id == hospital_id, StockBatch.blood_group == group
        )
    )
    return max(0, total - int(held or 0))


def _ledger(db, hospital, group, component, kind, delta, balance, reason, batch_code, note, staff):
    db.add(
        StockLedger(
            hospital_id=hospital.id,
            blood_group=group,
            component=component,
            kind=kind,
            delta=delta,
            balance_after=balance,
            reason=reason[:80],
            batch_code=batch_code,
            note=(note or None) and note[:300],
            recorded_by=staff[:120],
        )
    )


def inward(
    db: Session,
    hospital: Hospital,
    group: str,
    component: str,
    units: int,
    expiry: date,
    *,
    reason: str,
    staff: str,
    batch_code: Optional[str] = None,
    storage: Optional[str] = None,
    source: str = "manual",
    note: Optional[str] = None,
) -> StockBatch:
    """Adds units to the stock as a new batch. The caller commits."""
    row = stock_rows(db, hospital.id)[group]
    batch = StockBatch(
        hospital_id=hospital.id,
        blood_group=group,
        component=component,
        units_received=units,
        units_remaining=units,
        expiry_date=expiry,
        batch_code=batch_code or None,
        storage=storage or None,
        source=source,
    )
    db.add(batch)
    row.units += units
    _ledger(db, hospital, group, component, "inward", units, row.units, reason, batch_code, note, staff)
    return batch


def remove(
    db: Session,
    hospital: Hospital,
    group: str,
    component: str,
    units: int,
    kind: str,
    *,
    reason: str,
    staff: str,
    note: Optional[str] = None,
) -> None:
    """Takes units out (issued, discarded). Oldest expiry first. The caller commits.

    Issuing never uses expired units. Discarding can. Units that were entered before batches
    existed ("not specified") can cover the rest, so old data keeps working.
    """
    row = stock_rows(db, hospital.id)[group]
    today = date.today()
    pool = [b for b in batches(db, hospital.id, group, component) if kind == "discard" or b.expiry_date >= today]
    in_batches = sum(b.units_remaining for b in pool)
    legacy = unbatched(db, hospital.id, group, row.units)
    available = min(row.units, in_batches + legacy)
    if units > available:
        what = "usable " if kind == "outward" else ""
        raise HTTPException(
            400,
            f"Only {available} {what}unit{'' if available == 1 else 's'} of {component} {group} "
            f"{'is' if available == 1 else 'are'} in stock.",
        )

    left = units
    codes = []
    for b in pool:
        if left == 0:
            break
        take = min(b.units_remaining, left)
        b.units_remaining -= take
        left -= take
        if b.batch_code:
            codes.append(b.batch_code)
    row.units -= units  # whatever is left over came from the "not specified" units
    _ledger(
        db, hospital, group, component, kind, -units, row.units, reason,
        ", ".join(dict.fromkeys(codes))[:50] or None, note, staff,
    )


def set_total(db: Session, hospital: Hospital, group: str, new_total: int, *, staff: str, note: Optional[str] = None) -> None:
    """The older "set the total to N" action. Keeps batches consistent with the new total."""
    row = stock_rows(db, hospital.id)[group]
    delta = new_total - row.units
    if delta == 0:
        return
    if delta < 0:
        need = -delta
        need -= min(need, unbatched(db, hospital.id, group, row.units))  # not-specified units go first
        for b in reversed(batches(db, hospital.id, group)):  # then the batch that expires last
            if need == 0:
                break
            take = min(b.units_remaining, need)
            b.units_remaining -= take
            need -= take
    row.units = new_total
    _ledger(db, hospital, group, None, "adjust", delta, new_total, "Total corrected", None, note, staff)