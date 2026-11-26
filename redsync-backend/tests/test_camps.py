from datetime import date, datetime, timedelta

from app.models import Donor, Donation
from app.models_more import Camp, CampAttendance, CampRegistration, Notification, StockBatch


def create_camp(client, hospital, *, title="Community Camp", camp_date=None, start="09:00", end="12:00", venue="Main Hall"):
    return client.post(
        "/hospital/camps",
        headers=hospital["headers"],
        json={
            "title": title,
            "camp_date": (camp_date or date.today() + timedelta(days=5)).isoformat(),
            "start_time": start,
            "end_time": end,
            "venue": venue,
            "target_units": 20,
        },
    )


def test_create_validation_overview_phases_and_summary(client, hospital, donor, db_session):
    past = create_camp(client, hospital, title="Past Camp", camp_date=date.today() - timedelta(days=1))
    assert past.status_code == 422
    reversed_time = create_camp(client, hospital, title="Bad Hours", start="12:00", end="09:00")
    assert reversed_time.status_code == 422

    camps = {
        "upcoming": create_camp(client, hospital, title="Upcoming").json(),
        "today": create_camp(client, hospital, title="Today").json(),
        "live": create_camp(client, hospital, title="Live").json(),
        "completed": create_camp(client, hospital, title="Completed").json(),
        "cancelled": create_camp(client, hospital, title="Cancelled").json(),
    }
    db_session.get(Camp, camps["today"]["id"]).camp_date = date.today()
    db_session.get(Camp, camps["today"]["id"]).start_time = "23:00"
    db_session.get(Camp, camps["today"]["id"]).end_time = "23:59"
    db_session.get(Camp, camps["live"]["id"]).camp_date = date.today()
    db_session.get(Camp, camps["live"]["id"]).start_time = "00:00"
    db_session.get(Camp, camps["live"]["id"]).end_time = "23:59"
    db_session.get(Camp, camps["completed"]["id"]).camp_date = date.today() - timedelta(days=1)
    db_session.commit()
    cancelled = client.post(
        f"/hospital/camps/{camps['cancelled']['id']}/cancel",
        headers=hospital["headers"],
        json={"reason": "weather"},
    )
    assert cancelled.status_code == 200

    response = client.get("/hospital/camps/overview", headers=hospital["headers"])
    assert response.status_code == 200
    phases = {row["title"]: row["phase"] for row in response.json()["camps"]}
    assert phases == {
        "Upcoming": "upcoming",
        "Today": "today",
        "Live": "live",
        "Completed": "completed",
        "Cancelled": "cancelled",
    }
    assert response.json()["summary"]["total"] == 5


def test_detail_has_roster_without_phone_and_cross_hospital_404(client, hospital, other_city_hospital, donor):
    camp = create_camp(client, hospital).json()
    assert client.post(f"/donor/camps/{camp['id']}/register", headers=donor["headers"]).status_code == 200
    detail = client.get(f"/hospital/camps/{camp['id']}", headers=hospital["headers"])
    assert detail.status_code == 200
    assert detail.json()["can_mark_attendance"] is False
    assert detail.json()["donors"][0]["name"] == "Test Donor"
    assert "phone" not in detail.json()["donors"][0]
    assert client.get(f"/hospital/camps/{camp['id']}", headers=other_city_hospital["headers"]).status_code == 404
    assert client.put(
        f"/hospital/camps/{camp['id']}",
        headers=other_city_hospital["headers"],
        json={
            "title": "Changed Title",
            "camp_date": (date.today() + timedelta(days=6)).isoformat(),
            "start_time": "09:00",
            "end_time": "12:00",
            "venue": "Main Hall",
            "target_units": 20,
        },
    ).status_code == 404


def test_edit_notifies_registered_only_for_date_time_venue_changes_and_blocks_closed_camps(client, hospital, donor, donor2, db_session):
    camp = create_camp(client, hospital).json()
    other = create_camp(client, hospital, title="Unregistered Camp").json()
    client.post(f"/donor/camps/{camp['id']}/register", headers=donor["headers"])
    edited = client.put(
        f"/hospital/camps/{camp['id']}",
        headers=hospital["headers"],
        json={
            "title": "Renamed Camp",
            "camp_date": (date.today() + timedelta(days=6)).isoformat(),
            "start_time": "10:00",
            "end_time": "13:00",
            "venue": "New Hall",
            "target_units": 30,
        },
    )
    assert edited.status_code == 200 and edited.json()["notified"] == 1
    donor_notice_count = client.get("/notifications", headers=donor["headers"]).json()["items"]
    other_notice_count = client.get("/notifications", headers=donor2["headers"]).json()["items"]
    assert any(item["title"] == "Camp updated" for item in donor_notice_count)
    assert not any(item["title"] == "Camp updated" for item in other_notice_count)
    assert db_session.get(Camp, camp["id"]).venue == "New Hall"

    db_session.get(Camp, other["id"]).camp_date = date.today() - timedelta(days=1)
    db_session.commit()
    completed_edit = client.put(
        f"/hospital/camps/{other['id']}",
        headers=hospital["headers"],
        json={
            "title": "No Edit",
            "camp_date": (date.today() + timedelta(days=1)).isoformat(),
            "start_time": "09:00",
            "end_time": "12:00",
            "venue": "Main Hall",
            "target_units": 20,
        },
    )
    assert completed_edit.status_code == 400
    cancelled = create_camp(client, hospital, title="Cancelled Camp").json()
    client.post(
        f"/hospital/camps/{cancelled['id']}/cancel",
        headers=hospital["headers"],
        json={"reason": "Closed"},
    )
    cancelled_edit = client.put(
        f"/hospital/camps/{cancelled['id']}",
        headers=hospital["headers"],
        json={
            "title": "No Edit",
            "camp_date": (date.today() + timedelta(days=2)).isoformat(),
            "start_time": "09:00",
            "end_time": "12:00",
            "venue": "Main Hall",
            "target_units": 20,
        },
    )
    assert cancelled_edit.status_code == 400


