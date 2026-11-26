from datetime import date, timedelta

from app.models import BloodRequest, Donor, RequestResponse, utcnow
from app.models_more import Notification, PublicRequest
from tests.conftest import future_time


def create_request(client, hospital, *, group="O+", urgency="urgent", when=None, units=2):
    return client.post(
        "/hospital/requests",
        headers=hospital["headers"],
        json={
            "blood_group": group,
            "units": units,
            "component": "Whole Blood",
            "urgency": urgency,
            "required_by": when or future_time(),
            "notes": "Need blood",
        },
    )


def public_request(client, phone="9000001001", city="Test City"):
    return client.post(
        "/public/request-blood",
        json={
            "requester_name": "Patient Family",
            "phone": phone,
            "blood_group": "O+",
            "units": 2,
            "component": "Whole Blood",
            "urgency": "urgent",
            "hospital_name": "City Hospital",
            "city": city,
            "notes": "Please call",
            "agree": True,
        },
    )


def test_post_request_notifies_matching_donors_and_overview(client, hospital, donor, donor2, db_session):
    from app.models import Donor

    db_session.get(Donor, donor2["id"]).blood_group = "A+"
    db_session.commit()
    past = create_request(client, hospital, when="2000-01-01T00:00:00+00:00")
    assert past.status_code == 400
    response = create_request(client, hospital)
    assert response.status_code == 201
    data = response.json()
    assert data["request"]["status"] == "open"
    assert data["notified"] == 1
    notifications = db_session.query(Notification).filter_by(user_id=donor["user_id"], kind="request").count()
    assert notifications == 1
    overview = client.get("/hospital/requests/overview", headers=hospital["headers"])
    assert overview.status_code == 200
    assert overview.json()["summary"]["open"] == 1
    assert overview.json()["summary"]["waiting_for_confirmation"] == 0
    assert overview.json()["open"][0]["usable_stock"] == 0
    request_row = db_session.get(BloodRequest, data["request"]["id"])
    request_row.required_by = utcnow() - timedelta(hours=1)
    db_session.commit()
    overdue = client.get("/hospital/requests/overview", headers=hospital["headers"])
    assert overdue.json()["summary"]["overdue"] == 1
    assert overdue.json()["open"][0]["overdue"] is True


def test_accept_confirm_complete_and_phone_disclosure_only_after_accept(client, hospital, donor):
    request = create_request(client, hospital).json()["request"]
    initial = client.get("/hospital/donors", headers=hospital["headers"]).json()
    assert next(item for item in initial["donors"] if item["id"] == donor["id"])["phone"] is None
    accepted = client.post(f"/donor/requests/{request['id']}/accept", headers=donor["headers"])
    assert accepted.status_code == 200
    response_id = accepted.json()["active_response"]["response_id"]
    responders = client.get(
        f"/hospital/requests/{request['id']}/responses", headers=hospital["headers"]
    )
    assert responders.status_code == 200
    assert responders.json()[0]["phone"] == donor["phone"]
    confirmed = client.patch(
        f"/hospital/requests/{request['id']}/responses/{response_id}",
        headers=hospital["headers"],
        json={"status": "confirmed"},
    )
    assert confirmed.status_code == 200
    completed = client.patch(
        f"/hospital/requests/{request['id']}/responses/{response_id}",
        headers=hospital["headers"],
        json={"status": "completed"},
    )
    assert completed.status_code == 200
    assert completed.json()["responders"][0]["status"] == "completed"


