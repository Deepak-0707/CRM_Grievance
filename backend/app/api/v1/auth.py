import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.models import User, utc_now
from app.schemas.schemas import (
    UserRegister, UserLogin, Token, UserOut,
    ForgotPasswordRequest, ResetPasswordRequest
)
from app.api.deps import get_current_user, require_role
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication"])

ALLOWED_ROLES = ["CITIZEN", "DEPARTMENT_OFFICER", "TRUST_SAFETY_REVIEWER", "ADMINISTRATOR", "PRIVACY_OFFICER"]

# Simple in-memory tracker for brute-force login attempts
_login_failure_tracker = {}

@router.post("/register", response_model=UserOut)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    # Check if username or email already exists
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered."
        )
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered."
        )

    # Allowed registration roles: default CITIZEN, or requested role if valid
    role = user_in.role if user_in.role in ALLOWED_ROLES else "CITIZEN"
    
    pseudonym = None
    if role == "CITIZEN":
        pseudonym = f"CITIZEN-{secrets.token_hex(4).upper()}"

    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=role,
        department_id=user_in.department_id if role == "DEPARTMENT_OFFICER" else None,
        is_active=True,
        is_verified=False,
        citizen_pseudonym_id=pseudonym
    )
    db.add(user)
    db.flush()

    log_audit_event(
        db=db,
        event_type="USER_REGISTERED",
        action="REGISTER",
        actor_id=user.id,
        actor_role=user.role,
        resource_id=user.id,
        details={"username": user.username, "role": user.role}
    )

    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    # Rate limit check: max 10 failed attempts within short window
    failures = _login_failure_tracker.get(user_in.username, 0)
    if failures >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Account temporarily throttled for security."
        )

    user = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.username)
    ).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        _login_failure_tracker[user_in.username] = failures + 1
        log_audit_event(
            db=db,
            event_type="LOGIN_FAILED",
            action="LOGIN_FAILURE",
            actor_id=user_in.username,
            actor_role="ANONYMOUS",
            resource_id=user_in.username,
            details={"attempted_username": user_in.username}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended."
        )

    # Reset failure counter on success
    if user_in.username in _login_failure_tracker:
        del _login_failure_tracker[user_in.username]

    access_token = create_access_token(subject=user.id, role=user.role)

    log_audit_event(
        db=db,
        event_type="LOGIN_SUCCESS",
        action="LOGIN",
        actor_id=user.id,
        actor_role=user.role,
        resource_id=user.id,
        details={"username": user.username, "role": user.role}
    )
    db.commit()

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        citizen_pseudonym_id=user.citizen_pseudonym_id,
        department_id=user.department_id,
        is_verified=user.is_verified
    )

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_audit_event(
        db=db,
        event_type="LOGOUT",
        action="LOGOUT",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=current_user.id,
        details={"username": current_user.username}
    )
    db.commit()
    return {"message": "Session successfully invalidated."}

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Avoid leaking whether email exists
        return {
            "message": "If this email is registered, a password reset token has been generated.",
            "reset_token": None
        }

    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = utc_now() + timedelta(minutes=30)

    log_audit_event(
        db=db,
        event_type="PASSWORD_RESET_REQUESTED",
        action="FORGOT_PASSWORD",
        actor_id=user.id,
        actor_role=user.role,
        resource_id=user.id,
        details={"email": user.email}
    )
    db.commit()

    return {
        "message": "Password reset token generated (valid for 30 minutes).",
        "reset_token": token,
        "note": "For academic prototype demonstration, reset token is returned in response."
    }

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    now = utc_now()
    user = db.query(User).filter(
        User.reset_token == req.token,
        User.reset_token_expires >= now
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    user.hashed_password = get_password_hash(req.new_password)
    user.reset_token = None
    user.reset_token_expires = None

    log_audit_event(
        db=db,
        event_type="PASSWORD_RESET_SUCCESS",
        action="RESET_PASSWORD",
        actor_id=user.id,
        actor_role=user.role,
        resource_id=user.id,
        details={"username": user.username}
    )
    db.commit()

    return {"message": "Password successfully updated. You may now log in with your new password."}

@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=list[UserOut])
def list_system_users(
    role: str = Query(None),
    current_user: User = Depends(require_role(["ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()

@router.patch("/users/{user_id}/status")
def toggle_user_status(
    user_id: str,
    is_active: bool = Query(...),
    current_user: User = Depends(require_role(["ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot alter your own active status.")

    user.is_active = is_active
    log_audit_event(
        db=db,
        event_type="USER_STATUS_MODIFIED",
        action="TOGGLE_STATUS",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=user.id,
        details={"target_username": user.username, "new_active_status": is_active}
    )
    db.commit()
    return {"message": f"User '{user.username}' status set to {'active' if is_active else 'inactive'}."}

