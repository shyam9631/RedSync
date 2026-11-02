from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ActivityLog, BloodRequest, Hospital, RequestResponse
from app.models_more import Camp, CampRegistration, Notification

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]
LOW_AT = 15  # 15 units or fewer is "low"
CRITICAL_AT = 5  # 5 units or fewer is "critical"
IST = timezone(timedelta(hours=5, minutes=30))

# Response statuses. A donor's phone is visible to the hospital in these states.
SHARED_STATUSES = ("accepted", "confirmed", "completed")
ACTIVE_STATUSES = ("accepted", "confirmed")

UPLOAD_DIR = Path("uploads") / "licenses"


def stock_status(units: int) -> str:
    if units <= CRITICAL_AT:
        return "critical"
    if units <= LOW_AT:
        return "low"
    return "available"


def iso(value: Optional[datetime]) -> Optional[str]:
    """Times are stored as naive UTC. Send them with a Z so the browser converts correctly."""
    return value.isoformat() + "Z" if value else None


def to_utc_naive(value: datetime) -> datetime:
    """Convert a client time to naive UTC. Times without an offset are treated as IST."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=IST)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def plural(n: int) -> str:
    return "" if n == 1 else "s"


def donor_code(donor_id: int) -> str:
    return f"RD-{donor_id:04d}"


def short_name(name: str) -> str:
    parts = name.split()
    return name if len(parts) < 2 else f"{parts[0]} {parts[-1][0]}."


def donor_gap_days(gender: str) -> int:
    return 120 if gender == "Female" else 90


def eligibility(donor, today: Optional[date] = None) -> dict:
    today = today or date.today()
    gap = donor_gap_days(donor.gender)
    if donor.never_donated or donor.last_donation is None:
        return {"eligible": True, "days_left": 0, "percent": 100, "next_eligible": None, "gap_days": gap}

    next_date = donor.last_donation + timedelta(days=gap)
    days_left = (next_date - today).days
    if days_left <= 0:
        return {"eligible": True, "days_left": 0, "percent": 100, "next_eligible": next_date, "gap_days": gap}

    percent = max(0, min(100, round((gap - days_left) / gap * 100)))
    return {"eligible": False, "days_left": days_left, "percent": percent, "next_eligible": next_date, "gap_days": gap}


def log_activity(db: Session, hospital_id: int, icon: str, tone: str, text: str) -> None:
    """Adds a line to the hospital's Recent activity. The caller commits."""
    db.add(ActivityLog(hospital_id=hospital_id, icon=icon, tone=tone, text=text[:255]))


def notify(db: Session, user_id: int, title: str, text: str, kind: str = "info", ref_id: Optional[int] = None) -> None:
    """Adds an item to a user's notification bell. The caller commits."""
    db.add(Notification(user_id=user_id, title=title[:150], text=text[:300], kind=kind, ref_id=ref_id))


def shared_donor_ids(db: Session, hospital_id: int) -> set:
    """Donors who accepted one of this hospital's requests (their phone may be shown)."""
    rows = db.scalars(
        select(RequestResponse.donor_id)
        .join(BloodRequest, BloodRequest.id == RequestResponse.request_id)
        .where(
            BloodRequest.hospital_id == hospital_id,
            RequestResponse.status.in_(SHARED_STATUSES),
        )
        .distinct()
    )
    return set(rows)


def camp_out(db: Session, camp: Camp, hospital_name: str, donor_id: Optional[int] = None) -> dict:
    registered = db.scalar(
        select(func.count(CampRegistration.id)).where(CampRegistration.camp_id == camp.id)
    ) or 0
    is_registered = None
    if donor_id is not None:
        is_registered = (
            db.scalar(
                select(CampRegistration.id).where(
                    CampRegistration.camp_id == camp.id,
                    CampRegistration.donor_id == donor_id,
                )
            )
            is not None
        )
    return {
        "id": camp.id,
        "title": camp.title,
        "camp_date": camp.camp_date,
        "start_time": camp.start_time,
        "end_time": camp.end_time,
        "venue": camp.venue,
        "city": camp.city,
        "target_units": camp.target_units,
        "registered": registered,
        "hospital_name": hospital_name,
        "status": camp.status,
        "is_registered": is_registered,
    }


def upcoming_camps(
    db: Session,
    city: Optional[str] = None,
    donor_id: Optional[int] = None,
    limit: Optional[int] = None,
) -> list:
    query = (
        select(Camp, Hospital)
        .join(Hospital, Hospital.id == Camp.hospital_id)
        .where(
            Camp.status == "active",
            Camp.camp_date >= date.today(),
            Hospital.status == "approved",
        )
        .order_by(Camp.camp_date, Camp.start_time)
    )
    if city:
        query = query.where(func.lower(Camp.city) == city.strip().lower())
    if limit:
        query = query.limit(limit)
    return [camp_out(db, camp, hospital.name, donor_id) for camp, hospital in db.execute(query).all()]