from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings
from app.models import OtpCode, User
from tests.conftest import donor_payload


def test_password_hash_is_bcrypt_and_not_plaintext(client, hospital, db_session):
    user = db_session.query(User).filter_by(email=hospital["email"]).one()
    assert user.password_hash != hospital["password"]
    assert user.password_hash.startswith("$2")


def test_invalid_signature_and_expired_tokens_are_rejected(client, donor):
    bad_signature = jwt.encode(
        {"sub": str(donor["user_id"]), "role": "donor", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "incorrect-signing-key-for-tests-32-characters",
        algorithm="HS256",
    )
    expired = jwt.encode(
        {"sub": str(donor["user_id"]), "role": "donor", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
        settings.secret_key,
        algorithm="HS256",
    )
    for token in (bad_signature, expired):
        response = client.get("/donor/profile", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


def test_sql_injection_style_inputs_do_not_crash(client):
    search = client.get("/public/find-blood?location=%27%20OR%201%3D1--")
    assert search.status_code == 200
    login = client.post(
        "/auth/hospital/login",
        json={
            "facility_code": "' OR 1=1 --",
            "email": "x' OR '1'='1@example.com",
            "password": "' OR 1=1 --",
        },
    )
    assert login.status_code in {401, 422}
    otp = client.post(
        "/auth/send-otp",
        json={"phone": "9000001234", "purpose": "register"},
    )
    assert otp.status_code == 200
    body = donor_payload(phone="9000001234")
    body["full_name"] = "' OR 1=1 --"
    body["otp"] = otp.json()["dev_otp"]
    registered = client.post("/auth/donor/register", json=body)
    assert registered.status_code == 200


def test_oversized_and_invalid_inputs_return_validation_errors(client):
    invalid_otp = client.post(
        "/auth/send-otp", json={"phone": "not-a-phone", "purpose": "register"}
    )
    assert invalid_otp.status_code == 422
    oversized = client.post(
        "/auth/donor/register",
        json={
            **donor_payload(phone="9000002222"),
            "full_name": "D" * 10000,
        },
    )
    assert oversized.status_code == 422
    invalid_public = client.post(
        "/public/request-blood",
        json={
            "requester_name": "Family",
            "phone": "9000001234",
            "blood_group": "INVALID",
            "units": 2,
            "component": "Whole Blood",
            "urgency": "urgent",
            "hospital_name": "Hospital",
            "city": "Test City",
            "agree": True,
        },
    )
    assert invalid_public.status_code == 422


def test_donor_otp_hash_is_not_the_code(client, db_session):
    sent = client.post("/auth/send-otp", json={"phone": "9000003333", "purpose": "register"})
    assert sent.status_code == 200
    code = sent.json()["dev_otp"]
    row = db_session.query(OtpCode).filter_by(phone="9000003333").one()
    assert row.code_hash != code
    assert row.code_hash != "000000"
