from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Donor, DonorHospitalLink, Hospital, OtpCode, User, utcnow
from app.security import (
    create_access_token,
    generate_otp,
    hash_otp,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) != 10:
        raise HTTPException(400, "Enter a valid 10-digit mobile number.")
    return digits


def _send_otp(db: Session, phone: str, purpose: str) -> str:
    otp = generate_otp()
    db.add(
        OtpCode(
            phone=phone,
            code_hash=hash_otp(phone, otp),
            purpose=purpose,
            expires_at=utcnow() + timedelta(minutes=settings.otp_minutes),
        )
    )
    db.commit()
    return otp


def _validate_otp(db: Session, phone: str, otp: str, purpose: str) -> OtpCode:
    phone = _normalize_phone(phone)
    row = db.scalar(
        select(OtpCode)
        .where(
            OtpCode.phone == phone,
            OtpCode.purpose == purpose,
            OtpCode.used.is_(False),
            OtpCode.expires_at > utcnow(),
        )
        .order_by(OtpCode.id.desc())
    )
    if row is None or row.code_hash != hash_otp(phone, otp):
        raise HTTPException(401, "Incorrect OTP code.")
    row.used = True
    return row


def _token_response(user: User) -> schemas.TokenOut:
    return schemas.TokenOut(
        access_token=create_access_token(user.id, user.role),
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/send-otp", response_model=schemas.OtpOut)
def send_otp(body: schemas.OtpRequestIn, db: Session = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    if body.purpose == "register":
        existing = db.scalar(select(User.id).where(User.phone == phone, User.role == "donor"))
        if existing:
            raise HTTPException(409, "This mobile number is already registered.")
    else:
        user = db.scalar(select(User.id).where(User.phone == phone, User.role == "donor"))
        if not user:
            raise HTTPException(404, "No donor account found for this mobile number.")

    otp = _send_otp(db, phone, body.purpose)
    return {
        "message": "OTP sent successfully.",
        "dev_otp": otp if settings.dev_mode else None,
    }


@router.post("/donor/register", response_model=schemas.TokenOut)
def donor_register(body: schemas.DonorRegisterIn, db: Session = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    _validate_otp(db, phone, body.otp, "register")

    if db.scalar(select(User.id).where(User.phone == phone, User.role == "donor")):
        raise HTTPException(409, "This donor is already registered.")

    email = body.email.lower() if body.email else None
    if email and db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "This email is already in use.")

    user = User(
        role="donor",
        name=body.full_name.strip(),
        phone=phone,
        email=email,
        is_active=True,
    )
    db.add(user)
    db.flush()

    donor = Donor(
        user_id=user.id,
        dob=body.dob,
        gender=body.gender,
        weight_kg=body.weight_kg,
        blood_group=body.blood_group,
        city=body.city.strip(),
        area=body.area.strip(),
        pin=body.pin,
        radius_km=body.radius_km,
        last_donation=body.last_donation,
        never_donated=body.never_donated,
        available=True,
        health_well_today=body.health_well_today,
        health_recent_illness=body.health_recent_illness,
        health_antibiotics=body.health_antibiotics,
        sms_alerts=body.sms_alerts,
        whatsapp_alerts=body.whatsapp_alerts,
    )
    db.add(donor)
    db.flush()

    if body.preferred_hospital_id is not None:
        hospital = db.get(Hospital, body.preferred_hospital_id)
        if hospital is None or hospital.status != "approved":
            raise HTTPException(400, "Preferred hospital is not available.")
        db.add(DonorHospitalLink(donor_id=donor.id, hospital_id=hospital.id))

    db.commit()
    db.refresh(user)
    db.refresh(donor)
    return _token_response(user)


@router.post("/donor/login", response_model=schemas.TokenOut)
def donor_login(body: schemas.DonorLoginIn, db: Session = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    _validate_otp(db, phone, body.otp, "login")

    user = db.scalar(select(User).where(User.phone == phone, User.role == "donor"))
    if user is None or not user.is_active:
        raise HTTPException(401, "Incorrect mobile number or OTP.")
    if user.donor is None:
        raise HTTPException(401, "Donor profile not found.")
    return _token_response(user)


@router.post("/hospital/register", response_model=schemas.MessageOut)
def hospital_register(body: schemas.HospitalRegisterIn, db: Session = Depends(get_db)):
    staff_email = body.staff_email.lower().strip()
    if db.scalar(select(User.id).where(User.email == staff_email, User.role == "hospital")):
        raise HTTPException(409, "This staff email is already in use.")

    reg_number = body.reg_number.strip()
    if db.scalar(select(Hospital.id).where(Hospital.reg_number == reg_number)):
        raise HTTPException(409, "This facility registration number is already in use.")

    user = User(
        role="hospital",
        name=body.contact_name.strip(),
        phone=body.contact_mobile,
        email=staff_email,
        password_hash=hash_password(body.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    hospital = Hospital(
        user_id=user.id,
        name=body.name.strip(),
        facility_type=body.facility_type,
        reg_number=reg_number,
        license_file=None,
        year_established=body.year_established,
        address=body.address.strip(),
        city=body.city.strip(),
        state=body.state.strip(),
        pin=body.pin,
        phone=body.phone,
        emergency_phone=body.emergency_phone,
        email=body.email.lower().strip(),
        website=body.website.strip() if body.website else None,
        components=",".join(body.components),
        open_24h=body.open_24h,
        open_time=body.open_time,
        close_time=body.close_time,
        contact_name=body.contact_name.strip(),
        contact_mobile=body.contact_mobile,
        status="pending",
    )
    db.add(hospital)
    db.commit()
    return {"message": "Your hospital application has been submitted and is waiting for admin approval."}


@router.post("/hospital/login", response_model=schemas.TokenOut)
def hospital_login(body: schemas.HospitalLoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower().strip(), User.role == "hospital"))
    if user is None or not user.password_hash or not user.hospital:
        raise HTTPException(401, "Incorrect email or password.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    if user.hospital.facility_code != body.facility_code.strip():
        raise HTTPException(401, "Incorrect facility code.")
    if user.hospital.status != "approved":
        raise HTTPException(403, "Your hospital account is not approved yet.")
    return _token_response(user)
