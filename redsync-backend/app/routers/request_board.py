"""Everything the hospital Requests page needs: one overview, editing, and closing a request with stock."""

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas_more as sm
from app import stock_ops
from app.database import get_db
from app.deps import current_hospital
from app.models import BloodRequest, Hospital, RequestResponse, utcnow
from app.models_more import PublicRequest
from app.routers.hospital import _get_request, _public_out, _request_out
from app.utils import ACTIVE_STATUSES, log_activity, notify, plural, to_utc_naive

router = APIRouter(prefix="/hospital/requests", tags=["Hospital requests"])

CLOSED_LIMIT = 60  # most recent fulfilled and cancelled requests sent to the page


def usable_units(db: Session, hospital: Hospital, group: str, component: str) -> int:
    """Units of this component that could be issued today (expired units never count)."""
    row = stock_ops.stock_rows(db, hospital.id)[group]
    today = utcnow().date()
    in_batches = sum(b.units_remaining for b in stock_ops.batches(db, hospital.id, group, component) if b.expiry_date >= today)
    legacy = stock_ops.unbatched(db, hospital.id, group, row.units)
    return max(0, min(row.units, in_batches + legacy))


def _board_out(db: Session, hospital: Hospital, req: BloodRequest, with_stock: bool) -> dict:
    out = _request_out(db, req)
    out["overdue"] = req.status == "open" and req.required_by < utcnow()
    out["pledged"] = out["response_count"]
    if with_stock:
        out["usable_stock"] = usable_units(db, hospital, req.blood_group, req.component)
    return out


@router.get("/overview")
def overview(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    open_rows = db.scalars(
        select(BloodRequest)
        .where(BloodRequest.hospital_id == hospital.id, BloodRequest.status == "open")
        .order_by(BloodRequest.id.desc())
    ).all()
    closed_rows = db.scalars(
        select(BloodRequest)
        .where(BloodRequest.hospital_id == hospital.id, BloodRequest.status != "open")
        .order_by(BloodRequest.id.desc())
        .limit(CLOSED_LIMIT)
    ).all()
    public_rows = db.scalars(
        select(PublicRequest)
        .where(PublicRequest.status == "open", func.lower(PublicRequest.city) == hospital.city.lower())
        .order_by(PublicRequest.id.desc())
    ).all()

    open_out = [_board_out(db, hospital, r, True) for r in open_rows]
    closed_out = [_board_out(db, hospital, r, False) for r in closed_rows]
    db.commit()  # stock_rows may have created empty stock rows

    waiting = sum(1 for r in open_out for p in r["responders"] if p["status"] == "accepted")
    since = utcnow() - timedelta(days=30)
    fulfilled_30 = db.scalar(
        select(func.count(BloodRequest.id)).where(
            BloodRequest.hospital_id == hospital.id,
            BloodRequest.status == "fulfilled",
            BloodRequest.created_at >= since,
        )
    ) or 0

    return {
        "summary": {
            "open": len(open_out),
            "critical": sum(1 for r in open_out if r["urgency"] == "critical"),
            "overdue": sum(1 for r in open_out if r["overdue"]),
            "waiting_for_confirmation": waiting,
            "patient_requests": len(public_rows),
            "fulfilled_30_days": fulfilled_30,
        },
        "open": open_out,
        "closed": closed_out,
        "patient_requests": [_public_out(p) for p in public_rows],
    }


@router.patch("/{request_id}")
def edit_request(
    request_id: int,
    body: sm.RequestEditIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    req = _get_request(db, hospital, request_id)
    if req.status != "open":
        raise HTTPException(409, "This request is already closed.")

    changes = []
    if body.urgency and body.urgency != req.urgency:
        req.urgency = body.urgency
        changes.append(f"urgency is now {body.urgency}")
    if body.required_by is not None:
        new_time = to_utc_naive(body.required_by)
        if new_time <= utcnow():
            raise HTTPException(400, "Choose a time in the future.")
        if new_time != req.required_by:
            req.required_by = new_time
            changes.append("the needed-by time changed")
    if body.notes is not None and (body.notes.strip() or None) != req.notes:
        req.notes = body.notes.strip() or None

    notified = 0
    if changes:
        rows = db.execute(
            select(RequestResponse).where(
                RequestResponse.request_id == req.id, RequestResponse.status.in_(ACTIVE_STATUSES)
            )
        ).scalars().all()
        for response in rows:
            notify(
                db, response.donor.user_id, "Request updated",
                f"{hospital.name} updated the {req.blood_group} request: " + "; ".join(changes) + ".",
                "request", req.id,
            )
        notified = len(rows)
        log_activity(db, hospital.id, "edit", "neutral", f"Request updated: {req.blood_group} {req.units} unit{plural(req.units)}")
    db.commit()
    out = _board_out(db, hospital, req, True)
    return {"request": out, "notified": notified}


@router.post("/{request_id}/fulfill-with-stock")
def fulfill_with_stock(
    request_id: int,
    body: sm.FulfillIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    """Closes a request as fulfilled and, if asked, takes the units out of stock in the same step."""
    req = _get_request(db, hospital, request_id)
    if req.status != "open":
        raise HTTPException(409, "This request is already closed.")
    if body.issue_units > req.units:
        raise HTTPException(400, f"This request is for {req.units} unit{plural(req.units)}.")

    if body.issue_units:
        stock_ops.remove(
            db, hospital, req.blood_group, req.component, body.issue_units, "outward",
            reason="Issued to patient", staff=hospital.contact_name or hospital.name,
            note=f"Blood request #{req.id}",
        )
    req.status = "fulfilled"
    log_activity(
        db, hospital.id, "task_alt", "good",
        f"Request fulfilled: {req.blood_group} {req.units} unit{plural(req.units)}"
        + (f" ({body.issue_units} issued from stock)" if body.issue_units else ""),
    )
    db.commit()
    return {"request": _board_out(db, hospital, req, False), "issued": body.issue_units}