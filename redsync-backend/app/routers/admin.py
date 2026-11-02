from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas, schemas_more as sm
from app.database import get_db
from app.deps import require_role
from app.models import (
    BloodRequest,
    BloodStock,
    Donation,
    Hospital,
    User,
    utcnow,
)
from app.security import create_access_token, verify_password
from app.utils import BLOOD_GROUPS, UPLOAD_DIR, iso, notify

router = APIRouter(prefix="/admin", tags=["Admin"])

admin_only = require_role("admin")


@router.post("/login", response_model=schemas.TokenOut)
def admin_login(body: sm.AdminLoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower(), User.role == "admin"))
    if (
        user is None
        or not user.is_active
        or not user.password_hash
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(401, "Incorrect email or password.")
    return schemas.TokenOut(
        access_token=create_access_token(user.id, user.role),
        user=schemas.UserOut.model_validate(user),
    )


def _hospital_row(h: Hospital) -> dict:
    return {
        "id": h.id,
        "name": h.name,
        "facility_type": h.facility_type,
        "reg_number": h.reg_number,
        "address": h.address,
        "city": h.city,
        "state": h.state,
        "pin": h.pin,
        "phone": h.phone,
        "emergency_phone": h.emergency_phone,
        "email": h.email,
        "website": h.website,
        "components": [c for c in h.components.split(",") if c],
        "contact_name": h.contact_name,
        "contact_mobile": h.contact_mobile,
        "staff_email": h.user.email,
        "status": h.status,
        "facility_code": h.facility_code,
        "license_uploaded": bool(h.license_file),
        "created_at": iso(h.created_at),
    }


@router.get("/stats")
def stats(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    def count(model, *conditions):
        return db.scalar(select(func.count(model.id)).where(*conditions)) or 0

    return {
        "donors": count(User, User.role == "donor"),
        "hospitals": {
            "pending": count(Hospital, Hospital.status == "pending"),
            "approved": count(Hospital, Hospital.status == "approved"),
            "rejected": count(Hospital, Hospital.status == "rejected"),
        },
        "open_requests": count(BloodRequest, BloodRequest.status == "open"),
        "donations": count(Donation),
    }


@router.get("/hospitals")
def list_hospitals(
    status: Optional[Literal["pending", "approved", "rejected"]] = "pending",
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    query = select(Hospital).order_by(Hospital.id.desc())
    if status:
        query = query.where(Hospital.status == status)
    return [_hospital_row(h) for h in db.scalars(query).all()]


@router.post("/hospitals/{hospital_id}/approve")
def approve(hospital_id: int, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    hospital = db.get(Hospital, hospital_id)
    if hospital is None:
        raise HTTPException(404, "Hospital not found.")

    if hospital.status != "approved":
        hospital.status = "approved"
        hospital.approved_at = utcnow()
        hospital.facility_code = f"HSP-{hospital.id:04d}"

        existing = {s.blood_group for s in hospital.stock}
        for group in BLOOD_GROUPS:
            if group not in existing:
                db.add(BloodStock(hospital_id=hospital.id, blood_group=group, units=0))
        notify(db, hospital.user_id, "Application approved", f"Your facility code is {hospital.facility_code}.", "info")
        db.commit()

    # There is no email service yet, so pass the facility code on to the staff member yourself
    return {
        "message": "Approved.",
        "facility_code": hospital.facility_code,
        "staff_email": hospital.user.email,
    }


@router.post("/hospitals/{hospital_id}/reject")
def reject(hospital_id: int, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    hospital = db.get(Hospital, hospital_id)
    if hospital is None:
        raise HTTPException(404, "Hospital not found.")
    if hospital.status == "approved":
        raise HTTPException(409, "This hospital is already approved.")
    hospital.status = "rejected"
    db.commit()
    return {"message": "Rejected."}


@router.get("/hospitals/{hospital_id}/license")
def get_license(hospital_id: int, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    hospital = db.get(Hospital, hospital_id)
    if hospital is None or not hospital.license_file:
        raise HTTPException(404, "No license uploaded.")

    path = (UPLOAD_DIR / hospital.license_file).resolve()
    if path.parent != UPLOAD_DIR.resolve() or not path.is_file():
        raise HTTPException(404, "License file not found.")
    return FileResponse(path)