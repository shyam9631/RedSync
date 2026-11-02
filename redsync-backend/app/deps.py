from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Donor, Hospital, User
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=401,
        detail="Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise unauthorized

    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_role(*roles: str):
    """Use as a dependency to allow only some roles, e.g. require_role("hospital")."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="You do not have access to this.")
        return user

    return checker


def current_hospital(user: User = Depends(require_role("hospital"))) -> Hospital:
    hospital = user.hospital
    if hospital is None or hospital.status != "approved":
        raise HTTPException(status_code=403, detail="Your hospital account is not approved yet.")
    return hospital


def current_donor(user: User = Depends(require_role("donor"))) -> Donor:
    if user.donor is None:
        raise HTTPException(status_code=403, detail="Donor profile not found.")
    return user.donor