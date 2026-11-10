import uuid
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app import schemas, schemas_more as sm
from app.database import get_db
from app.models import BloodRequest, BloodStock, Donation, Donor, Hospital, User, utcnow
from app.models_more import PublicRequest
from app.security import verify_password
from app.utils import (
    BLOOD_GROUPS,
    UPLOAD_DIR,
    iso,
    stock_status,
    upcoming_camps,
)

router = APIRouter(prefix="/public", tags=["Public"])

MAX_LICENSE_BYTES = 10 * 1024 * 1024
TYPE_EXT = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}
SIGNATURES = {".pdf": b"%PDF", ".jpg": b"\xff\xd8\xff", ".png": b"\x89PNG\r\n\x1a\n"}
MAX_PUBLIC_REQUESTS_PER_DAY = 3


@router.get("/hospitals", response_model=list[schemas.PublicHospitalOut])
def list_hospitals(city: Optional[str] = None, db: Session = Depends(get_db)):
    """Approved hospitals only. Used by the donor form's 'preferred hospital' dropdown."""
    query = select(Hospital).where(Hospital.status == "approved").order_by(Hospital.name)
    if city:
        query = query.where(func.lower(Hospital.city) == city.strip().lower())
    return db.scalars(query).all()


@router.get("/find-blood")
def find_blood(
    group: Optional[schemas.BloodGroup] = None,
    location: Optional[str] = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
):
    """Hospitals and their stock. 'location' matches city, hospital name or PIN code."""
    query = select(Hospital).where(Hospital.status == "approved")
    if location and location.strip():
        term = f"%{location.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Hospital.city).like(term),
                func.lower(Hospital.name).like(term),
                Hospital.pin.like(term),
            )
        )
    hospitals = db.scalars(query.limit(100)).all()

    ids = [h.id for h in hospitals] or [0]
    stock = {}
    for row in db.scalars(select(BloodStock).where(BloodStock.hospital_id.in_(ids))):
        stock.setdefault(row.hospital_id, {})[row.blood_group] = row

    groups = [group] if group else BLOOD_GROUPS
    results = []
    for h in hospitals:
        rows = stock.get(h.id, {})
        items = [
            {
                "group": g,
                "units": rows[g].units if g in rows else 0,
                "status": stock_status(rows[g].units if g in rows else 0),
                "updated_at": iso(rows[g].updated_at) if g in rows else None,
            }
            for g in groups
        ]
        if group and items[0]["units"] <= 0:
            continue
        results.append(
            {
                "id": h.id,
                "name": h.name,
                "facility_type": h.facility_type,
                "city": h.city,
                "address": h.address,
                "phone": h.phone,
                "emergency_phone": h.emergency_phone,
                "open_24h": h.open_24h,
                "stock": items,
            }
        )

    if group:
        results.sort(key=lambda r: -r["stock"][0]["units"])
    else:
        results.sort(key=lambda r: r["name"].lower())
    return {"count": len(results), "results": results[:50]}


@router.get("/availability")
def availability(city: Optional[str] = None, db: Session = Depends(get_db)):
    """Total units per blood group across approved hospitals (for the landing page grid)."""
    query = (
        select(BloodStock.blood_group, func.sum(BloodStock.units))
        .join(Hospital, Hospital.id == BloodStock.hospital_id)
        .where(Hospital.status == "approved")
        .group_by(BloodStock.blood_group)
    )
    if city:
        query = query.where(func.lower(Hospital.city) == city.strip().lower())
    totals = {group: int(total or 0) for group, total in db.execute(query).all()}
    return [
        {"group": g, "units": totals.get(g, 0), "status": stock_status(totals.get(g, 0))}
        for g in BLOOD_GROUPS
    ]


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    """Real totals for the landing page. Counts only: no personal details."""
    donors = db.scalar(
        select(func.count(Donor.id))
        .select_from(Donor)
        .join(User, User.id == Donor.user_id)
        .where(User.is_active.is_(True))
    )
    hospitals = db.scalar(select(func.count(Hospital.id)).where(Hospital.status == "approved"))
    donations = db.scalar(select(func.count(Donation.id)))
    units = db.scalar(select(func.sum(Donation.units)))
    fulfilled = db.scalar(select(func.count(BloodRequest.id)).where(BloodRequest.status == "fulfilled"))
    return {
        "donors": int(donors or 0),
        "hospitals": int(hospitals or 0),
        "donations": int(donations or 0),
        "units_collected": int(units or 0),
        "requests_fulfilled": int(fulfilled or 0),
    }


@router.get("/camps")
def public_camps(city: Optional[str] = None, db: Session = Depends(get_db)):
    return upcoming_camps(db, city)


@router.post("/request-blood", status_code=201)
def request_blood(body: sm.PublicRequestIn, db: Session = Depends(get_db)):
    """A request from a patient's family. Hospitals in the city review it before donors are alerted."""
    recent = db.scalar(
        select(func.count(PublicRequest.id)).where(
            PublicRequest.phone == body.phone,
            PublicRequest.created_at > utcnow() - timedelta(hours=24),
        )
    ) or 0
    if recent >= MAX_PUBLIC_REQUESTS_PER_DAY:
        raise HTTPException(429, "You have sent several requests today. Please call the hospital directly.")

    request = PublicRequest(
        requester_name=body.requester_name.strip(),
        phone=body.phone,
        blood_group=body.blood_group,
        units=body.units,
        component=body.component,
        urgency=body.urgency,
        hospital_name=body.hospital_name.strip(),
        city=body.city.strip(),
        notes=body.notes,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return {
        "id": request.id,
        "message": (
            "Request received. Hospitals in your city can see it and may call you on this number. "
            "If this is life-threatening, call 112 now."
        ),
    }


@router.post("/hospital-license")
async def upload_license(
    email: str = Form(...),
    password: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload the license for a pending application. Sign in with the staff email and password."""
    user = db.scalar(select(User).where(User.email == email.strip().lower(), User.role == "hospital"))
    if (
        user is None
        or not user.password_hash
        or user.hospital is None
        or not verify_password(password, user.password_hash)
    ):
        raise HTTPException(401, "Incorrect email or password.")

    hospital = user.hospital
    if hospital.status != "pending":
        raise HTTPException(400, "Only pending applications can upload a license.")

    ext = TYPE_EXT.get(file.content_type or "")
    if ext is None:
        raise HTTPException(400, "Upload a PDF, JPG or PNG file.")

    data = await file.read(MAX_LICENSE_BYTES + 1)
    if len(data) > MAX_LICENSE_BYTES:
        raise HTTPException(413, "The file must be 10 MB or smaller.")
    if not data.startswith(SIGNATURES[ext]):
        raise HTTPException(400, "The file does not look like a valid PDF, JPG or PNG.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{hospital.id}-{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)

    if hospital.license_file:
        (UPLOAD_DIR / hospital.license_file.split("/")[-1]).unlink(missing_ok=True)
    hospital.license_file = name
    db.commit()
    return {"message": "License uploaded."}