from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app import schemas_more as sm
from app.database import get_db
from app.deps import current_hospital
from app.models import (
    ActivityLog,
    BloodRequest,
    BloodStock,
    Donation,
    Donor,
    DonorHospitalLink,
    Hospital,
    RequestResponse,
    User,
    utcnow,
)
from app.models_more import Camp, CampRegistration, PublicRequest
from app.utils import (
    ACTIVE_STATUSES,
    BLOOD_GROUPS,
    SHARED_STATUSES,
    camp_out,
    donor_code,
    donor_gap_days,
    eligibility,
    iso,
    log_activity,
    notify,
    plural,
    shared_donor_ids,
    short_name,
    stock_status,
    to_utc_naive,
)

router = APIRouter(prefix="/hospital", tags=["Hospital"])

URGENCY_HOURS = {"critical": 6, "urgent": 24, "normal": 72}


# ---------------- helpers ----------------


def _stock_rows(db: Session, hospital: Hospital) -> list:
    """Make sure all 8 blood groups have a row, then return them in a fixed order."""
    rows = {
        s.blood_group: s
        for s in db.scalars(select(BloodStock).where(BloodStock.hospital_id == hospital.id))
    }
    created = False
    for group in BLOOD_GROUPS:
        if group not in rows:
            row = BloodStock(hospital_id=hospital.id, blood_group=group, units=0)
            db.add(row)
            rows[group] = row
            created = True
    if created:
        db.commit()
    return [rows[g] for g in BLOOD_GROUPS]


def _stock_out(row: BloodStock) -> dict:
    return {
        "group": row.blood_group,
        "units": row.units,
        "status": stock_status(row.units),
        "expiry": row.expiry,
        "notes": row.notes,
        "updated_at": iso(row.updated_at),
    }


def _visible_donors(db: Session, hospital: Hospital) -> list:
    """Donors in the hospital's city, linked to it, or who responded to it.
    Returns (donor, user, link) tuples."""
    links = {
        link.donor_id: link
        for link in db.scalars(
            select(DonorHospitalLink).where(DonorHospitalLink.hospital_id == hospital.id)
        )
    }
    ids = list(set(links) | shared_donor_ids(db, hospital.id)) or [0]
    rows = db.execute(
        select(Donor, User)
        .join(User, User.id == Donor.user_id)
        .where(
            User.is_active.is_(True),
            or_(func.lower(Donor.city) == hospital.city.lower(), Donor.id.in_(ids)),
        )
        .order_by(User.name)
    ).all()
    return [(donor, user, links.get(donor.id)) for donor, user in rows]


def _can_access_donor(db: Session, hospital: Hospital, donor: Donor) -> bool:
    if donor.city.lower() == hospital.city.lower():
        return True
    linked = db.scalar(
        select(DonorHospitalLink.id).where(
            DonorHospitalLink.donor_id == donor.id,
            DonorHospitalLink.hospital_id == hospital.id,
        )
    )
    return linked is not None or donor.id in shared_donor_ids(db, hospital.id)


def _donor_row(donor: Donor, user: User, link, shared: set) -> dict:
    e = eligibility(donor)
    return {
        "id": donor.id,
        "code": donor_code(donor.id),
        "name": user.name,
        "blood_group": donor.blood_group,
        "gender": donor.gender,
        "city": donor.city,
        "area": donor.area,
        "last_donation": None if donor.never_donated else donor.last_donation,
        "never_donated": donor.never_donated or donor.last_donation is None,
        "eligible": e["eligible"],
        "days_left": e["days_left"],
        "next_eligible": e["next_eligible"],
        "available": donor.available,
        "active": bool(link and link.is_active),
        # The phone is shown only after the donor accepted one of this hospital's requests
        "phone": user.phone if donor.id in shared else None,
    }


def _responders(db: Session, req: BloodRequest) -> list:
    rows = db.execute(
        select(RequestResponse, Donor, User)
        .join(Donor, Donor.id == RequestResponse.donor_id)
        .join(User, User.id == Donor.user_id)
        .where(
            RequestResponse.request_id == req.id,
            RequestResponse.status.in_(SHARED_STATUSES),
        )
        .order_by(RequestResponse.responded_at)
    ).all()
    return [
        {
            "response_id": r.id,
            "donor_id": d.id,
            "name": u.name,
            "blood_group": d.blood_group,
            "area": d.area,
            "status": r.status,
            "responded_at": iso(r.responded_at),
            "phone": u.phone,
        }
        for r, d, u in rows
    ]


