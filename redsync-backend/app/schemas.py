import re
from datetime import date
from typing import Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

BloodGroup = Literal["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]
Gender = Literal["Male", "Female", "Other"]
Component = Literal["Whole Blood", "Packed Red Cells", "Platelets", "Plasma"]
FacilityType = Literal["hospital", "blood_bank", "both"]

MOBILE = r"^[6-9]\d{9}$"  # 10-digit Indian mobile number
PIN = r"^\d{6}$"
TIME = r"^([01]\d|2[0-3]):[0-5]\d$"


def age_on(dob: date, today: Optional[date] = None) -> int:
    today = today or date.today()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


# ---------------- Requests ----------------


class OtpRequestIn(BaseModel):
    phone: str = Field(pattern=MOBILE)
    purpose: Literal["register", "login"]


class DonorRegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(pattern=MOBILE)
    otp: str = Field(pattern=r"^\d{6}$")
    email: Optional[EmailStr] = None
    agree: bool

    dob: date
    gender: Gender
    weight_kg: float
    blood_group: BloodGroup

    city: str = Field(min_length=2, max_length=100)
    area: str = Field(min_length=2, max_length=100)
    pin: str = Field(pattern=PIN)
    radius_km: Literal[5, 10, 15, 25] = 10

    last_donation: Optional[date] = None
    never_donated: bool = False
    health_well_today: bool
    health_recent_illness: bool
    health_antibiotics: bool
    preferred_hospital_id: Optional[int] = None
    sms_alerts: bool = True
    whatsapp_alerts: bool = True

    @field_validator("full_name", "city", "area")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("This field is too short.")
        return value

    @field_validator("agree")
    @classmethod
    def must_agree(cls, value: bool) -> bool:
        if not value:
            raise ValueError("You must accept the Terms and Privacy Policy.")
        return value

    @field_validator("dob")
    @classmethod
    def check_age(cls, value: date) -> date:
        age = age_on(value)
        if age < 18 or age > 65:
            raise ValueError("You must be between 18 and 65 years old to donate.")
        return value

    @field_validator("weight_kg")
    @classmethod
    def check_weight(cls, value: float) -> float:
        if value <= 50:
            raise ValueError("Weight must be above 50 kg to donate.")
        if value > 200:
            raise ValueError("Enter a valid weight.")
        return value

    @model_validator(mode="after")
    def check_rest(self):
        if self.never_donated:
            self.last_donation = None
        elif self.last_donation is None:
            raise ValueError("Enter your last donation date, or say you have never donated.")
        elif self.last_donation > date.today():
            raise ValueError("The last donation date cannot be in the future.")
        elif self.last_donation < self.dob:
            raise ValueError("The last donation date cannot be before your date of birth.")

        if not (self.sms_alerts or self.whatsapp_alerts):
            raise ValueError("Choose at least one alert channel.")
        return self


class DonorLoginIn(BaseModel):
    phone: str = Field(pattern=MOBILE)
    otp: str = Field(pattern=r"^\d{6}$")


class HospitalRegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    facility_type: FacilityType
    reg_number: str = Field(min_length=4, max_length=100)
    year_established: Optional[int] = Field(default=None, ge=1800)

    address: str = Field(min_length=6)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    pin: str = Field(pattern=PIN)

    phone: str = Field(pattern=r"^\d{10,11}$")
    emergency_phone: str = Field(pattern=r"^\d{10,11}$")
    email: EmailStr
    website: Optional[str] = Field(default=None, pattern=r"^https?://\S+\.\S+$")

    components: list[Component] = Field(min_length=1)
    open_24h: bool = True
    open_time: Optional[str] = Field(default=None, pattern=TIME)
    close_time: Optional[str] = Field(default=None, pattern=TIME)

    contact_name: str = Field(min_length=3, max_length=150)
    contact_mobile: str = Field(pattern=MOBILE)
    staff_email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    authorized: bool

    @field_validator("year_established")
    @classmethod
    def check_year(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value > date.today().year:
            raise ValueError("The year cannot be in the future.")
        return value

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("Use letters and numbers in your password.")
        return value

    @field_validator("authorized")
    @classmethod
    def must_confirm(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Please confirm that you are authorized to register this facility.")
        return value

    @model_validator(mode="after")
    def check_hours(self):
        self.components = list(dict.fromkeys(self.components))  # remove duplicates
        if not self.open_24h:
            if not self.open_time or not self.close_time:
                raise ValueError("Enter opening and closing times.")
            if self.open_time == self.close_time:
                raise ValueError("Opening and closing times must be different.")
        return self


class HospitalLoginIn(BaseModel):
    facility_code: str = Field(min_length=1, max_length=20)
    email: EmailStr
    password: str = Field(min_length=1, max_length=64)


# ---------------- Responses ----------------


class DonorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dob: date
    gender: str
    weight_kg: float
    blood_group: str
    city: str
    area: str
    pin: str
    radius_km: int
    last_donation: Optional[date] = None
    never_donated: bool
    available: bool


class HospitalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    facility_type: str
    city: str
    status: str
    facility_code: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    donor: Optional[DonorOut] = None
    hospital: Optional[HospitalOut] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageOut(BaseModel):
    message: str


class OtpOut(BaseModel):
    message: str
    dev_otp: Optional[str] = None  # only filled in when DEV_MODE=true


class PublicHospitalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    facility_type: str