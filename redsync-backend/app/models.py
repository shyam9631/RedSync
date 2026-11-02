from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Current time in UTC, stored without a timezone label."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    """One login account per person: a donor, hospital staff member or admin."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(20), index=True)  # donor | hospital | admin
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[Optional[str]] = mapped_column(String(15), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))  # donors use OTP instead
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    donor: Mapped[Optional["Donor"]] = relationship(back_populates="user", uselist=False)
    hospital: Mapped[Optional["Hospital"]] = relationship(back_populates="user", uselist=False)


class Donor(Base):
    __tablename__ = "donors"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)

    dob: Mapped[date] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(10))
    weight_kg: Mapped[float] = mapped_column(Float)
    blood_group: Mapped[str] = mapped_column(String(3), index=True)

    city: Mapped[str] = mapped_column(String(100), index=True)
    area: Mapped[str] = mapped_column(String(100))
    pin: Mapped[str] = mapped_column(String(6))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    radius_km: Mapped[int] = mapped_column(Integer, default=10)

    last_donation: Mapped[Optional[date]] = mapped_column(Date)
    never_donated: Mapped[bool] = mapped_column(Boolean, default=False)
    available: Mapped[bool] = mapped_column(Boolean, default=True)

    health_well_today: Mapped[Optional[bool]] = mapped_column(Boolean)
    health_recent_illness: Mapped[Optional[bool]] = mapped_column(Boolean)
    health_antibiotics: Mapped[Optional[bool]] = mapped_column(Boolean)

    sms_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    whatsapp_alerts: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="donor")
    hospital_links: Mapped[list["DonorHospitalLink"]] = relationship(back_populates="donor")
    responses: Mapped[list["RequestResponse"]] = relationship(back_populates="donor")
    donations: Mapped[list["Donation"]] = relationship(back_populates="donor")


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)  # staff login

    name: Mapped[str] = mapped_column(String(200))
    facility_type: Mapped[str] = mapped_column(String(20))  # hospital | blood_bank | both
    reg_number: Mapped[str] = mapped_column(String(100))
    license_file: Mapped[Optional[str]] = mapped_column(String(255))
    year_established: Mapped[Optional[int]] = mapped_column(Integer)

    address: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), index=True)
    state: Mapped[str] = mapped_column(String(100))
    pin: Mapped[str] = mapped_column(String(6))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)

    phone: Mapped[str] = mapped_column(String(15))
    emergency_phone: Mapped[str] = mapped_column(String(15))
    email: Mapped[str] = mapped_column(String(255))
    website: Mapped[Optional[str]] = mapped_column(String(255))

    components: Mapped[str] = mapped_column(String(200), default="")  # comma separated
    open_24h: Mapped[bool] = mapped_column(Boolean, default=True)
    open_time: Mapped[Optional[str]] = mapped_column(String(5))  # "08:00"
    close_time: Mapped[Optional[str]] = mapped_column(String(5))

    contact_name: Mapped[str] = mapped_column(String(150))
    contact_mobile: Mapped[str] = mapped_column(String(15))

    # Filled in when an admin approves the application
    facility_code: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(15), default="pending", index=True)  # pending | approved | rejected
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="hospital")
    stock: Mapped[list["BloodStock"]] = relationship(back_populates="hospital")
    requests: Mapped[list["BloodRequest"]] = relationship(back_populates="hospital")
    donor_links: Mapped[list["DonorHospitalLink"]] = relationship(back_populates="hospital")
    donations: Mapped[list["Donation"]] = relationship(back_populates="hospital")


class OtpCode(Base):
    """Short-lived login code. Only a hash of the code is stored."""

    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(15), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    purpose: Mapped[str] = mapped_column(String(20), default="login")  # login | register
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class BloodStock(Base):
    """Units held by one hospital for one blood group (8 rows per hospital)."""

    __tablename__ = "blood_stock"
    __table_args__ = (UniqueConstraint("hospital_id", "blood_group"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    blood_group: Mapped[str] = mapped_column(String(3))
    units: Mapped[int] = mapped_column(Integer, default=0)
    expiry: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    hospital: Mapped["Hospital"] = relationship(back_populates="stock")


class BloodRequest(Base):
    """An urgent request posted by a hospital."""

    __tablename__ = "blood_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    blood_group: Mapped[str] = mapped_column(String(3), index=True)
    units: Mapped[int] = mapped_column(Integer)
    component: Mapped[str] = mapped_column(String(30))
    urgency: Mapped[str] = mapped_column(String(10))  # critical | urgent | normal
    required_by: Mapped[datetime] = mapped_column(DateTime)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(15), default="open", index=True)  # open | fulfilled | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    hospital: Mapped["Hospital"] = relationship(back_populates="requests")
    responses: Mapped[list["RequestResponse"]] = relationship(back_populates="request")


class RequestResponse(Base):
    """A donor's answer to a request, including the three-step progress."""

    __tablename__ = "request_responses"
    __table_args__ = (UniqueConstraint("request_id", "donor_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("blood_requests.id"), index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"), index=True)
    # accepted -> confirmed (by hospital) -> completed, or declined / cancelled
    status: Mapped[str] = mapped_column(String(15), default="accepted")
    responded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    request: Mapped["BloodRequest"] = relationship(back_populates="responses")
    donor: Mapped["Donor"] = relationship(back_populates="responses")


class Donation(Base):
    """A donation recorded by a hospital."""

    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"), index=True)
    donation_date: Mapped[date] = mapped_column(Date)
    component: Mapped[str] = mapped_column(String(30))
    units: Mapped[int] = mapped_column(Integer, default=1)
    batch_id: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    hospital: Mapped["Hospital"] = relationship(back_populates="donations")
    donor: Mapped["Donor"] = relationship(back_populates="donations")


class DonorHospitalLink(Base):
    """Which hospital a donor chose, and whether that hospital marked them Active."""

    __tablename__ = "donor_hospital_links"
    __table_args__ = (UniqueConstraint("donor_id", "hospital_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"), index=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)  # set only by the hospital
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    donor: Mapped["Donor"] = relationship(back_populates="hospital_links")
    hospital: Mapped["Hospital"] = relationship(back_populates="donor_links")


class ActivityLog(Base):
    """Feeds the "Recent activity" card on the hospital dashboard."""

    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    icon: Mapped[str] = mapped_column(String(30))
    tone: Mapped[str] = mapped_column(String(10))  # neutral | good | alert
    text: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)