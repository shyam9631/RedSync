from datetime import timedelta

from app.models import OtpCode, User, utcnow
from tests.conftest import donor_payload


def register_donor(client, payload=None):
    payload = payload or donor_payload()
    sent = client.post("/auth/send-otp", json={"phone": payload["phone"], "purpose": "register"})
    assert sent.status_code == 200
    payload["otp"] = sent.json()["dev_otp"]
    return payload, client.post("/auth/donor/register", json=payload)


def test_donor_register_login_wrong_code_and_reuse(client):
    payload, registered = register_donor(client)
    assert registered.status_code == 200
    assert registered.json()["user"]["role"] == "donor"
    assert registered.json()["user"]["donor"]["blood_group"] == "O+"

    sent = client.post("/auth/send-otp", json={"phone": payload["phone"], "purpose": "login"})
    otp = sent.json()["dev_otp"]
    wrong_code = f"{(int(otp) + 1) % 1_000_000:06d}"
    wrong = client.post("/auth/donor/login", json={"phone": payload["phone"], "otp": wrong_code})
    assert wrong.status_code == 401
    login = client.post("/auth/donor/login", json={"phone": payload["phone"], "otp": otp})
    assert login.status_code == 200
    reused = client.post("/auth/donor/login", json={"phone": payload["phone"], "otp": otp})
    assert reused.status_code == 401


def test_otp_wrong_guess_limit_expiry_and_rate_limit(client, db_session):
    phone = "9000000001"
    sent = client.post("/auth/send-otp", json={"phone": phone, "purpose": "register"})
    wrong_code = f"{(int(sent.json()['dev_otp']) + 1) % 1_000_000:06d}"
    for _ in range(5):
        response = client.post("/auth/donor/register", json={**donor_payload(phone), "otp": wrong_code})
        assert response.status_code == 401
    locked = client.post("/auth/donor/register", json={**donor_payload(phone), "otp": "000000"})
    assert locked.status_code == 429

    expired_phone = "9000000002"
    issued = client.post("/auth/send-otp", json={"phone": expired_phone, "purpose": "register"})
    row = db_session.query(OtpCode).filter_by(phone=expired_phone).one()
    row.expires_at = utcnow() - timedelta(seconds=1)
    db_session.commit()
    expired = client.post(
        "/auth/donor/register",
        json={**donor_payload(expired_phone), "otp": issued.json()["dev_otp"]},
    )
    assert expired.status_code == 401

    limited_phone = "9000000003"
    for _ in range(5):
        assert client.post(
            "/auth/send-otp", json={"phone": limited_phone, "purpose": "register"}
        ).status_code == 200
    too_many = client.post(
        "/auth/send-otp", json={"phone": limited_phone, "purpose": "register"}
    )
    assert too_many.status_code == 429


def test_donor_duplicate_phone_and_underage_rejected(client):
    payload, registered = register_donor(client)
    assert registered.status_code == 200
    again = client.post("/auth/send-otp", json={"phone": payload["phone"], "purpose": "register"})
    assert again.status_code == 409
    underage = donor_payload(phone="9000000004", dob="2015-01-01")
    sent = client.post("/auth/send-otp", json={"phone": underage["phone"], "purpose": "register"})
    underage["otp"] = sent.json()["dev_otp"]
    response = client.post("/auth/donor/register", json=underage)
    assert response.status_code == 422


def test_hospital_registration_login_approval_and_credentials(client, make_hospital):
    pending = make_hospital(index=40, approved=False)
    body = {
        "facility_code": pending["facility_code"],
        "email": pending["email"],
        "password": pending["password"],
    }
    pending_login = client.post("/auth/hospital/login", json=body)
    assert pending_login.status_code == 403
    assert "not approved" in pending_login.json()["detail"].lower()
    wrong_pending_code = client.post(
        "/auth/hospital/login", json={**body, "facility_code": "WRONG"}
    )
    assert wrong_pending_code.status_code == 403
    assert "not approved" in wrong_pending_code.json()["detail"].lower()
    wrong_pending_password = client.post(
        "/auth/hospital/login", json={**body, "password": "WrongPass123"}
    )
    assert wrong_pending_password.status_code == 401
    assert client.post("/auth/hospital/login", json={**body, "email": "nobody@example.com"}).status_code == 401

    approved = make_hospital(index=41)
    approved_body = {
        "facility_code": approved["facility_code"],
        "email": approved["email"],
        "password": approved["password"],
    }
    wrong_approved_code = client.post(
        "/auth/hospital/login",
        json={**approved_body, "facility_code": "WRONG"},
    )
    assert wrong_approved_code.status_code == 401
    response = client.post(
        "/auth/hospital/login",
        json=approved_body,
    )
    assert response.status_code == 200
    assert response.json()["user"]["hospital"]["status"] == "approved"


def test_hospital_forgot_password_responses_and_reset(client, hospital, db_session):
    right = {"facility_code": hospital["facility_code"], "email": hospital["email"]}
    unknown = {"facility_code": "HSP-9999", "email": "unknown@example.com"}
    wrong_reply = client.post("/auth/hospital/forgot-password", json=unknown)
    right_reply = client.post("/auth/hospital/forgot-password", json=right)
    assert wrong_reply.status_code == right_reply.status_code == 200
    assert wrong_reply.json()["message"] == right_reply.json()["message"]
    otp = right_reply.json()["dev_otp"]

    reset = client.post(
        "/auth/hospital/reset-password",
        json={**right, "otp": otp, "new_password": "NewStrongPass456"},
    )
    assert reset.status_code == 200
    assert client.post(
        "/auth/hospital/login",
        json={**right, "password": hospital["password"]},
    ).status_code == 401
    assert client.post(
        "/auth/hospital/login",
        json={**right, "password": "NewStrongPass456"},
    ).status_code == 200
    reused = client.post(
        "/auth/hospital/reset-password",
        json={**right, "otp": otp, "new_password": "AnotherStrong789"},
    )
    assert reused.status_code == 401

    weak_code = client.post("/auth/hospital/forgot-password", json=right).json()["dev_otp"]
    weak = client.post(
        "/auth/hospital/reset-password",
        json={**right, "otp": weak_code, "new_password": "password"},
    )
    assert weak.status_code == 422
    bad_otp = client.post(
        "/auth/hospital/reset-password",
        json={**right, "otp": "999999", "new_password": "ValidPass789"},
    )
    assert bad_otp.status_code == 401


def test_role_separation_and_missing_token(client, hospital, donor):
    assert client.get("/hospital/me", headers=donor["headers"]).status_code == 403
    assert client.get("/donor/profile", headers=hospital["headers"]).status_code == 403
    assert client.get("/donor/profile").status_code == 401
    assert client.get("/hospital/me").status_code == 401


def test_otp_is_stored_as_a_hash_not_plaintext(client, db_session):
    phone = "9000000005"
    response = client.post("/auth/send-otp", json={"phone": phone, "purpose": "register"})
    code = response.json()["dev_otp"]
    row = db_session.query(OtpCode).filter_by(phone=phone).one()
    assert row.code_hash != code
    assert len(row.code_hash) == 64
