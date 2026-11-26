from datetime import date, timedelta

from app.models import BloodStock
from app.models_more import StockBatch, StockLedger, StockTarget


def inward(headers, *, group="O+", component="Whole Blood", units=3, expiry=None, code=None):
    return {
        "blood_group": group,
        "component": component,
        "units": units,
        "expiry_date": (expiry or date.today() + timedelta(days=30)).isoformat(),
        "batch_code": code,
    }


def test_stock_overview_defaults_status_and_target(client, hospital, db_session):
    response = client.get("/hospital/stock/overview", headers=hospital["headers"])
    assert response.status_code == 200
    assert len(response.json()["groups"]) == 8
    assert response.json()["summary"]["critical_count"] == 8
    assert all(group["target"] == 40 and group["status"] == "critical" for group in response.json()["groups"])
    set_target = client.put(
        "/hospital/stock/O+/target", headers=hospital["headers"], json={"target_units": 75}
    )
    assert set_target.status_code == 200
    assert db_session.query(StockTarget).filter_by(hospital_id=hospital["id"], blood_group="O+").one().target_units == 75
    assert client.put(
        "/hospital/stock/XX/target", headers=hospital["headers"], json={"target_units": 30}
    ).status_code == 404


def test_inward_fifo_outward_and_cannot_issue_expired_or_excess(client, hospital, db_session):
    today = date.today()
    first = client.post(
        "/hospital/stock/inward",
        headers=hospital["headers"],
        json=inward({}, units=2, expiry=today + timedelta(days=4), code="EARLY"),
    )
    second = client.post(
        "/hospital/stock/inward",
        headers=hospital["headers"],
        json=inward({}, units=3, expiry=today + timedelta(days=9), code="LATE"),
    )
    assert first.status_code == second.status_code == 201
    batches_before = db_session.query(StockBatch).filter_by(
        hospital_id=hospital["id"], blood_group="O+"
    ).order_by(StockBatch.expiry_date).all()
    assert [batch.units_remaining for batch in batches_before] == [2, 3]
    out = client.post(
        "/hospital/stock/outward",
        headers=hospital["headers"],
        json={"blood_group": "O+", "component": "Whole Blood", "units": 3},
    )
    assert out.status_code == 200
    db_session.expire_all()
    batches_after = db_session.query(StockBatch).filter_by(
        hospital_id=hospital["id"], blood_group="O+"
    ).order_by(StockBatch.expiry_date).all()
    assert [batch.units_remaining for batch in batches_after] == [0, 2]
    batches = client.get("/hospital/stock/overview", headers=hospital["headers"]).json()["groups"]
    assert next(row for row in batches if row["group"] == "O+")["units"] == 2
    excessive = client.post(
        "/hospital/stock/outward",
        headers=hospital["headers"],
        json={"blood_group": "O+", "component": "Whole Blood", "units": 3},
    )
    assert excessive.status_code == 400
    assert "Only 2 usable units" in excessive.json()["detail"]

    expired = client.post(
        "/hospital/stock/inward",
        headers=hospital["headers"],
        json=inward({}, group="A+", units=2, expiry=today + timedelta(days=1)),
    )
    assert expired.status_code == 201
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        batch = db.query(StockBatch).filter_by(hospital_id=hospital["id"], blood_group="A+").one()
        batch.expiry_date = today - timedelta(days=1)
        db.commit()
    finally:
        db.close()
    cannot_issue = client.post(
        "/hospital/stock/outward",
        headers=hospital["headers"],
        json={"blood_group": "A+", "component": "Whole Blood", "units": 1},
    )
    assert cannot_issue.status_code == 400


def test_discard_and_discard_expired_reduce_batches(client, hospital, db_session):
    today = date.today()
    client.post(
        "/hospital/stock/inward",
        headers=hospital["headers"],
        json=inward({}, group="B+", units=3),
    )
    discarded = client.post(
        "/hospital/stock/discard",
        headers=hospital["headers"],
        json={"blood_group": "B+", "component": "Whole Blood", "units": 1, "reason": "Damaged / bag leak"},
    )
    assert discarded.status_code == 200
    assert db_session.query(BloodStock).filter_by(hospital_id=hospital["id"], blood_group="B+").one().units == 2
    batch = db_session.query(StockBatch).filter_by(hospital_id=hospital["id"], blood_group="B+").one()
    batch.expiry_date = today - timedelta(days=1)
    db_session.commit()
    result = client.post("/hospital/stock/discard-expired", headers=hospital["headers"])
    assert result.status_code == 200 and result.json()["discarded"] == 2
    assert db_session.query(BloodStock).filter_by(hospital_id=hospital["id"], blood_group="B+").one().units == 0


def test_ledger_pagination_status_thresholds_and_legacy_total_consistency(client, hospital, db_session):
    for units in (5, 10, 15, 16):
        response = client.put(
            f"/hospital/stock/{['A+', 'A-', 'B+', 'B-'][[5, 10, 15, 16].index(units)]}",
            headers=hospital["headers"],
            json={"units": units},
        )
        assert response.status_code == 200
    stock = client.get("/hospital/stock", headers=hospital["headers"]).json()
    assert {row["group"]: row["status"] for row in stock if row["group"] in {"A+", "A-", "B+", "B-"}} == {
        "A+": "critical", "A-": "low", "B+": "low", "B-": "available"
    }
    client.post(
        "/hospital/stock/inward",
        headers=hospital["headers"],
        json=inward({}, group="O+", units=5),
    )
    legacy = client.put("/hospital/stock/O+", headers=hospital["headers"], json={"units": 4})
    assert legacy.status_code == 200
    assert db_session.query(BloodStock).filter_by(hospital_id=hospital["id"], blood_group="O+").one().units == 4
    batch = db_session.query(StockBatch).filter_by(hospital_id=hospital["id"], blood_group="O+").one()
    assert batch.units_remaining == 4
    ledger = client.get("/hospital/stock/ledger?limit=2", headers=hospital["headers"])
    assert ledger.status_code == 200 and ledger.json()["total"] == 6
    assert len(ledger.json()["items"]) == 2
    assert client.get("/hospital/stock/ledger?group=BOGUS", headers=hospital["headers"]).status_code == 400


def test_recorded_donations_create_shelf_life_batches(client, hospital, make_donor, db_session):
    shelf_days = {
        "Platelets": 5,
        "Whole Blood": 35,
        "Packed Red Cells": 42,
        "Plasma": 365,
    }
    for index, (component, days) in enumerate(shelf_days.items()):
        donor = make_donor(full_name=f"Donor {index}", blood_group="A+")
        result = client.post(
            "/hospital/donations",
            headers=hospital["headers"],
            json={
                "donor_id": donor["id"],
                "donation_date": date.today().isoformat(),
                "component": component,
                "units": 1,
            },
        )
        assert result.status_code == 201
        batch = db_session.query(StockBatch).filter_by(hospital_id=hospital["id"], blood_group="A+", component=component).one()
        assert batch.source == "donation"
        assert batch.expiry_date == date.today() + timedelta(days=days)
    assert db_session.query(StockLedger).filter_by(hospital_id=hospital["id"], kind="inward").count() == 4
