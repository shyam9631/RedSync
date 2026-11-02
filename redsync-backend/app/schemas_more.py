from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas import MOBILE, PIN, TIME, BloodGroup, Component

Urgency = Literal["critical", "urgent", "normal"]


# ---------------- Hospital ----------------


class StockUpdateIn(BaseModel):
    units: int = Field(ge=0, le=1000)
    expiry: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=300)

    @field_validator("expiry")
    @classmethod
    def not_past(cls, value: Optional[date]) -> Optional[date]:
        if value is not None and value < date.today():
            raise ValueError("The expiry date cannot be in the past.")
        return value


class ActiveIn(BaseModel):
    active: bool


class RequestCreateIn(BaseModel):
    blood_group: BloodGroup
    units: int = Field(ge=1, le=50)
    component: Component
    urgency: Urgency
    required_by: datetime  # send ISO 8601 with an offset, e.g. 2026-11-10T18:00:00+05:30
    notes: Optional[str] = Field(default=None, max_length=300)


class ResponseStatusIn(BaseModel):
    status: Literal["confirmed", "completed"]


class DonationCreateIn(BaseModel):
    donor_id: int
    donation_date: date
    component: Component
    units: int = Field(ge=1, le=5)
    batch_id: Optional[str] = Field(default=None, max_length=50)
    response_id: Optional[int] = None

    @field_validator("donation_date")
    @classmethod
    def not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("The donation date cannot be in the future.")
        return value


class CampCreateIn(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    camp_date: date
    start_time: str = Field(pattern=TIME)
    end_time: str = Field(pattern=TIME)
    venue: str = Field(min_length=3, max_length=200)
    target_units: int = Field(ge=1, le=1000)

    @model_validator(mode="after")
    def check(self):
        if self.camp_date < date.today():
            raise ValueError("The camp date cannot be in the past.")
        if self.end_time <= self.start_time:
            raise ValueError("The end time must be after the start time.")
        return self


# ---------------- Donor ----------------


class AvailabilityIn(BaseModel):
    available: bool


class DonorUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    weight_kg: Optional[float] = None
    city: Optional[str] = Field(default=None, min_length=2, max_length=100)
    area: Optional[str] = Field(default=None, min_length=2, max_length=100)
    pin: Optional[str] = Field(default=None, pattern=PIN)
    radius_km: Optional[Literal[5, 10, 15, 25]] = None
    sms_alerts: Optional[bool] = None
    whatsapp_alerts: Optional[bool] = None

    @field_validator("weight_kg")
    @classmethod
    def check_weight(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and (value <= 50 or value > 200):
            raise ValueError("Weight must be above 50 kg (and a realistic value).")
        return value


# ---------------- Public ----------------


class PublicRequestIn(BaseModel):
    requester_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(pattern=MOBILE)
    blood_group: BloodGroup
    units: int = Field(ge=1, le=20)
    component: Component
    urgency: Urgency
    hospital_name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=300)
    agree: bool

    @field_validator("agree")
    @classmethod
    def must_agree(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Please agree to be contacted by hospitals and donors.")
        return value


# ---------------- Admin ----------------


class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=64)