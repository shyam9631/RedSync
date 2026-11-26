import os
import tempfile
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# These must be set before importing app: its SQLAlchemy engine is created at import time.
_database_file = Path(tempfile.gettempdir()) / f"redsync-tests-{uuid.uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_database_file.as_posix()}"
os.environ["DEV_MODE"] = "true"
os.environ["SMS_PROVIDER"] = "console"
os.environ["SECRET_KEY"] = f"pytest-{uuid.uuid4().hex}-signing-secret"

import pytest
from fastapi.testclient import TestClient

from app import models, models_more
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import BloodStock, Hospital, OtpCode, User, utcnow
from app.models_more import Notification
from app.utils import BLOOD_GROUPS, notify


_phone_counter = iter(range(0, 1000000))


def phone_number():
    return str(9000000000 + next(_phone_counter))


def future_time(hours=24):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def hospital_payload(index=1, **overrides):
    payload = {
        "name": f"Test Hospital {index}",
        "facility_type": "hospital",
        "reg_number": f"REG-{index:06d}",
        "year_established": 2000,
        "address": f"{index} Test Street",
        "city": "Test City" if index != 3 else "Other City",
        "state": "Test State",
        "pin": "560001" if index != 3 else "411001",
        "phone": f"800000{index:04d}",
        "emergency_phone": f"810000{index:04d}",
        "email": f"facility{index}@example.com",
        "website": "https://hospital.example.com",
        "components": ["Whole Blood", "Packed Red Cells", "Platelets", "Plasma"],
        "open_24h": True,
        "contact_name": f"Contact Person {index}",
        "contact_mobile": f"820000{index:04d}",
        "staff_email": f"staff{index}@example.com",
        "password": "StrongPass123",
        "authorized": True,
    }
    payload.update(overrides)
    return payload


def donor_payload(phone=None, **overrides):
    payload = {
        "full_name": "Test Donor",
        "phone": phone or phone_number(),
        "otp": "000000",
        "email": None,
        "agree": True,
        "dob": date.today().replace(year=date.today().year - 30).isoformat(),
        "gender": "Male",
        "weight_kg": 65,
        "blood_group": "O+",
        "city": "Test City",
        "area": "Central",
        "pin": "560001",
        "radius_km": 10,
        "never_donated": True,
        "health_well_today": True,
        "health_recent_illness": False,
        "health_antibiotics": False,
    }
    payload.update(overrides)
    return payload


def approve_hospital(db, hospital):
    """Apply the approval transition used by scripts/approve_hospital.py."""
    hospital.status = "approved"
    hospital.approved_at = utcnow()
    hospital.facility_code = f"HSP-{hospital.id:04d}"
    existing = {row.blood_group for row in hospital.stock}
    for group in BLOOD_GROUPS:
        if group not in existing:
            db.add(BloodStock(hospital_id=hospital.id, blood_group=group, units=0))
    notify(
        db,
        hospital.user_id,
        "Application approved",
        f"Your facility code is {hospital.facility_code}.",
        "info",
    )
    db.commit()
    db.refresh(hospital)
    return hospital


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(client):
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def make_hospital(client, db_session):
    created = 0

    def factory(*, city=None, index=None, approved=True):
        nonlocal created
        created += 1
        n = index or created
        payload = hospital_payload(n, **({"city": city} if city else {}))
        registered = client.post("/auth/hospital/register", json=payload)
        assert registered.status_code == 200, registered.text
        hospital = db_session.query(Hospital).filter_by(reg_number=payload["reg_number"]).one()
        if approved:
            approve_hospital(db_session, hospital)
        login = client.post(
            "/auth/hospital/login",
            json={
                "facility_code": hospital.facility_code or f"HSP-{hospital.id:04d}",
                "email": payload["staff_email"],
                "password": payload["password"],
            },
        )
        return {
            "id": hospital.id,
            "headers": {"Authorization": f"Bearer {login.json()['access_token']}"} if login.status_code == 200 else {},
            "facility_code": hospital.facility_code or f"HSP-{hospital.id:04d}",
            "email": payload["staff_email"],
            "password": payload["password"],
            "payload": payload,
        }

    return factory


@pytest.fixture
def hospital(make_hospital):
    return make_hospital(index=1)


@pytest.fixture
def same_city_hospital(make_hospital):
    return make_hospital(index=2)


@pytest.fixture
def other_city_hospital(make_hospital):
    return make_hospital(index=3)


@pytest.fixture
def pending_hospital(make_hospital):
    return make_hospital(index=4, approved=False)


@pytest.fixture
def make_donor(client, db_session):
    created = 0

    def factory(**overrides):
        nonlocal created
        created += 1
        payload = donor_payload(**overrides)
        otp_response = client.post(
            "/auth/send-otp", json={"phone": payload["phone"], "purpose": "register"}
        )
        assert otp_response.status_code == 200, otp_response.text
        payload["otp"] = otp_response.json()["dev_otp"]
        response = client.post("/auth/donor/register", json=payload)
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        user = db_session.query(User).filter_by(phone=payload["phone"]).one()
        return {
            "id": user.donor.id,
            "user_id": user.id,
            "phone": payload["phone"],
            "headers": {"Authorization": f"Bearer {token}"},
            "token": token,
            "payload": payload,
        }

    return factory


@pytest.fixture
def donor(make_donor):
    return make_donor()


@pytest.fixture
def donor2(make_donor):
    return make_donor(full_name="Second Donor")


@pytest.fixture
def female_donor(make_donor):
    return make_donor(full_name="Female Donor", gender="Female", blood_group="A+")


@pytest.fixture(scope="session", autouse=True)
def remove_test_database():
    yield
    engine.dispose()
    try:
        _database_file.unlink(missing_ok=True)
    except PermissionError:
        pass
