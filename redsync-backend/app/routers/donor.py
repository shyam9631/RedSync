from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas_more as sm
from app.database import get_db
from app.deps import current_donor
from app.models import (
    BloodRequest,
    Donation,
    Donor,
    Hospital,
    RequestResponse,
    User,
    utcnow,
)
from app.models_more import Camp, CampRegistration
from app.utils import (
    ACTIVE_STATUSES,
    camp_out,
    eligibility,
    iso,
    log_activity,
    notify,
    short_name,
    upcoming_camps,
)

router = APIRouter(prefix="/donor", tags=["Donor"])

URGENCY_ORDER = {"critical": 0, "urgent": 1, "normal": 2}
STEP = {"accepted": 1, "confirmed": 2, "completed": 3}


# ---------------- helpers ----------------


def _profile(donor: Donor) -> dict:
    user = donor.user
    return {
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "blood_group": donor.blood_group,
        "gender": donor.gender,
        "dob": donor.dob,
        "weight_kg": donor.weight_kg,
        "city": donor.city,
        "area": donor.area,
        "pin": donor.pin,
        "radius_km": donor.radius_km,
        "last_donation": None if donor.never_donated else donor.last_donation,
        "never_donated": donor.never_donated or donor.last_donation is None,
        "available": donor.available,
        "sms_alerts": donor.sms_alerts,
        "whatsapp_alerts": donor.whatsapp_alerts,
    }


def _history(db: Session, donor: Donor, limit: Optional[int] = None) -> list:
    query = (
        select(Donation, Hospital)
        .join(Hospital, Hospital.id == Donation.hospital_id)
        .where(Donation.donor_id == donor.id)
        .order_by(Donation.donation_date.desc(), Donation.id.desc())
    )
    if limit:
        query = query.limit(limit)
    return [
        {
            "id": d.id,
            "hospital": h.name,
            "date": d.donation_date,
            "component": d.component,
            "units": d.units,
        }
        for d, h in db.execute(query).all()
    ]


def _active_row(db: Session, donor: Donor) -> Optional[RequestResponse]:
    """The response in progress, or one completed in the last 24 hours."""
    row = db.scalar(
        select(RequestResponse)
        .where(RequestResponse.donor_id == donor.id, RequestResponse.status.in_(ACTIVE_STATUSES))
        .order_by(RequestResponse.id.desc())
    )
    if row is None:
        row = db.scalar(
            select(RequestResponse)
            .where(
                RequestResponse.donor_id == donor.id,
                RequestResponse.status == "completed",
                RequestResponse.updated_at > utcnow() - timedelta(hours=24),
            )
            .order_by(RequestResponse.id.desc())
        )
    return row


def _active_payload(row: Optional[RequestResponse]) -> Optional[dict]:
    """The hospital's phone numbers appear here only because the donor accepted."""
    if row is None:
        return None
    req = row.request
    hospital = req.hospital
    return {
        "response_id": row.id,
        "status": row.status,
        "step": STEP[row.status],
        "accepted_at": iso(row.responded_at),
        "updated_at": iso(row.updated_at),
        "request": {
            "id": req.id,
            "blood_group": req.blood_group,
            "component": req.component,
            "units": req.units,
            "urgency": req.urgency,
            "required_by": iso(req.required_by),
        },
        "hospital": {
            "id": hospital.id,
            "name": hospital.name,
            "address": hospital.address,
            "city": hospital.city,
            "phone": hospital.phone,
            "emergency_phone": hospital.emergency_phone,
        },
    }


# ---------------- dashboard and profile ----------------


@router.get("/dashboard")
def dashboard(donor: Donor = Depends(current_donor), db: Session = Depends(get_db)):
    history = _history(db, donor)
    return {
        "profile": _profile(donor),
        "eligibility": eligibility(donor),
        "available": donor.available,
        "stats": {
            "total_donations": len(history),
            "last_donation": None if donor.never_donated else donor.last_donation,
        },
        "history": history[:3],
        "active_response": _active_payload(_active_row(db, donor)),
        "camps": upcoming_camps(db, donor.city, donor.id, limit=2),
    }


