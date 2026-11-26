from datetime import date, timedelta

from app.models import BloodRequest, Donation, Hospital, RequestResponse
from app.models_more import Camp, CampRegistration
from tests.conftest import future_time


def post_request(client, headers, *, group="O+", city=None, urgency="urgent"):
    return client.post(
        "/hospital/requests",
        headers=headers,
        json={
            "blood_group": group,
            "units": 2,
            "component": "Whole Blood",
            "urgency": urgency,
            "required_by": future_time(),
            "notes": "Urgent care",
        },
    )


def test_profile_update_and_availability(client, donor):
    profile = client.get("/donor/profile", headers=donor["headers"])
    assert profile.status_code == 200
    assert profile.json()["phone"] == donor["phone"]
    updated = client.put(
        "/donor/profile",
        headers=donor["headers"],
        json={"name": "Updated Donor", "city": "New City", "weight_kg": 70},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Donor"
    assert updated.json()["city"] == "New City"
    off = client.patch("/donor/availability", headers=donor["headers"], json={"available": False})
    assert off.status_code == 200 and off.json()["available"] is False
    assert client.get("/donor/profile", headers=donor["headers"]).json()["available"] is False


def test_eligibility_intervals_for_men_and_women(client, donor, female_donor, db_session):
    from app.models import Donor

    male = db_session.get(Donor, donor["id"])
    female = db_session.get(Donor, female_donor["id"])
    male.never_donated = False
    male.last_donation = date.today() - timedelta(days=89)
    female.never_donated = False
    female.last_donation = date.today() - timedelta(days=119)
    db_session.commit()
    male_status = client.get("/donor/profile", headers=donor["headers"])
    female_status = client.get("/donor/dashboard", headers=female_donor["headers"])
    assert male_status.status_code == female_status.status_code == 200
    assert client.get("/donor/dashboard", headers=donor["headers"]).json()["eligibility"]["gap_days"] == 90
    assert female_status.json()["eligibility"]["gap_days"] == 120
    assert female_status.json()["eligibility"]["eligible"] is False


def test_requests_match_group_city_accept_cancel_and_guard_active(client, hospital, same_city_hospital, other_city_hospital, donor, donor2, db_session):
    matched = post_request(client, hospital["headers"])
    same = post_request(client, same_city_hospital["headers"])
    other_city = post_request(client, other_city_hospital["headers"])
    assert matched.status_code == same.status_code == other_city.status_code == 201
    listing = client.get("/donor/requests", headers=donor["headers"])
    ids = {item["id"] for item in listing.json()["requests"]}
    assert matched.json()["request"]["id"] in ids
    assert same.json()["request"]["id"] in ids
    assert other_city.json()["request"]["id"] not in ids
    accepted = client.post(
        f"/donor/requests/{matched.json()['request']['id']}/accept", headers=donor["headers"]
    )
    assert accepted.status_code == 200
    response_id = accepted.json()["active_response"]["response_id"]
    second = client.post(
        f"/donor/requests/{same.json()['request']['id']}/accept", headers=donor["headers"]
    )
    assert second.status_code == 409
    assert db_session.get(RequestResponse, response_id).status == "accepted"
    cancelled = client.post(f"/donor/responses/{response_id}/cancel", headers=donor["headers"])
    assert cancelled.status_code == 200
    assert db_session.get(RequestResponse, response_id).status == "cancelled"
    assert client.post(
        f"/donor/requests/{same.json()['request']['id']}/accept", headers=donor["headers"]
    ).status_code == 200


def test_donor_in_cooldown_cannot_accept_request(client, hospital, donor, db_session):
    from app.models import Donor

    row = db_session.get(Donor, donor["id"])
    row.never_donated = False
    row.last_donation = date.today() - timedelta(days=30)
    db_session.commit()
    request = post_request(client, hospital["headers"]).json()["request"]
    result = client.post(f"/donor/requests/{request['id']}/accept", headers=donor["headers"])
    assert result.status_code == 400
    assert "donate again on" in result.json()["detail"]


def test_donation_history_and_hospital_phone_privacy(client, hospital, donor):
    before = client.get("/hospital/donors", headers=hospital["headers"]).json()
    donor_record = next(item for item in before["donors"] if item["id"] == donor["id"])
    assert donor_record["phone"] is None
    result = client.post(
        "/hospital/donations",
        headers=hospital["headers"],
        json={
            "donor_id": donor["id"],
            "donation_date": date.today().isoformat(),
            "component": "Whole Blood",
            "units": 1,
        },
    )
    assert result.status_code == 201
    history = client.get("/donor/history", headers=donor["headers"])
    assert history.status_code == 200 and len(history.json()) == 1
    assert history.json()[0]["hospital"] == hospital["payload"]["name"]


def test_camp_browse_proximity_registration_and_cancelled_hidden(client, hospital, same_city_hospital, other_city_hospital, make_hospital, donor, db_session):
    today = date.today()

    def create(h, title, camp_city=None, pin=None):
        if pin:
            db_session.get(Hospital, h["id"]).pin = pin
            db_session.commit()
        return client.post(
            "/hospital/camps",
            headers=h["headers"],
            json={
                "title": title,
                "camp_date": (today + timedelta(days=10)).isoformat(),
                "start_time": "09:00",
                "end_time": "12:00",
                "venue": "Main Hall",
                "target_units": 20,
            },
        ).json()

    area = create(hospital, "Area Camp")
    nearby = create(same_city_hospital, "Nearby Camp", pin="560099")
    other = create(other_city_hospital, "Other Camp")
    city_hospital = make_hospital(index=4, city="Test City")
    create(city_hospital, "City Camp", pin="400001")
    cancelled_camp = create(hospital, "Cancelled Camp")
    cancelled_id = client.post(
        f"/hospital/camps/{cancelled_camp['id']}/cancel", headers=hospital["headers"], json={"reason": "test"}
    )
    assert cancelled_id.status_code == 200
    # Recreate an active area camp for registration.
    area_active = create(hospital, "Registration Camp")
    browse = client.get("/donor/camps/browse?scope=all", headers=donor["headers"]).json()
    proximity = {row["title"]: row["proximity"] for row in browse["camps"]}
    assert "Cancelled Camp" not in proximity
    assert proximity["Nearby Camp"] == "nearby"
    assert proximity["City Camp"] == "city"
    assert proximity["Other Camp"] == "other"
    assert proximity["Registration Camp"] == "area"
    camp_id = area_active["id"]
    registered = client.post(f"/donor/camps/{camp_id}/register", headers=donor["headers"])
    assert registered.status_code == 200 and registered.json()["is_registered"] is True
    assert db_session.query(CampRegistration).filter_by(camp_id=camp_id, donor_id=donor["id"]).count() == 1
    removed = client.delete(f"/donor/camps/{camp_id}/register", headers=donor["headers"])
    assert removed.status_code == 200 and removed.json()["is_registered"] is False


def test_donor_cooldown_blocks_camp_registration(client, hospital, donor, db_session):
    from app.models import Donor

    record = db_session.get(Donor, donor["id"])
    record.never_donated = False
    record.last_donation = date.today() - timedelta(days=30)
    db_session.commit()
    camp = client.post(
        "/hospital/camps",
        headers=hospital["headers"],
        json={
            "title": "Upcoming Camp",
            "camp_date": (date.today() + timedelta(days=10)).isoformat(),
            "start_time": "09:00",
            "end_time": "12:00",
            "venue": "Main Hall",
            "target_units": 10,
        },
    ).json()
    blocked = client.post(f"/donor/camps/{camp['id']}/register", headers=donor["headers"])
    assert blocked.status_code == 400
    assert db_session.query(CampRegistration).filter_by(camp_id=camp["id"]).count() == 0
