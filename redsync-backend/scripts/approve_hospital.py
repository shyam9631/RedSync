"""Approve (or reject) a hospital application without an admin screen. Run from redsync-backend:

    python -m scripts.approve_hospital            # list pending applications
    python -m scripts.approve_hospital 3          # approve hospital #3 and print its facility code
    python -m scripts.approve_hospital 3 reject   # reject hospital #3
"""
import sys

from sqlalchemy import select

from app import models_more  # noqa: F401  (registers every table)
from app.database import SessionLocal
from app.models import BloodStock, Hospital, utcnow
from app.utils import BLOOD_GROUPS, notify


def main() -> None:
    db = SessionLocal()
    try:
        if len(sys.argv) < 2:
            rows = db.scalars(select(Hospital).where(Hospital.status == "pending").order_by(Hospital.id)).all()
            if not rows:
                print("No pending applications.")
            for h in rows:
                print(f"#{h.id}  {h.name}  ({h.city})  reg {h.reg_number}  license: {'yes' if h.license_file else 'NO'}")
            return

        hospital = db.get(Hospital, int(sys.argv[1]))
        if hospital is None:
            print("Hospital not found.")
            return

        if len(sys.argv) > 2 and sys.argv[2] == "reject":
            if hospital.status == "approved":
                print("This hospital is already approved.")
                return
            hospital.status = "rejected"
            db.commit()
            print(f"Rejected: {hospital.name}")
            return

        if hospital.status != "approved":
            hospital.status = "approved"
            hospital.approved_at = utcnow()
            hospital.facility_code = f"HSP-{hospital.id:04d}"
            existing = {s.blood_group for s in hospital.stock}
            for group in BLOOD_GROUPS:
                if group not in existing:
                    db.add(BloodStock(hospital_id=hospital.id, blood_group=group, units=0))
            notify(db, hospital.user_id, "Application approved", f"Your facility code is {hospital.facility_code}.", "info")
            db.commit()
        print(f"Approved: {hospital.name}")
        print(f"Facility code: {hospital.facility_code}   Staff email: {hospital.user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