def test_cancel_reason_notifies_donors_and_is_idempotent(client, hospital, donor, db_session):
    camp = create_camp(client, hospital).json()
    client.post(f"/donor/camps/{camp['id']}/register", headers=donor["headers"])
    cancelled = client.post(
        f"/hospital/camps/{camp['id']}/cancel",
        headers=hospital["headers"],
        json={"reason": "Bad weather"},
    )
    assert cancelled.status_code == 200 and cancelled.json()["notified"] == 1
    notice = client.get("/notifications", headers=donor["headers"]).json()["items"]
    assert any("Bad weather" in item["text"] for item in notice)
    again = client.post(
        f"/hospital/camps/{camp['id']}/cancel",
        headers=hospital["headers"],
        json={"reason": "Again"},
    )
    assert again.status_code == 200 and again.json()["notified"] == 0
    assert db_session.get(Camp, camp["id"]).status == "cancelled"


def test_attendance_rules_donation_stock_deferred_duplicate_and_owner(client, hospital, other_city_hospital, make_donor, db_session):
    camp = create_camp(client, hospital).json()
    day = date.today()
    db_session.get(Camp, camp["id"]).camp_date = day
    db_session.commit()
    eligible = make_donor(full_name="Eligible Donor", blood_group="A+")
    cooldown = make_donor(full_name="Cooldown Donor", blood_group="O+", never_donated=False, last_donation=(day - timedelta(days=20)).isoformat())
    unregistered = make_donor(full_name="No Registration")
    future_camp = create_camp(client, hospital, title="Future Camp").json()
    future_attendance = client.post(
        f"/hospital/camps/{future_camp['id']}/attendance",
        headers=hospital["headers"],
        json={"donor_id": eligible["id"], "status": "deferred"},
    )
    assert future_attendance.status_code == 400
    assert client.post(f"/donor/camps/{camp['id']}/register", headers=eligible["headers"]).status_code == 200
    db_session.add(CampRegistration(camp_id=camp["id"], donor_id=cooldown["id"]))
    db_session.commit()
    not_registered = client.post(
        f"/hospital/camps/{camp['id']}/attendance",
        headers=hospital["headers"],
        json={"donor_id": unregistered["id"], "status": "deferred"},
    )
    assert not_registered.status_code == 404
    blocked = client.post(
        f"/hospital/camps/{camp['id']}/attendance",
        headers=hospital["headers"],
        json={"donor_id": cooldown["id"], "status": "donated"},
    )
    assert blocked.status_code == 400

    deferred = client.post(
        f"/hospital/camps/{camp['id']}/attendance",
        headers=hospital["headers"],
        json={"donor_id": eligible["id"], "status": "deferred"},
    )
    assert deferred.status_code == 200
    assert db_session.query(Donation).filter_by(donor_id=eligible["id"]).count() == 0
    duplicate = client.post(
        f"/hospital/camps/{camp['id']}/attendance",
        headers=hospital["headers"],
        json={"donor_id": eligible["id"], "status": "donated"},
    )
    assert duplicate.status_code == 400

    donated_donor = make_donor(full_name="New Donor", blood_group="B+")
    client.post(f"/donor/camps/{camp['id']}/register", headers=donated_donor["headers"])
    donated = client.post(
        f"/hospital/camps/{camp['id']}/attendance",
        headers=hospital["headers"],
        json={"donor_id": donated_donor["id"], "status": "donated"},
    )
    assert donated.status_code == 200
    assert db_session.query(Donation).filter_by(donor_id=donated_donor["id"]).one().units == 1
    assert db_session.query(StockBatch).filter_by(hospital_id=hospital["id"], blood_group="B+", source="camp").count() == 1
    assert db_session.get(Donor, donated_donor["id"]).last_donation == day
    assert client.get(f"/hospital/camps/{camp['id']}", headers=other_city_hospital["headers"]).status_code == 404
    assert client.post(
        f"/hospital/camps/{camp['id']}/cancel",
        headers=other_city_hospital["headers"],
        json={"reason": "No access"},
    ).status_code == 404
    assert client.post(
        f"/hospital/camps/{camp['id']}/attendance",
        headers=other_city_hospital["headers"],
        json={"donor_id": donated_donor["id"], "status": "deferred"},
    ).status_code == 404
    assert client.put(
        f"/hospital/camps/{camp['id']}",
        headers=other_city_hospital["headers"],
        json={
            "title": "Other",
            "camp_date": (day + timedelta(days=1)).isoformat(),
            "start_time": "09:00",
            "end_time": "12:00",
            "venue": "Hall",
            "target_units": 20,
        },
    ).status_code == 404
