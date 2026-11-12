from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import utcnow


class Notification(Base):
    """One item in a user's notification bell."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(150))
    text: Mapped[str] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(20), default="info")  # info | request | donation | camp
    ref_id: Mapped[Optional[int]] = mapped_column(Integer)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Camp(Base):
    """A donation camp organised by a hospital."""

    __tablename__ = "camps"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    title: Mapped[str] = mapped_column(String(150))
    camp_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))
    venue: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(100), index=True)
    target_units: Mapped[int] = mapped_column(Integer, default=50)
    status: Mapped[str] = mapped_column(String(10), default="active")  # active | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CampRegistration(Base):
    __tablename__ = "camp_registrations"
    __table_args__ = (UniqueConstraint("camp_id", "donor_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    camp_id: Mapped[int] = mapped_column(ForeignKey("camps.id"), index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("donors.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PublicRequest(Base):
    """A blood request from a patient's family who is not logged in. Hospitals review these."""

    __tablename__ = "public_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(15), index=True)
    blood_group: Mapped[str] = mapped_column(String(3))
    units: Mapped[int] = mapped_column(Integer)
    component: Mapped[str] = mapped_column(String(30))
    urgency: Mapped[str] = mapped_column(String(10))
    hospital_name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(100), index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(15), default="open", index=True)  # open | forwarded | dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class StockBatch(Base):
    """One lot of blood received by a hospital (a donation, a camp, a transfer in ...).

    The total for a blood group stays in BloodStock.units. Batches say what that total is made of
    (component and expiry date). Units entered before batches existed are "not specified".
    """

    __tablename__ = "stock_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    blood_group: Mapped[str] = mapped_column(String(3), index=True)
    component: Mapped[str] = mapped_column(String(30))
    units_received: Mapped[int] = mapped_column(Integer)
    units_remaining: Mapped[int] = mapped_column(Integer)
    expiry_date: Mapped[date] = mapped_column(Date, index=True)
    batch_code: Mapped[Optional[str]] = mapped_column(String(50))
    storage: Mapped[Optional[str]] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual | donation | camp | transfer
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class StockLedger(Base):
    """Every change to a hospital's stock, newest last. Never edited, so it works as an audit trail."""

    __tablename__ = "stock_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    blood_group: Mapped[str] = mapped_column(String(3), index=True)
    component: Mapped[Optional[str]] = mapped_column(String(30))  # empty for plain total corrections
    kind: Mapped[str] = mapped_column(String(10), index=True)  # inward | outward | discard | adjust
    delta: Mapped[int] = mapped_column(Integer)  # + for stock in, - for stock out
    balance_after: Mapped[int] = mapped_column(Integer)  # the blood group total afterwards
    reason: Mapped[str] = mapped_column(String(80))
    batch_code: Mapped[Optional[str]] = mapped_column(String(50))
    note: Mapped[Optional[str]] = mapped_column(String(300))
    recorded_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class StockTarget(Base):
    """The number of units a hospital wants to hold for a blood group."""

    __tablename__ = "stock_targets"
    __table_args__ = (UniqueConstraint("hospital_id", "blood_group"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    blood_group: Mapped[str] = mapped_column(String(3))
    target_units: Mapped[int] = mapped_column(Integer)