def _request_out(db: Session, req: BloodRequest) -> dict:
    responders = _responders(db, req)
    return {
        "id": req.id,
        "blood_group": req.blood_group,
        "units": req.units,
        "component": req.component,
        "urgency": req.urgency,
        "required_by": iso(req.required_by),
        "notes": req.notes,
        "status": req.status,
        "created_at": iso(req.created_at),
        "response_count": len(responders),
        "responders": responders,
    }


def _get_request(db: Session, hospital: Hospital, request_id: int) -> BloodRequest:
    req = db.get(BloodRequest, request_id)
    if req is None or req.hospital_id != hospital.id:
        raise HTTPException(404, "Request not found.")
    return req


def _notify_donors(db: Session, hospital: Hospital, req: BloodRequest) -> int:
    """Notify available, eligible donors with the same blood group in the hospital's city."""
    rows = db.execute(
        select(Donor, User)
        .join(User, User.id == Donor.user_id)
        .where(
            Donor.blood_group == req.blood_group,
            Donor.available.is_(True),
            func.lower(Donor.city) == hospital.city.lower(),
            User.is_active.is_(True),
        )
    ).all()
    count = 0
    for donor, user in rows:
        if not eligibility(donor)["eligible"]:
            continue
        notify(
            db,
            user.id,
            f"{req.blood_group} needed at {hospital.name}",
            f"{req.units} unit{plural(req.units)} of {req.component}. Open RedSync to respond.",
            "request",
            req.id,
        )
        count += 1
    print(f"[DEV ALERT] {count} donor(s) notified about request {req.id} (no SMS service yet)")
    return count


# ---------------- profile and summary ----------------


@router.get("/me")
def hospital_me(hospital: Hospital = Depends(current_hospital)):
    return {
        "id": hospital.id,
        "name": hospital.name,
        "facility_code": hospital.facility_code,
        "facility_type": hospital.facility_type,
        "city": hospital.city,
        "address": hospital.address,
        "phone": hospital.phone,
        "emergency_phone": hospital.emergency_phone,
        "email": hospital.email,
        "components": [c for c in hospital.components.split(",") if c],
        "open_24h": hospital.open_24h,
        "open_time": hospital.open_time,
        "close_time": hospital.close_time,
        "staff_name": hospital.user.name,
    }