def test_edit_notifies_accepted_responders_only_and_cancellation_notifies(client, hospital, donor, donor2, db_session):
    from app.models import Donor

    db_session.get(Donor, donor2["id"]).blood_group = "O+"
    db_session.commit()
    request = create_request(client, hospital).json()["request"]
    # A declined response is not an accepted responder and must not be notified by edit.
    client.post(f"/donor/requests/{request['id']}/decline", headers=donor2["headers"])
    client.post(f"/donor/requests/{request['id']}/accept", headers=donor["headers"])
    notes_only = client.patch(
        f"/hospital/requests/{request['id']}",
        headers=hospital["headers"],
        json={"notes": "Notes changed only"},
    )
    assert notes_only.status_code == 200 and notes_only.json()["notified"] == 0
    edit = client.patch(
        f"/hospital/requests/{request['id']}",
        headers=hospital["headers"],
        json={"urgency": "critical", "required_by": future_time(12), "notes": "Updated"},
    )
    assert edit.status_code == 200
    assert edit.json()["notified"] == 1
    cancel = client.post(f"/hospital/requests/{request['id']}/cancel", headers=hospital["headers"])
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"
    assert client.get("/donor/active-response", headers=donor["headers"]).json()["active_response"] is None
    assert any(
        item.title == "Request cancelled"
        for item in db_session.query(Notification).filter_by(user_id=donor["user_id"]).all()
    )


def test_fulfill_with_stock_is_atomic_and_enforces_request_and_usable_limits(client, hospital, db_session):
    today = date.today()
    inward = {
        "blood_group": "O+",
        "component": "Whole Blood",
        "units": 2,
        "expiry_date": (today + timedelta(days=20)).isoformat(),
    }
    assert client.post("/hospital/stock/inward", headers=hospital["headers"], json=inward).status_code == 201
    req = create_request(client, hospital, units=1).json()["request"]
    too_many = client.post(
        f"/hospital/requests/{req['id']}/fulfill-with-stock",
        headers=hospital["headers"],
        json={"issue_units": 2},
    )
    assert too_many.status_code == 400
    assert db_session.get(BloodRequest, req["id"]).status == "open"
    issued = client.post(
        f"/hospital/requests/{req['id']}/fulfill-with-stock",
        headers=hospital["headers"],
        json={"issue_units": 1},
    )
    assert issued.status_code == 200
    assert issued.json()["issued"] == 1
    stock = client.get("/hospital/stock", headers=hospital["headers"]).json()
    assert next(row for row in stock if row["group"] == "O+")["units"] == 1
    assert db_session.get(BloodRequest, req["id"]).status == "fulfilled"

    empty = create_request(client, hospital, units=1, group="A+").json()["request"]
    failed = client.post(
        f"/hospital/requests/{empty['id']}/fulfill-with-stock",
        headers=hospital["headers"],
        json={"issue_units": 1},
    )
    assert failed.status_code == 400
    assert db_session.get(BloodRequest, empty["id"]).status == "open"


def test_other_hospital_cannot_read_or_change_request(client, hospital, other_city_hospital):
    req = create_request(client, hospital).json()["request"]
    headers = other_city_hospital["headers"]
    assert client.get(f"/hospital/requests/{req['id']}/responses", headers=headers).status_code == 404
    assert client.patch(
        f"/hospital/requests/{req['id']}", headers=headers, json={"urgency": "critical"}
    ).status_code == 404
    assert client.post(f"/hospital/requests/{req['id']}/cancel", headers=headers).status_code == 404


def test_public_patient_requests_rate_limit_city_visibility_forward_and_dismiss(client, hospital, other_city_hospital, db_session):
    first = public_request(client)
    assert first.status_code == 201
    public_id = first.json()["id"]
    assert public_id in {row["id"] for row in client.get("/hospital/public-requests", headers=hospital["headers"]).json()}
    assert public_id not in {row["id"] for row in client.get("/hospital/public-requests", headers=other_city_hospital["headers"]).json()}
    assert public_request(client, "9000001001").status_code == 201
    assert public_request(client, "9000001001").status_code == 201
    assert public_request(client, "9000001001").status_code == 429
    forwarded = client.post(f"/hospital/public-requests/{public_id}/forward", headers=hospital["headers"])
    assert forwarded.status_code == 200
    assert forwarded.json()["request"]["status"] == "open"
    record = db_session.get(PublicRequest, public_id)
    assert record.status == "forwarded"
    assert db_session.query(BloodRequest).filter_by(hospital_id=hospital["id"]).count() == 1

    dismiss_id = public_request(client, "9000001004").json()["id"]
    dismissed = client.post(f"/hospital/public-requests/{dismiss_id}/dismiss", headers=hospital["headers"])
    assert dismissed.status_code == 200
    assert db_session.get(PublicRequest, dismiss_id).status == "dismissed"
