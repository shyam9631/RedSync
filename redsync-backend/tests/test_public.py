from datetime import date, timedelta

from app.models import BloodStock


def test_health_and_public_hospitals_filter_without_private_fields(client, hospital, pending_hospital):
    health = client.get("/health")
    db_health = client.get("/health/db")
    assert health.status_code == db_health.status_code == 200
    assert health.json()["status"] == "ok"
    assert db_health.json()["database"] == "ok"

    response = client.get("/public/hospitals")
    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}
    assert hospital["id"] in ids
    assert pending_hospital["id"] not in ids
    assert all("phone" not in row and "password_hash" not in row for row in response.json())
    city = client.get("/public/hospitals?city=Other%20City")
    assert city.status_code == 200
    assert all(row["city"] == "Other City" for row in city.json())


def test_find_blood_availability_and_stats(client, hospital, donor, db_session):
    db_session.query(BloodStock).filter_by(hospital_id=hospital["id"], blood_group="O+").one().units = 12
    db_session.commit()
    found = client.get("/public/find-blood?group=O%2B&location=Test%20City")
    assert found.status_code == 200
    assert found.json()["count"] == 1
    result = found.json()["results"][0]
    assert result["stock"][0]["units"] == 12
    assert "password_hash" not in result and "donor" not in result
    availability = client.get("/public/availability?city=Test%20City")
    assert availability.status_code == 200
    assert len(availability.json()) == 8
    assert next(row for row in availability.json() if row["group"] == "O+")["units"] == 12
    stats = client.get("/public/stats")
    assert stats.status_code == 200
    assert stats.json()["donors"] == 1
    assert stats.json()["hospitals"] == 1
    assert "phone" not in str(stats.json()) and "password_hash" not in str(stats.json())


def test_public_camps_show_only_upcoming_active_camps(client, hospital, db_session):
    created = client.post(
        "/hospital/camps",
        headers=hospital["headers"],
        json={
            "title": "Public Camp",
            "camp_date": (date.today() + timedelta(days=3)).isoformat(),
            "start_time": "09:00",
            "end_time": "12:00",
            "venue": "Main Hall",
            "target_units": 15,
        },
    )
    assert created.status_code == 201
    listing = client.get("/public/camps?city=Test%20City")
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["title"] == "Public Camp"
    assert "phone" not in listing.text and "password_hash" not in listing.text
