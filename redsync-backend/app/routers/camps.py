from collections import Counter
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas_more as sm
from app import stock_ops
from app.database import get_db
from app.deps import current_hospital
from app.models import Donation, Donor, DonorHospitalLink, Hospital
from app.models_more import Camp, CampAttendance, CampRegistration
from app.utils import donor_code, donor_gap_days, eligibility, iso, log_activity, notify, short_name

router = APIRouter(prefix="/hospital/camps", tags=["Hospital camps"])


def _phase(camp: Camp, now: datetime) -> str:
    """cancelled | upcoming | today | live | completed"""
    if camp.status == "cancelled":
        return "cancelled"
    today = now.date()
    if camp.camp_date > today:
        return "upcoming"
    if camp.camp_date < today:
        return "completed"
    hhmm = now.strftime("%H:%M")
    if hhmm < camp.start_time:
        return "today"
    if hhmm <= camp.end_time:
        return "live"
    return "completed"


def _counts(db: Session, camp_ids: list) -> dict:
    """{camp_id: {registered, donated, deferred}} in three queries."""
    out = {i: {"registered": 0, "donated": 0, "deferred": 0} for i in camp_ids}
    if not camp_ids:
        return out
    for camp_id, n in db.execute(
        select(CampRegistration.camp_id, func.count(CampRegistration.id))
        .where(CampRegistration.camp_id.in_(camp_ids))
        .group_by(CampRegistration.camp_id)
    ):
        out[camp_id]["registered"] = n
    for camp_id, status, n in db.execute(
        select(CampAttendance.camp_id, CampAttendance.status, func.count(CampAttendance.id))
        .where(CampAttendance.camp_id.in_(camp_ids))
        .group_by(CampAttendance.camp_id, CampAttendance.status)
    ):
        out[camp_id][status] = n
    return out


def _camp_row(camp: Camp, counts: dict, now: datetime) -> dict:
    phase = _phase(camp, now)
    registered, donated, deferred = counts["registered"], counts["donated"], counts["deferred"]
    return {
        "id": camp.id,
        "title": camp.title,
        "camp_date": camp.camp_date,
        "start_time": camp.start_time,
        "end_time": camp.end_time,
        "venue": camp.venue,
        "city": camp.city,
        "target_units": camp.target_units,
        "status": camp.status,
        "phase": phase,
        "days_until": (camp.camp_date - now.date()).days,
        "registered": registered,
        "donated": donated,
        "deferred": deferred,
        "no_show": max(0, registered - donated - deferred) if phase == "completed" else 0,
        "units_collected": donated,
        "percent": min(100, round(donated / camp.target_units * 100)) if camp.target_units else 0,
        "fill_percent": min(100, round(registered / camp.target_units * 100)) if camp.target_units else 0,
    }


def _own_camp(db: Session, hospital: Hospital, camp_id: int) -> Camp:
    camp = db.get(Camp, camp_id)
    if camp is None or camp.hospital_id != hospital.id:
        raise HTTPException(404, "Camp not found.")
    return camp