@router.get("/profile")
def get_profile(donor: Donor = Depends(current_donor)):
    return _profile(donor)


@router.put("/profile")
def update_profile(
    body: sm.DonorUpdateIn,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    user = donor.user

    if data.get("name"):
        user.name = data["name"].strip()

    if "email" in data:
        email = data["email"].lower() if data["email"] else None
        if email:
            taken = db.scalar(select(User).where(User.email == email, User.id != user.id))
            if taken:
                raise HTTPException(409, "This email is already in use.")
        user.email = email

    for field in ("weight_kg", "city", "area", "pin", "radius_km", "sms_alerts", "whatsapp_alerts"):
        if data.get(field) is not None:
            value = data[field].strip() if isinstance(data[field], str) else data[field]
            setattr(donor, field, value)

    if not (donor.sms_alerts or donor.whatsapp_alerts):
        db.rollback()
        raise HTTPException(400, "Choose at least one alert channel.")

    db.commit()
    return _profile(donor)


@router.patch("/availability")
def set_availability(
    body: sm.AvailabilityIn,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    donor.available = body.available
    db.commit()
    return {"available": donor.available}


# ---------------- requests ----------------


@router.get("/requests")
def list_requests(
    urgency: Optional[Literal["critical", "urgent", "normal"]] = None,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    result = {"available": donor.available, "eligibility": eligibility(donor), "requests": []}
    if not donor.available:
        return result

    hidden = select(RequestResponse.request_id).where(
        RequestResponse.donor_id == donor.id,
        RequestResponse.status.in_(("declined", "cancelled")),
    )
    query = (
        select(BloodRequest, Hospital)
        .join(Hospital, Hospital.id == BloodRequest.hospital_id)
        .where(
            BloodRequest.status == "open",
            BloodRequest.blood_group == donor.blood_group,
            BloodRequest.required_by > utcnow(),
            Hospital.status == "approved",
            func.lower(Hospital.city) == donor.city.lower(),
            BloodRequest.id.not_in(hidden),
        )
    )
    if urgency:
        query = query.where(BloodRequest.urgency == urgency)

    mine = {
        r.request_id: r.status
        for r in db.scalars(select(RequestResponse).where(RequestResponse.donor_id == donor.id))
    }
    rows = db.execute(query).all()
    rows.sort(key=lambda row: (URGENCY_ORDER[row[0].urgency], -row[0].created_at.timestamp()))

    result["requests"] = [
        {
            "id": r.id,
            "blood_group": r.blood_group,
            "component": r.component,
            "units": r.units,
            "urgency": r.urgency,
            "required_by": iso(r.required_by),
            "posted_at": iso(r.created_at),
            "notes": r.notes,
            "my_status": mine.get(r.id),
            "hospital": {"id": h.id, "name": h.name, "city": h.city, "address": h.address},
        }
        for r, h in rows
    ]
    return result


@router.post("/requests/{request_id}/accept")
def accept_request(
    request_id: int,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    req = db.get(BloodRequest, request_id)
    if req is None or req.status != "open" or req.required_by <= utcnow():
        raise HTTPException(409, "This request is no longer open.")
    if req.blood_group != donor.blood_group:
        raise HTTPException(400, "This request needs a different blood group.")
    if not donor.available:
        raise HTTPException(400, "Turn on \"Available to donate\" first.")

    e = eligibility(donor)
    if not e["eligible"]:
        raise HTTPException(400, f"You can donate again on {e['next_eligible']:%d %b %Y}.")

    active = db.scalar(
        select(RequestResponse).where(
            RequestResponse.donor_id == donor.id,
            RequestResponse.status.in_(ACTIVE_STATUSES),
        )
    )
    if active is not None and active.request_id != req.id:
        raise HTTPException(409, "You already have an active response. Finish or cancel it first.")

    row = db.scalar(
        select(RequestResponse).where(
            RequestResponse.request_id == req.id, RequestResponse.donor_id == donor.id
        )
    )
    if row is None:
        row = RequestResponse(request_id=req.id, donor_id=donor.id, status="accepted")
        db.add(row)
    elif row.status in ("declined", "cancelled"):
        row.status = "accepted"
        row.responded_at = utcnow()
    else:
        return {"active_response": _active_payload(row)}  # already accepted

    hospital = req.hospital
    name = short_name(donor.user.name)
    notify(db, hospital.user_id, f"{donor.blood_group} donor responded", f"{name} accepted your {req.blood_group} request.", "request", req.id)
    log_activity(db, hospital.id, "person_add", "good", f"Donor responded: {donor.blood_group} {name}")
    db.commit()
    db.refresh(row)
    return {"active_response": _active_payload(row)}


@router.post("/requests/{request_id}/decline")
def decline_request(
    request_id: int,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    req = db.get(BloodRequest, request_id)
    if req is None:
        raise HTTPException(404, "Request not found.")

    row = db.scalar(
        select(RequestResponse).where(
            RequestResponse.request_id == req.id, RequestResponse.donor_id == donor.id
        )
    )
    if row is not None and row.status in ("accepted", "confirmed", "completed"):
        raise HTTPException(409, "You already responded. Cancel your response instead.")
    if row is None:
        db.add(RequestResponse(request_id=req.id, donor_id=donor.id, status="declined"))
    else:
        row.status = "declined"
    db.commit()
    return {"message": "Request hidden."}


@router.get("/active-response")
def active_response(donor: Donor = Depends(current_donor), db: Session = Depends(get_db)):
    return {"active_response": _active_payload(_active_row(db, donor))}


@router.post("/responses/{response_id}/cancel")
def cancel_response(
    response_id: int,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    row = db.get(RequestResponse, response_id)
    if row is None or row.donor_id != donor.id:
        raise HTTPException(404, "Response not found.")
    if row.status not in ACTIVE_STATUSES:
        raise HTTPException(409, "This response cannot be cancelled.")

    row.status = "cancelled"
    req = row.request
    hospital = req.hospital
    name = short_name(donor.user.name)
    notify(db, hospital.user_id, "Donor cancelled", f"{name} cancelled their response to your {req.blood_group} request.", "request", req.id)
    log_activity(db, hospital.id, "person_remove", "neutral", f"Donor cancelled: {donor.blood_group} {name}")
    db.commit()
    return {"message": "Your response was cancelled."}


# ---------------- history and camps ----------------


@router.get("/history")
def history(donor: Donor = Depends(current_donor), db: Session = Depends(get_db)):
    return _history(db, donor)


@router.get("/camps")
def camps(donor: Donor = Depends(current_donor), db: Session = Depends(get_db)):
    return upcoming_camps(db, donor.city, donor.id)


def _open_camp(db: Session, camp_id: int) -> Camp:
    camp = db.get(Camp, camp_id)
    if camp is None or camp.status != "active" or camp.camp_date < date.today():
        raise HTTPException(404, "Camp not found.")
    return camp


@router.post("/camps/{camp_id}/register")
def register_camp(
    camp_id: int,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    camp = _open_camp(db, camp_id)
    e = eligibility(donor)
    if e["next_eligible"] and camp.camp_date < e["next_eligible"]:
        raise HTTPException(400, f"You will not be eligible by this date. Try again after {e['next_eligible']:%d %b %Y}.")

    existing = db.scalar(
        select(CampRegistration.id).where(
            CampRegistration.camp_id == camp.id, CampRegistration.donor_id == donor.id
        )
    )
    if existing is None:
        db.add(CampRegistration(camp_id=camp.id, donor_id=donor.id))
        db.commit()
    hospital = db.get(Hospital, camp.hospital_id)
    return camp_out(db, camp, hospital.name, donor.id)


@router.delete("/camps/{camp_id}/register")
def unregister_camp(
    camp_id: int,
    donor: Donor = Depends(current_donor),
    db: Session = Depends(get_db),
):
    camp = _open_camp(db, camp_id)
    reg = db.scalar(
        select(CampRegistration).where(
            CampRegistration.camp_id == camp.id, CampRegistration.donor_id == donor.id
        )
    )
    if reg is not None:
        db.delete(reg)
        db.commit()
    hospital = db.get(Hospital, camp.hospital_id)
    return camp_out(db, camp, hospital.name, donor.id)