"""Create an admin account. Run from the redsync-backend folder:
    python -m scripts.create_admin
"""
from getpass import getpass

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.security import hash_password


def main() -> None:
    email = input("Admin email: ").strip().lower()
    name = input("Admin name: ").strip() or "Admin"
    password = getpass("Password (min 8 characters): ")
    if "@" not in email or len(password) < 8:
        print("Enter a valid email and a password of at least 8 characters.")
        return

    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == email)):
            print("That email already has an account.")
            return
        db.add(User(role="admin", name=name, email=email, password_hash=hash_password(password)))
        db.commit()
        print(f"Admin created: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()