@router.get("/summary")
def summary(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    rows = _stock_rows(db, hospital)
    low = [r for r in rows if stock_status(r.units) != "available"]
    open_requests = db.scalars(
        select(BloodRequest).where(
            BloodRequest.hospital_id == hospital.id, BloodRequest.status == "open"
        )
    ).all()
    donors = _visible_donors(db, hospital)
    active = [donor for donor, _, link in donors if link and link.is_active]
    today = date.today()

    return {
        "hospital": {"id": hospital.id, "name": hospital.name, "facility_code": hospital.facility_code},
        "total_units": sum(r.units for r in rows),
        "low_groups": [{"group": r.blood_group, "units": r.units, "status": stock_status(r.units)} for r in low],
        "critical_count": sum(1 for r in low if stock_status(r.units) == "critical"),
        "open_requests": len(open_requests),
        "responses": sum(len(_responders(db, r)) for r in open_requests),
        "active_donors": len(active),
        "eligible_active_donors": sum(1 for d in active if eligibility(d)["eligible"]),
        "expiring": [
            {"group": r.blood_group, "expiry": r.expiry, "days": (r.expiry - today).days}
            for r in rows
            if r.expiry and r.units > 0 and (r.expiry - today).days <= 3
        ],
    }


@router.get("/activity")
def activity(
    limit: int = Query(8, ge=1, le=50),
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(ActivityLog)
        .where(ActivityLog.hospital_id == hospital.id)
        .order_by(ActivityLog.id.desc())
        .limit(limit)
    ).all()
    return [
        {"id": a.id, "icon": a.icon, "tone": a.tone, "text": a.text, "created_at": iso(a.created_at)}
        for a in rows
    ]


# ---------------- stock ----------------


@router.get("/stock")
def get_stock(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    return [_stock_out(r) for r in _stock_rows(db, hospital)]


@router.put("/stock/{group}")
def update_stock(
    group: str,
    body: sm.StockUpdateIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    if group not in BLOOD_GROUPS:
        raise HTTPException(404, "Unknown blood group.")
    row = next(r for r in _stock_rows(db, hospital) if r.blood_group == group)
    row.units = body.units
    if body.expiry is not None:
        row.expiry = body.expiry
    if body.notes is not None:
        row.notes = body.notes
    log_activity(
        db, hospital.id, "autorenew", "neutral", f"Stock updated: {group} ({body.units} unit{plural(body.units)})"
    )
    db.commit()
    db.refresh(row)
    return _stock_out(row)


# ---------------- donor list ----------------


@router.get("/donors")
def list_donors(
    q: Optional[str] = None,
    group: Optional[str] = None,
    eligibility_filter: Optional[Literal["eligible", "not"]] = Query(None, alias="eligibility"),
    status: Optional[Literal["active", "offline"]] = None,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    shared = shared_donor_ids(db, hospital.id)
    rows = []
    term = q.strip().lower() if q else ""
    for donor, user, link in _visible_donors(db, hospital):
        row = _donor_row(donor, user, link, shared)
        if term and term not in f"{row['name']} {row['area']} {row['code']}".lower():
            continue
        if group and row["blood_group"] != group:
            continue
        if eligibility_filter == "eligible" and not row["eligible"]:
            continue
        if eligibility_filter == "not" and row["eligible"]:
            continue
        if status == "active" and not row["active"]:
            continue
        if status == "offline" and row["active"]:
            continue
        rows.append(row)
    return {"count": len(rows), "donors": rows}


@router.patch("/donors/{donor_id}/active")
def set_donor_active(
    donor_id: int,
    body: sm.ActiveIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    donor = db.get(Donor, donor_id)
    if donor is None or not _can_access_donor(db, hospital, donor):
        raise HTTPException(404, "Donor not found.")

    link = db.scalar(
        select(DonorHospitalLink).where(
            DonorHospitalLink.donor_id == donor.id,
            DonorHospitalLink.hospital_id == hospital.id,
        )
    )
    if link is None:
        link = DonorHospitalLink(donor_id=donor.id, hospital_id=hospital.id)
        db.add(link)

    user = donor.user
    link.is_active = body.active
    link.verified_at = utcnow() if body.active else None

    if body.active:
        log_activity(db, hospital.id, "verified_user", "neutral", f"Donor marked Active: {short_name(user.name)}")
        notify(db, user.id, "Verified by a hospital", f"{hospital.name} marked you as an active donor.", "info")
    else:
        log_activity(db, hospital.id, "verified_user", "neutral", f"Donor set to Offline: {short_name(user.name)}")

    db.commit()
    return _donor_row(donor, user, link, shared_donor_ids(db, hospital.id))


# ---------------- requests ----------------


@router.get("/requests")
def list_requests(
    status: Literal["open", "fulfilled", "cancelled"] = "open",
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(BloodRequest)
        .where(BloodRequest.hospital_id == hospital.id, BloodRequest.status == status)
        .order_by(BloodRequest.id.desc())
    ).all()
    return [_request_out(db, r) for r in rows]


@router.post("/requests", status_code=201)
def create_request(
    body: sm.RequestCreateIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    required_by = to_utc_naive(body.required_by)
    if required_by <= utcnow():
        raise HTTPException(400, "Choose a time in the future.")

    req = BloodRequest(
        hospital_id=hospital.id,
        blood_group=body.blood_group,
        units=body.units,
        component=body.component,
        urgency=body.urgency,
        required_by=required_by,
        notes=body.notes,
        status="open",
    )
    db.add(req)
    db.flush()  # gives the request an id

    notified = _notify_donors(db, hospital, req)
    log_activity(
        db,
        hospital.id,
        "campaign",
        "alert",
        f"Request posted: {req.blood_group} {req.units} unit{plural(req.units)} {req.component}",
    )
    db.commit()
    db.refresh(req)
    return {"request": _request_out(db, req), "notified": notified}


@router.get("/requests/{request_id}/responses")
def request_responses(
    request_id: int,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    return _responders(db, _get_request(db, hospital, request_id))


@router.patch("/requests/{request_id}/responses/{response_id}")
def update_response(
    request_id: int,
    response_id: int,
    body: sm.ResponseStatusIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    req = _get_request(db, hospital, request_id)
    response = db.get(RequestResponse, response_id)
    if response is None or response.request_id != req.id:
        raise HTTPException(404, "Response not found.")

    allowed_from = {"confirmed": ("accepted",), "completed": ACTIVE_STATUSES}
    if response.status not in allowed_from[body.status]:
        raise HTTPException(409, f"This response is already {response.status}.")

    response.status = body.status
    donor = response.donor
    if body.status == "confirmed":
        notify(db, donor.user_id, "Response confirmed", f"{hospital.name} confirmed your response. Please visit them.", "request", req.id)
    else:
        notify(db, donor.user_id, "Donation completed", f"Thank you. {hospital.name} marked your donation as completed.", "donation", req.id)
    log_activity(
        db, hospital.id, "check_circle", "good",
        f"Response {body.status}: {donor.blood_group} donor {short_name(donor.user.name)}",
    )
    db.commit()
    return _request_out(db, req)


@router.post("/requests/{request_id}/fulfill")
def fulfill_request(
    request_id: int,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    req = _get_request(db, hospital, request_id)
    if req.status != "open":
        raise HTTPException(409, "This request is already closed.")
    req.status = "fulfilled"
    log_activity(db, hospital.id, "task_alt", "good", f"Request fulfilled: {req.blood_group} {req.units} unit{plural(req.units)}")
    db.commit()
    return _request_out(db, req)


@router.post("/requests/{request_id}/cancel")
def cancel_request(
    request_id: int,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    req = _get_request(db, hospital, request_id)
    if req.status != "open":
        raise HTTPException(409, "This request is already closed.")
    req.status = "cancelled"

    rows = db.execute(
        select(RequestResponse, Donor)
        .join(Donor, Donor.id == RequestResponse.donor_id)
        .where(RequestResponse.request_id == req.id, RequestResponse.status.in_(ACTIVE_STATUSES))
    ).all()
    for response, donor in rows:
        response.status = "cancelled"
        notify(db, donor.user_id, "Request cancelled", f"{hospital.name} cancelled the {req.blood_group} request. Thank you for responding.", "request", req.id)

    log_activity(db, hospital.id, "cancel", "neutral", f"Request cancelled: {req.blood_group} {req.units} unit{plural(req.units)}")
    db.commit()
    return _request_out(db, req)


# ---------------- donations ----------------


@router.post("/donations", status_code=201)
def record_donation(
    body: sm.DonationCreateIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    donor = db.get(Donor, body.donor_id)
    if donor is None or not _can_access_donor(db, hospital, donor):
        raise HTTPException(404, "Donor not found.")
    if body.donation_date < donor.dob:
        raise HTTPException(400, "The donation date cannot be before the donor's date of birth.")

    response = None
    if body.response_id is not None:
        response = db.get(RequestResponse, body.response_id)
        if (
            response is None
            or response.donor_id != donor.id
            or response.request.hospital_id != hospital.id
        ):
            raise HTTPException(404, "Response not found.")

    # A soft warning, not a block: the hospital decides
    warning = None
    if donor.last_donation and not donor.never_donated:
        gap = donor_gap_days(donor.gender)
        if body.donation_date < donor.last_donation + timedelta(days=gap):
            warning = (
                f"The last recorded donation was on {donor.last_donation:%d %b %Y}. "
                f"The usual gap is {gap} days."
            )

    stock_rows = {r.blood_group: r for r in _stock_rows(db, hospital)}

    donation = Donation(
        hospital_id=hospital.id,
        donor_id=donor.id,
        donation_date=body.donation_date,
        component=body.component,
        units=body.units,
        batch_id=body.batch_id,
    )
    db.add(donation)

    if donor.last_donation is None or body.donation_date > donor.last_donation:
        donor.last_donation = body.donation_date
    donor.never_donated = False
    stock_rows[donor.blood_group].units += body.units

    already_linked = db.scalar(
        select(DonorHospitalLink.id).where(
            DonorHospitalLink.donor_id == donor.id,
            DonorHospitalLink.hospital_id == hospital.id,
        )
    )
    if already_linked is None:
        db.add(DonorHospitalLink(donor_id=donor.id, hospital_id=hospital.id))

    if response is not None:
        response.status = "completed"

    user = donor.user
    log_activity(
        db, hospital.id, "check_circle", "good",
        f"Donation recorded: {donor.blood_group} {body.component} from {short_name(user.name)}",
    )
    notify(db, user.id, "Donation recorded", f"{hospital.name} recorded your donation on {body.donation_date:%d %b %Y}. Thank you.", "donation")
    db.commit()
    db.refresh(donation)

    return {
        "id": donation.id,
        "donor_id": donor.id,
        "donor_name": user.name,
        "blood_group": donor.blood_group,
        "donation_date": donation.donation_date,
        "component": donation.component,
        "units": donation.units,
        "batch_id": donation.batch_id,
        "next_eligible": eligibility(donor)["next_eligible"],
        "warning": warning,
    }


@router.get("/donations")
def list_donations(
    limit: int = Query(20, ge=1, le=100),
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(Donation, Donor, User)
        .join(Donor, Donor.id == Donation.donor_id)
        .join(User, User.id == Donor.user_id)
        .where(Donation.hospital_id == hospital.id)
        .order_by(Donation.donation_date.desc(), Donation.id.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": d.id,
            "donor_name": u.name,
            "blood_group": donor.blood_group,
            "donation_date": d.donation_date,
            "component": d.component,
            "units": d.units,
            "batch_id": d.batch_id,
        }
        for d, donor, u in rows
    ]


# ---------------- camps ----------------


@router.get("/camps")
def my_camps(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    camps = db.scalars(
        select(Camp)
        .where(Camp.hospital_id == hospital.id, Camp.status == "active", Camp.camp_date >= date.today())
        .order_by(Camp.camp_date, Camp.start_time)
    ).all()
    return [camp_out(db, c, hospital.name) for c in camps]


@router.post("/camps", status_code=201)
def create_camp(
    body: sm.CampCreateIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    camp = Camp(
        hospital_id=hospital.id,
        title=body.title.strip(),
        camp_date=body.camp_date,
        start_time=body.start_time,
        end_time=body.end_time,
        venue=body.venue.strip(),
        city=hospital.city,
        target_units=body.target_units,
    )
    db.add(camp)
    log_activity(db, hospital.id, "event", "neutral", f"Camp created: {camp.title}")
    db.commit()
    db.refresh(camp)
    return camp_out(db, camp, hospital.name)


@router.delete("/camps/{camp_id}")
def cancel_camp(
    camp_id: int,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    camp = db.get(Camp, camp_id)
    if camp is None or camp.hospital_id != hospital.id:
        raise HTTPException(404, "Camp not found.")
    if camp.status == "cancelled":
        return {"message": "This camp was already cancelled."}

    camp.status = "cancelled"
    user_ids = db.scalars(
        select(Donor.user_id)
        .join(CampRegistration, CampRegistration.donor_id == Donor.id)
        .where(CampRegistration.camp_id == camp.id)
    ).all()
    for user_id in user_ids:
        notify(db, user_id, "Camp cancelled", f"{hospital.name} cancelled the camp \"{camp.title}\".", "camp", camp.id)

    log_activity(db, hospital.id, "event_busy", "neutral", f"Camp cancelled: {camp.title}")
    db.commit()
    return {"message": "Camp cancelled."}


# ---------------- public requests from patients ----------------


def _public_out(p: PublicRequest) -> dict:
    return {
        "id": p.id,
        "requester_name": p.requester_name,
        "phone": p.phone,
        "blood_group": p.blood_group,
        "units": p.units,
        "component": p.component,
        "urgency": p.urgency,
        "hospital_name": p.hospital_name,
        "notes": p.notes,
        "created_at": iso(p.created_at),
    }


def _get_public_request(db: Session, hospital: Hospital, public_id: int) -> PublicRequest:
    p = db.get(PublicRequest, public_id)
    if p is None or p.status != "open" or p.city.lower() != hospital.city.lower():
        raise HTTPException(404, "Request not found.")
    return p


@router.get("/public-requests")
def public_requests(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(PublicRequest)
        .where(PublicRequest.status == "open", func.lower(PublicRequest.city) == hospital.city.lower())
        .order_by(PublicRequest.id.desc())
    ).all()
    return [_public_out(p) for p in rows]


@router.post("/public-requests/{public_id}/forward")
def forward_public_request(
    public_id: int,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    p = _get_public_request(db, hospital, public_id)
    note = f"Public request. {p.notes}" if p.notes else "Public request."
    req = BloodRequest(
        hospital_id=hospital.id,
        blood_group=p.blood_group,
        units=p.units,
        component=p.component,
        urgency=p.urgency,
        required_by=utcnow() + timedelta(hours=URGENCY_HOURS[p.urgency]),
        notes=note[:300],
        status="open",
    )
    db.add(req)
    db.flush()
    p.status = "forwarded"

    notified = _notify_donors(db, hospital, req)
    log_activity(db, hospital.id, "campaign", "alert", f"Public request forwarded: {req.blood_group} {req.units} unit{plural(req.units)}")
    db.commit()
    db.refresh(req)
    return {"request": _request_out(db, req), "notified": notified}


@router.post("/public-requests/{public_id}/dismiss")
def dismiss_public_request(
    public_id: int,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    p = _get_public_request(db, hospital, public_id)
    p.status = "dismissed"
    db.commit()
    return {"message": "Request dismissed."}