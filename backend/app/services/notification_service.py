from sqlalchemy.orm import Session
from typing import Optional
from app.models.models import Notification, User, utc_now

def send_notification(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    link: Optional[str] = None
) -> Notification:
    """Creates a persistent in-app notification for a user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        link=link,
        is_read=False,
        created_at=utc_now()
    )
    db.add(notif)
    db.flush()
    return notif

def notify_citizen(
    db: Session,
    citizen_pseudonym_id: str,
    title: str,
    message: str,
    link: Optional[str] = None
) -> Optional[Notification]:
    """Finds user by citizen pseudonym and dispatches an in-app notification."""
    user = db.query(User).filter(User.citizen_pseudonym_id == citizen_pseudonym_id).first()
    if user:
        return send_notification(db, user.id, title, message, link)
    return None

def notify_department_officers(
    db: Session,
    department_id: str,
    title: str,
    message: str,
    link: Optional[str] = None
):
    """Notifies all officers assigned to a department."""
    officers = db.query(User).filter(
        User.role == "DEPARTMENT_OFFICER",
        User.department_id == department_id,
        User.is_active == True
    ).all()
    for off in officers:
        send_notification(db, off.id, title, message, link)

def notify_officer(
    db: Session,
    officer_id: str,
    title: str,
    message: str,
    link: Optional[str] = None
) -> Optional[Notification]:
    """Notifies a specific assigned officer."""
    return send_notification(db, officer_id, title, message, link)
