from datetime import date, datetime, time, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas_more as sm
from app import stock_ops
from app.database import get_db
from app.deps import current_hospital
from app.models import Hospital
from app.models_more import StockBatch, StockLedger, StockTarget
from app.schemas import Component
from app.utils import BLOOD_GROUPS, iso, log_activity, plural, stock_status

router = APIRouter(prefix="/hospital/stock", tags=["Hospital stock"])

COMPONENTS = ["Whole Blood", "Packed Red Cells", "Platelets", "Plasma"]


def _staff(hospital: Hospital) -> str:
    return hospital.contact_name or hospital.name


def _hours_left(expiry: date, now: datetime) -> int:
    """Hours until the end of the expiry day."""
    end = datetime.combine(expiry + timedelta(days=1), time.min)
    return int((end - now).total_seconds() // 3600)


def _ledger_out(r: StockLedger) -> dict:
    return {
        "id": r.id,
        "created_at": iso(r.created_at),
        "blood_group": r.blood_group,
        "component": r.component,
        "kind": r.kind,
        "delta": r.delta,
        "balance_after": r.balance_after,
        "reason": r.reason,
        "batch_code": r.batch_code,
        "note": r.note,
        "recorded_by": r.recorded_by,
    }


def _batch_out(b: StockBatch, now: datetime) -> dict:
    return {
        "id": b.id,
        "blood_group": b.blood_group,
        "component": b.component,
        "units": b.units_remaining,
        "expiry_date": b.expiry_date,
        "hours_left": _hours_left(b.expiry_date, now),
        "batch_code": b.batch_code,
        "storage": b.storage,
    }


@router.get("/overview")
def overview(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    now = datetime.now()
    today = date.today()
    rows = stock_ops.stock_rows(db, hospital.id)
    db.commit()

    targets = {t.blood_group: t.target_units for t in db.scalars(select(StockTarget).where(StockTarget.hospital_id == hospital.id))}
    live = list(
        db.scalars(
            select(StockBatch)
            .where(StockBatch.hospital_id == hospital.id, StockBatch.units_remaining > 0)
            .order_by(StockBatch.expiry_date, StockBatch.id)
        )
    )
    last_inward = {
        g: t
        for g, t in db.execute(
            select(StockLedger.blood_group, func.max(StockLedger.created_at))
            .where(StockLedger.hospital_id == hospital.id, StockLedger.kind == "inward")
            .group_by(StockLedger.blood_group)
        ).all()
    }

    groups, comp_totals = [], {c: 0 for c in COMPONENTS}
    unspecified_total = 0
    expiring, expired = [], []
    for b in live:
        item = _batch_out(b, now)
        if b.expiry_date < today:
            expired.append(item)
        elif item["hours_left"] <= stock_ops.EXPIRY_WARNING_HOURS:
            expiring.append(item)

    for g in BLOOD_GROUPS:
        row = rows[g]
        mine = [b for b in live if b.blood_group == g]
        parts = {c: sum(b.units_remaining for b in mine if b.component == c) for c in COMPONENTS}
        loose = stock_ops.unbatched(db, hospital.id, g, row.units)
        for c, n in parts.items():
            comp_totals[c] += n
        unspecified_total += loose
        target = targets.get(g, stock_ops.DEFAULT_TARGET)
        groups.append(
            {
                "group": g,
                "units": row.units,
                "status": stock_status(row.units),
                "target": target,
                "percent": round(row.units / target * 100) if target else 0,
                "components": parts,
                "unspecified": loose,
                "expired_units": sum(b.units_remaining for b in mine if b.expiry_date < today),
                "expiring_units": sum(
                    b.units_remaining
                    for b in mine
                    if b.expiry_date >= today and _hours_left(b.expiry_date, now) <= stock_ops.EXPIRY_WARNING_HOURS
                ),
                "last_inward": iso(last_inward.get(g)),
            }
        )

    total = sum(r["units"] for r in groups)
    total_target = sum(r["target"] for r in groups)
    recent = db.scalars(
        select(StockLedger).where(StockLedger.hospital_id == hospital.id).order_by(StockLedger.id.desc()).limit(8)
    ).all()
    month_start = datetime(today.year, today.month, 1)
    month_count = db.scalar(
        select(func.count(StockLedger.id)).where(StockLedger.hospital_id == hospital.id, StockLedger.created_at >= month_start)
    )
    moved = {
        kind: abs(int(n or 0))
        for kind, n in db.execute(
            select(StockLedger.kind, func.sum(StockLedger.delta))
            .where(StockLedger.hospital_id == hospital.id, StockLedger.created_at >= month_start, StockLedger.kind != "adjust")
            .group_by(StockLedger.kind)
        ).all()
    }
    return {
        "hospital": {"name": hospital.name, "facility_code": hospital.facility_code},
        "month": {"inward": moved.get("inward", 0), "outward": moved.get("outward", 0), "discard": moved.get("discard", 0)},
        "summary": {
            "total_units": total,
            "total_target": total_target,
            "percent": round(total / total_target * 100) if total_target else 0,
            "components": comp_totals,
            "unspecified": unspecified_total,
            "low_count": sum(1 for r in groups if r["status"] == "low"),
            "critical_count": sum(1 for r in groups if r["status"] == "critical"),
            "expiring_units": sum(b["units"] for b in expiring),
            "expired_units": sum(b["units"] for b in expired),
        },
        "groups": groups,
        "expiring": expiring,
        "expired": expired,
        "shelf_days": stock_ops.SHELF_DAYS,
        "ledger_recent": [_ledger_out(r) for r in recent],
        "ledger_month_count": int(month_count or 0),
    }


@router.get("/ledger")
def ledger(
    kind: Optional[Literal["inward", "outward", "discard", "adjust"]] = None,
    group: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    query = select(StockLedger).where(StockLedger.hospital_id == hospital.id)
    if kind:
        query = query.where(StockLedger.kind == kind)
    if group:
        if group not in BLOOD_GROUPS:
            raise HTTPException(400, "Unknown blood group.")
        query = query.where(StockLedger.blood_group == group)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(StockLedger.id.desc()).offset(offset).limit(limit)).all()
    return {"total": int(total or 0), "items": [_ledger_out(r) for r in rows]}


@router.post("/inward", status_code=201)
def add_inward(body: sm.StockInwardIn, hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    stock_ops.inward(
        db, hospital, body.blood_group, body.component, body.units, body.expiry_date,
        reason=body.reason, staff=_staff(hospital), batch_code=body.batch_code, storage=body.storage, note=body.note,
    )
    log_activity(db, hospital.id, "add_circle", "good", f"Stock in: {body.units} unit{plural(body.units)} {body.blood_group} {body.component}")
    db.commit()
    return {"ok": True}


@router.post("/outward")
def add_outward(body: sm.StockOutwardIn, hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    stock_ops.remove(
        db, hospital, body.blood_group, body.component, body.units, "outward",
        reason=body.reason, staff=_staff(hospital), note=body.note,
    )
    log_activity(db, hospital.id, "send", "neutral", f"Stock out: {body.units} unit{plural(body.units)} {body.blood_group} {body.component}")
    db.commit()
    return {"ok": True}


@router.post("/discard")
def add_discard(body: sm.StockDiscardIn, hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    stock_ops.remove(
        db, hospital, body.blood_group, body.component, body.units, "discard",
        reason=body.reason, staff=_staff(hospital), note=body.note,
    )
    log_activity(db, hospital.id, "delete", "bad", f"Discarded: {body.units} unit{plural(body.units)} {body.blood_group} {body.component} ({body.reason})")
    db.commit()
    return {"ok": True}


@router.post("/discard-expired")
def discard_expired(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    """Removes every unit whose expiry date has passed."""
    today = date.today()
    expired = db.scalars(
        select(StockBatch).where(
            StockBatch.hospital_id == hospital.id, StockBatch.units_remaining > 0, StockBatch.expiry_date < today
        )
    ).all()
    per = {}
    for b in expired:
        per[(b.blood_group, b.component)] = per.get((b.blood_group, b.component), 0) + b.units_remaining
    for (group, component), units in per.items():
        stock_ops.remove(db, hospital, group, component, units, "discard", reason="Expired", staff=_staff(hospital))
    count = sum(per.values())
    if count:
        log_activity(db, hospital.id, "delete", "bad", f"Discarded {count} expired unit{plural(count)}")
    db.commit()
    return {"discarded": count}


@router.put("/{group}/target")
def set_target(
    group: str,
    body: sm.StockTargetIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    if group not in BLOOD_GROUPS:
        raise HTTPException(404, "Unknown blood group.")
    row = db.scalar(select(StockTarget).where(StockTarget.hospital_id == hospital.id, StockTarget.blood_group == group))
    if row is None:
        db.add(StockTarget(hospital_id=hospital.id, blood_group=group, target_units=body.target_units))
    else:
        row.target_units = body.target_units
    db.commit()
    return {"group": group, "target_units": body.target_units}