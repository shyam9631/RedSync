import hmac
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
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

from app.sms import SmsError, send_otp_sms, shows_otp_in_response

log = logging.getLogger("redsync.auth")

router = APIRouter(prefix="/auth", tags=["Auth"])


def _normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) != 10:
        raise HTTPException(400, "Enter a valid 10-digit mobile number.")
    return digits


MAX_OTP_ATTEMPTS = 5  # wrong guesses allowed per code
MAX_OTPS_PER_10_MIN = 5  # codes that can be requested per phone number


def _send_otp(db: Session, phone: str, purpose: str) -> str:
    recent = db.scalar(
        select(func.count(OtpCode.id)).where(
            OtpCode.phone == phone,
            OtpCode.created_at > utcnow() - timedelta(minutes=10),
        )
    ) or 0
    if recent >= MAX_OTPS_PER_10_MIN:
        raise HTTPException(429, "Too many OTP requests. Please wait a few minutes and try again.")

    otp = generate_otp()
    row = OtpCode(
        phone=phone,
        code_hash=hash_otp(phone, otp),
        purpose=purpose,
        expires_at=utcnow() + timedelta(minutes=settings.otp_minutes),
    )
    db.add(row)
    db.commit()

    try:
        send_otp_sms(phone, otp)
    except SmsError as err:
        # Nothing reached the phone, so remove the code. It must not count towards the
        # "5 codes in 10 minutes" limit, and nobody can use a code they never received.
        log.error("OTP SMS to ...%s failed: %s", phone[-4:], err)
        db.delete(row)
        db.commit()
        raise HTTPException(503, "We could not send the OTP right now. Please try again in a minute.")
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
    if row is None:
        raise HTTPException(401, "This OTP has expired or was not requested. Please request a new one.")
    if row.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(429, "Too many wrong attempts. Please request a new OTP.")
    if not hmac.compare_digest(row.code_hash, hash_otp(phone, otp)):
        # Count the wrong guess. Without this a 6-digit code can be brute-forced.
        row.attempts += 1
        db.commit()
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
        "dev_otp": otp if shows_otp_in_response() else None,
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
    db.commit()  # saves "used", so the same OTP cannot log in twice

    user = db.scalar(select(User).where(User.phone == phone, User.role == "donor"))
    if user is None or not user.is_active:
        raise HTTPException(401, "Incorrect mobile number or OTP.")
    if user.donor is None:
        raise HTTPException(401, "Donor profile not found.")
    return _token_response(user)


@router.post("/hospital/register", response_model=schemas.MessageOut)
def hospital_register(body: schemas.HospitalRegisterIn, db: Session = Depends(get_db)):
    staff_email = body.staff_email.lower().strip()
    # users.email is unique across ALL roles, so check every role (a donor may use the same email)
    if db.scalar(select(User.id).where(User.email == staff_email)):
        raise HTTPException(409, "This staff email is already in use.")

    reg_number = body.reg_number.strip()
    if db.scalar(select(Hospital.id).where(Hospital.reg_number == reg_number)):
        raise HTTPException(409, "This facility registration number is already in use.")

    user = User(
        role="hospital",
        name=body.contact_name.strip(),
        # users.phone is unique across all roles and is the donor login key. The contact number
        # is kept on the hospital row, so a hospital never blocks (or crashes on) a donor's number.
        phone=None,
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
    if user is None or not user.is_active or not user.password_hash or not user.hospital:
        raise HTTPException(401, "Incorrect email or password.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    # Check approval first: a pending hospital has no facility code yet, so it cannot know one
    if user.hospital.status != "approved":
        raise HTTPException(403, "Your hospital account is not approved yet.")
    if user.hospital.facility_code != body.facility_code.strip():
        raise HTTPException(401, "Incorrect facility code.")
    return _token_response(user)


# ---------------- forgot password (hospitals) ----------------

RESET_PURPOSE = "hosp_reset"


def _hospital_for_reset(db: Session, facility_code: str, email: str):
    """The staff user whose facility code and email both match, or None."""
    user = db.scalar(select(User).where(User.email == email.lower().strip(), User.role == "hospital"))
    if user is None or not user.is_active or not user.hospital:
        return None
    if user.hospital.facility_code != facility_code.strip():
        return None
    return user


@router.post("/hospital/forgot-password", response_model=schemas.OtpOut)
def hospital_forgot_password(body: schemas.HospitalForgotIn, db: Session = Depends(get_db)):
    """Sends a reset OTP to the mobile number the hospital registered with.

    The reply is the same whether or not the details matched, so nobody can use this
    to find out which facility codes or emails exist.
    """
    message = (
        "If these details match a hospital account, an OTP has been sent to its "
        "registered contact mobile number."
    )
    user = _hospital_for_reset(db, body.facility_code, body.email)
    if user is None:
        return {"message": message, "dev_otp": None}

    phone = "".join(ch for ch in user.hospital.contact_mobile if ch.isdigit())[-10:]
    otp = _send_otp(db, phone, RESET_PURPOSE)
    return {"message": message, "dev_otp": otp if shows_otp_in_response() else None}


@router.post("/hospital/reset-password")
def hospital_reset_password(body: schemas.HospitalResetIn, db: Session = Depends(get_db)):
    user = _hospital_for_reset(db, body.facility_code, body.email)
    if user is None:
        # Same wording as an expired code, so this does not reveal whether the account exists
        raise HTTPException(401, "This OTP has expired or was not requested. Please request a new one.")

    phone = "".join(ch for ch in user.hospital.contact_mobile if ch.isdigit())[-10:]
    _validate_otp(db, phone, body.otp, RESET_PURPOSE)
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Your password has been changed. You can now sign in."}