@router.get("/overview")
def overview(hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    now = datetime.now()
    camps = db.scalars(
        select(Camp)
        .where(Camp.hospital_id == hospital.id)
        .order_by(Camp.camp_date.desc(), Camp.start_time.desc())
        .limit(300)
    ).all()
    counts = _counts(db, [c.id for c in camps])
    rows = [_camp_row(c, counts[c.id], now) for c in camps]

    by_phase = Counter(r["phase"] for r in rows)
    upcoming = [r for r in rows if r["phase"] in ("upcoming", "today", "live")]
    completed = [r for r in rows if r["phase"] == "completed"]
    return {
        "summary": {
            "total": len(rows),
            "live": by_phase["live"],
            "today": by_phase["today"],
            "upcoming": by_phase["upcoming"],
            "completed": by_phase["completed"],
            "cancelled": by_phase["cancelled"],
            "units_collected": sum(r["donated"] for r in rows),
            "target_completed": sum(r["target_units"] for r in completed),
            "registered_upcoming": sum(r["registered"] for r in upcoming),
            "donors_served": sum(r["donated"] for r in rows),
        },
        "camps": rows,
    }


@router.get("/{camp_id}")
def camp_detail(camp_id: int, hospital: Hospital = Depends(current_hospital), db: Session = Depends(get_db)):
    camp = _own_camp(db, hospital, camp_id)
    now = datetime.now()
    counts = _counts(db, [camp.id])[camp.id]

    attendance = {
        a.donor_id: a
        for a in db.scalars(select(CampAttendance).where(CampAttendance.camp_id == camp.id)).all()
    }
    regs = db.execute(
        select(CampRegistration, Donor)
        .join(Donor, Donor.id == CampRegistration.donor_id)
        .where(CampRegistration.camp_id == camp.id)
        .order_by(CampRegistration.created_at)
    ).all()

    donors = []
    for reg, donor in regs:
        elig = eligibility(donor, camp.camp_date)
        att = attendance.get(donor.id)
        donors.append({
            "donor_id": donor.id,
            "code": donor_code(donor.id),
            "name": donor.user.name,
            "blood_group": donor.blood_group,
            "area": donor.area,
            "city": donor.city,
            "registered_at": iso(reg.created_at),
            "eligible_on_camp_day": elig["eligible"],
            "next_eligible": elig["next_eligible"],
            "attendance": att.status if att else None,
            "note": att.note if att else None,
        })

    return {
        "camp": _camp_row(camp, counts, now),
        "donors": donors,
        "groups": dict(Counter(d["blood_group"] for d in donors)),
        # attendance can be marked once the camp day has started
        "can_mark_attendance": camp.status == "active" and camp.camp_date <= now.date(),
    }


@router.put("/{camp_id}")
def edit_camp(
    camp_id: int,
    body: sm.CampEditIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    camp = _own_camp(db, hospital, camp_id)
    now = datetime.now()
    phase = _phase(camp, now)
    if phase == "cancelled":
        raise HTTPException(400, "A cancelled camp cannot be edited.")
    if phase == "completed":
        raise HTTPException(400, "A camp that has already happened cannot be edited.")
    if body.camp_date < now.date():
        raise HTTPException(400, "The camp date cannot be in the past.")

    changed = []
    if body.camp_date != camp.camp_date:
        changed.append(f"date is now {body.camp_date:%d %b %Y}")
    if (body.start_time, body.end_time) != (camp.start_time, camp.end_time):
        changed.append(f"time is now {body.start_time}-{body.end_time}")
    if body.venue.strip() != camp.venue:
        changed.append(f"venue is now {body.venue.strip()}")

    camp.title = body.title.strip()
    camp.camp_date = body.camp_date
    camp.start_time = body.start_time
    camp.end_time = body.end_time
    camp.venue = body.venue.strip()
    camp.target_units = body.target_units

    notified = 0
    if changed:
        user_ids = db.scalars(
            select(Donor.user_id)
            .join(CampRegistration, CampRegistration.donor_id == Donor.id)
            .where(CampRegistration.camp_id == camp.id)
        ).all()
        for user_id in user_ids:
            notify(
                db, user_id, "Camp updated",
                f"{hospital.name} updated \"{camp.title}\": the " + "; the ".join(changed) + ".",
                "camp", camp.id,
            )
        notified = len(user_ids)
    log_activity(db, hospital.id, "edit_calendar", "neutral", f"Camp updated: {camp.title}")
    db.commit()
    return {"message": "Camp updated.", "notified": notified}


@router.post("/{camp_id}/cancel")
def cancel(
    camp_id: int,
    body: sm.CampCancelIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    camp = _own_camp(db, hospital, camp_id)
    phase = _phase(camp, datetime.now())
    if phase == "cancelled":
        return {"message": "This camp was already cancelled.", "notified": 0}
    if phase == "completed":
        raise HTTPException(400, "A camp that has already happened cannot be cancelled.")

    camp.status = "cancelled"
    reason = (body.reason or "").strip()
    user_ids = db.scalars(
        select(Donor.user_id)
        .join(CampRegistration, CampRegistration.donor_id == Donor.id)
        .where(CampRegistration.camp_id == camp.id)
    ).all()
    text = f"{hospital.name} cancelled the camp \"{camp.title}\"."
    if reason:
        text += f" Reason: {reason}"
    for user_id in user_ids:
        notify(db, user_id, "Camp cancelled", text, "camp", camp.id)
    log_activity(db, hospital.id, "event_busy", "neutral", f"Camp cancelled: {camp.title}")
    db.commit()
    return {"message": "Camp cancelled.", "notified": len(user_ids)}


@router.post("/{camp_id}/attendance")
def mark_attendance(
    camp_id: int,
    body: sm.CampAttendanceIn,
    hospital: Hospital = Depends(current_hospital),
    db: Session = Depends(get_db),
):
    camp = _own_camp(db, hospital, camp_id)
    if camp.status != "active":
        raise HTTPException(400, "This camp was cancelled.")
    if camp.camp_date > date.today():
        raise HTTPException(400, "Attendance can only be marked on or after the camp day.")

    reg = db.scalar(
        select(CampRegistration).where(
            CampRegistration.camp_id == camp.id, CampRegistration.donor_id == body.donor_id
        )
    )
    if reg is None:
        raise HTTPException(404, "This donor is not registered for the camp.")
    if db.scalar(
        select(CampAttendance.id).where(
            CampAttendance.camp_id == camp.id, CampAttendance.donor_id == body.donor_id
        )
    ):
        raise HTTPException(400, "This donor's visit has already been recorded.")

    donor = db.get(Donor, body.donor_id)
    user = donor.user
    donation = None

    if body.status == "donated":
        if donor.last_donation and not donor.never_donated:
            gap = donor_gap_days(donor.gender)
            if camp.camp_date < donor.last_donation + timedelta(days=gap):
                raise HTTPException(
                    400,
                    f"{user.name} last donated on {donor.last_donation:%d %b %Y} "
                    f"and is not due until {donor.last_donation + timedelta(days=gap):%d %b %Y}. "
                    "Mark them as deferred instead.",
                )
        batch = f"CAMP-{camp.id:04d}"
        donation = Donation(
            hospital_id=hospital.id,
            donor_id=donor.id,
            donation_date=camp.camp_date,
            component="Whole Blood",
            units=1,
            batch_id=batch,
        )
        db.add(donation)
        db.flush()
        if donor.last_donation is None or camp.camp_date > donor.last_donation:
            donor.last_donation = camp.camp_date
        donor.never_donated = False
        stock_ops.inward(
            db, hospital, donor.blood_group, "Whole Blood", 1,
            stock_ops.default_expiry("Whole Blood", camp.camp_date),
            reason="Camp donation", staff=hospital.contact_name or hospital.name,
            batch_code=batch, source="camp",
        )
        if db.scalar(
            select(DonorHospitalLink.id).where(
                DonorHospitalLink.donor_id == donor.id, DonorHospitalLink.hospital_id == hospital.id
            )
        ) is None:
            db.add(DonorHospitalLink(donor_id=donor.id, hospital_id=hospital.id))
        notify(
            db, user.id, "Donation recorded",
            f"Thank you for donating at \"{camp.title}\". {hospital.name} recorded your donation.",
            "donation",
        )
        log_activity(
            db, hospital.id, "check_circle", "good",
            f"Camp donation: {donor.blood_group} from {short_name(user.name)} at {camp.title}",
        )
    else:
        notify(
            db, user.id, "Camp visit recorded",
            f"Thank you for coming to \"{camp.title}\". You could not donate this time.",
            "camp", camp.id,
        )

    db.add(CampAttendance(
        camp_id=camp.id, donor_id=donor.id, status=body.status,
        donation_id=donation.id if donation else None,
        note=(body.note or "").strip() or None,
    ))
    db.commit()
    counts = _counts(db, [camp.id])[camp.id]
    return {
        "message": "Donation recorded and 1 unit added to stock." if donation else "Visit recorded as deferred.",
        "donated": counts["donated"],
        "deferred": counts["deferred"],
    }