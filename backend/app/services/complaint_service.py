import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import (
    Complaint, Department, ComplaintActivity, EvidenceMetadata,
    User, ComplaintAssignment, utc_now
)
from app.schemas.schemas import (
    ComplaintCreate, CaseStatusUpdate, CaseAssignmentUpdate,
    CasePriorityUpdate, InternalNoteCreate, AnonymousMessageCreate, ResolutionCreate
)
from app.services.audit_service import log_audit_event
from app.services.notification_service import notify_citizen, notify_officer, notify_department_officers
from app.services.department_classifier_service import verify_department_routing

ALL_VALID_STATUSES = [
    "SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "INVESTIGATING",
    "AWAITING_INFORMATION", "RESOLVED", "REJECTED_WITH_REASON", "APPEALED"
]
VALID_STATUS_TRANSITIONS = {
    status_key: ALL_VALID_STATUSES for status_key in ALL_VALID_STATUSES
}

def generate_complaint_number() -> str:
    year = datetime.now(timezone.utc).year
    rand_digits = secrets.randbelow(9000) + 1000
    return f"CT-{year}-{rand_digits}"

def create_complaint(
    db: Session,
    current_user: User,
    data: ComplaintCreate
) -> Complaint:
    """
    Submits a complaint anonymously using the user's citizen pseudonym.
    Rejects if user account does not have citizen role.
    """
    if current_user.role != "CITIZEN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered citizens may lodge complaints."
        )

    # Ensure citizen has a pseudonymous ID
    pseudonym = current_user.citizen_pseudonym_id
    if not pseudonym:
        pseudonym = f"CITIZEN-{secrets.token_hex(4).upper()}"
        current_user.citizen_pseudonym_id = pseudonym
        db.flush()

    target_dept_id = data.department_id
    if not target_dept_id:
        # ML Model automatically classifies the department if citizen didn't select one
        verification = verify_department_routing(
            title=data.title,
            description=data.description,
            selected_department_id=None,
            db=db
        )
        target_dept_id = verification.get("predicted_department_id")
        if not target_dept_id:
            first_dept = db.query(Department).first()
            target_dept_id = first_dept.id if first_dept else None
    else:
        # Run AI Department Classification and Verification
        verification = verify_department_routing(
            title=data.title,
            description=data.description,
            selected_department_id=target_dept_id,
            db=db
        )

    department = db.query(Department).filter(Department.id == target_dept_id).first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target civic department could not be found or assigned."
        )

    complaint_no = generate_complaint_number()
    while db.query(Complaint).filter(Complaint.complaint_number == complaint_no).first():
        complaint_no = generate_complaint_number()

    now = utc_now()
    sla_hours = department.default_sla_hours or 72
    sla_deadline = now + timedelta(hours=sla_hours)
    escalation_deadline = now + timedelta(hours=sla_hours + 48)

    complaint = Complaint(
        complaint_number=complaint_no,
        citizen_pseudonym_id=pseudonym,
        title=data.title,
        description=data.description,
        department_id=department.id,
        predicted_department_id=verification.get("predicted_department_id"),
        predicted_department_code=verification.get("predicted_department_code"),
        classification_confidence=verification.get("confidence"),
        is_department_verified=verification.get("is_good_department", True),
        department_verification_status=verification.get("verification_status", "VERIFIED_GOOD_MATCH"),
        department_verification_notes=verification.get("verification_message"),
        category=data.category,
        state=data.state,
        district=data.district,
        approximate_location=data.approximate_location,
        incident_date=data.incident_date,
        status="SUBMITTED",
        priority="MEDIUM",
        priority_justification="Initial citizen filing",
        sla_deadline=sla_deadline,
        escalation_deadline=escalation_deadline,
        is_overdue=False,
        consent_given=data.consent_given,
        created_at=now,
        updated_at=now
    )
    db.add(complaint)
    db.flush()

    # Create initial activity event
    activity = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role="CITIZEN",
        activity_type="STATUS_CHANGE",
        public_message=f"Complaint lodged under case reference {complaint_no}. Queued for department review.",
        created_at=now
    )
    db.add(activity)

    # If mismatch warning detected, log a system timeline advisory note
    if verification.get("verification_status") == "WARNING_MISMATCH":
        mismatch_note = ComplaintActivity(
            complaint_id=complaint.id,
            actor_role="SYSTEM",
            activity_type="SYSTEM_ALERT",
            public_message=f"AI Routing Advisory: Grievance text indicates {verification.get('predicted_department_name')} (confidence: {verification.get('confidence_pct')}). Lodged under {department.name}.",
            internal_message=verification.get("verification_message"),
            created_at=now
        )
        db.add(mismatch_note)

    # In-app notification to department officers
    notify_department_officers(
        db=db,
        department_id=department.id,
        title=f"New Grievance Lodged: {complaint_no}",
        message=f"New case in {data.district}: '{data.title}'. SLA: {sla_hours}h.",
        link="/crm"
    )

    log_audit_event(
        db=db,
        event_type="COMPLAINT_SUBMITTED",
        action="SUBMIT_ANONYMOUS_COMPLAINT",
        actor_id=pseudonym,
        actor_role="CITIZEN",
        resource_id=complaint.id,
        details={
            "complaint_number": complaint_no,
            "department": department.name,
            "category": data.category
        }
    )

    db.commit()
    db.refresh(complaint)
    return complaint

def update_case_status(
    db: Session,
    complaint_id: str,
    user: User,
    data: CaseStatusUpdate
) -> Complaint:
    """Updates complaint status with transition validation, audit logging and public/internal activity tracking."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = complaint.status
    allowed = VALID_STATUS_TRANSITIONS.get(old_status, [])
    if data.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid state transition: Cannot transition complaint from '{old_status}' to '{data.status}'."
        )

    complaint.status = data.status
    complaint.updated_at = utc_now()

    if data.status == "REJECTED_WITH_REASON":
        complaint.rejection_reason = data.rejection_reason or "Insufficient documentation or administrative jurisdiction."

    # Record activity
    pub_msg = data.public_note or f"Case status updated from {old_status} to {data.status}."
    activity = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=user.role,
        activity_type="STATUS_CHANGE",
        public_message=pub_msg,
        internal_message=data.internal_note,
        created_at=utc_now()
    )
    db.add(activity)

    # In-app notification to complainant citizen
    notify_citizen(
        db=db,
        citizen_pseudonym_id=complaint.citizen_pseudonym_id,
        title=f"Case Status Update: {complaint.complaint_number}",
        message=f"Status calibrated to '{data.status}'. {pub_msg}",
        link="/citizen"
    )

    log_audit_event(
        db=db,
        event_type="CASE_STATUS_TRANSITION",
        action=f"TRANSITION_{old_status}_TO_{data.status}",
        actor_id=user.id,
        actor_role=user.role,
        resource_id=complaint.id,
        details={
            "old_status": old_status,
            "new_status": data.status,
            "rejection_reason": data.rejection_reason
        }
    )

    db.commit()
    db.refresh(complaint)
    return complaint

def assign_case_to_officer(
    db: Session,
    complaint_id: str,
    assigned_by: User,
    data: CaseAssignmentUpdate
) -> Complaint:
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    assignee = db.query(User).filter(User.id == data.assigned_to_id).first()
    if not assignee or assignee.role != "DEPARTMENT_OFFICER":
        raise HTTPException(status_code=400, detail="Assignee must be an active Department Officer.")

    complaint.assigned_officer_id = assignee.id
    if complaint.status == "SUBMITTED":
        complaint.status = "ASSIGNED"
    complaint.updated_at = utc_now()

    assignment = ComplaintAssignment(
        complaint_id=complaint.id,
        assigned_by_id=assigned_by.id,
        assigned_to_id=assignee.id,
        assigned_at=utc_now(),
        notes=data.notes
    )
    db.add(assignment)

    activity = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=assigned_by.role,
        activity_type="ASSIGNMENT",
        public_message=f"Case assigned to designated grievance officer for investigation.",
        internal_message=f"Assigned to {assignee.username}. Notes: {data.notes or 'None'}",
        created_at=utc_now()
    )
    db.add(activity)

    # In-app notifications
    notify_officer(
        db=db,
        officer_id=assignee.id,
        title=f"Case Assigned: {complaint.complaint_number}",
        message=f"Case '{complaint.title}' assigned to you by {assigned_by.username}.",
        link="/crm"
    )
    notify_citizen(
        db=db,
        citizen_pseudonym_id=complaint.citizen_pseudonym_id,
        title=f"Investigating Officer Assigned: {complaint.complaint_number}",
        message="An investigating officer has been designated to review and remediate your grievance.",
        link="/citizen"
    )

    log_audit_event(
        db=db,
        event_type="CASE_ASSIGNMENT",
        action="ASSIGN_OFFICER",
        actor_id=assigned_by.id,
        actor_role=assigned_by.role,
        resource_id=complaint.id,
        details={"assigned_to": assignee.username, "notes": data.notes}
    )

    db.commit()
    db.refresh(complaint)
    return complaint

def transfer_case_department(
    db: Session,
    complaint_id: str,
    transferred_by: User,
    new_department_id: str,
    justification: str
) -> Complaint:
    """Transfers a grievance to another department with SLA recalibration and audit tracking."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    new_dept = db.query(Department).filter(Department.id == new_department_id).first()
    if not new_dept:
        raise HTTPException(status_code=404, detail="Target department not found")

    old_dept_name = complaint.department.name if complaint.department else "Unassigned"
    complaint.department_id = new_dept.id
    complaint.assigned_officer_id = None  # Reset officer on department transfer
    complaint.status = "ASSIGNED"
    
    # Recalibrate SLA for new department
    now = utc_now()
    complaint.sla_deadline = now + timedelta(hours=new_dept.default_sla_hours)
    complaint.escalation_deadline = now + timedelta(hours=new_dept.default_sla_hours + 48)
    complaint.is_overdue = False
    complaint.updated_at = now

    act = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=transferred_by.role,
        activity_type="DEPARTMENT_TRANSFER",
        public_message=f"Case reassigned from {old_dept_name} to {new_dept.name}. SLA calibrated to {new_dept.default_sla_hours} hours.",
        internal_message=f"Department transfer by {transferred_by.username}. Justification: {justification}",
        created_at=now
    )
    db.add(act)

    notify_department_officers(
        db=db,
        department_id=new_dept.id,
        title=f"Incoming Case Transfer: {complaint.complaint_number}",
        message=f"Case transferred from {old_dept_name}: '{complaint.title}'. Justification: {justification}",
        link="/crm"
    )

    notify_citizen(
        db=db,
        citizen_pseudonym_id=complaint.citizen_pseudonym_id,
        title=f"Department Transfer: {complaint.complaint_number}",
        message=f"Grievance reassigned to {new_dept.name} for specialized jurisdiction handling.",
        link="/citizen"
    )

    log_audit_event(
        db=db,
        event_type="CASE_DEPARTMENT_TRANSFERRED",
        action="TRANSFER_DEPARTMENT",
        actor_id=transferred_by.id,
        actor_role=transferred_by.role,
        resource_id=complaint.id,
        details={
            "old_department": old_dept_name,
            "new_department": new_dept.name,
            "justification": justification
        }
    )

    db.commit()
    db.refresh(complaint)
    return complaint

def add_anonymous_message(
    db: Session,
    complaint_id: str,
    user: User,
    data: AnonymousMessageCreate
) -> ComplaintActivity:
    """Supports 2-way anonymous Q&A between officer and citizen without revealing citizen identity."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    activity_type = "OFFICER_QUESTION" if data.is_question_from_officer else "CITIZEN_REPLY"
    if data.is_question_from_officer and complaint.status in ["ASSIGNED", "INVESTIGATING"]:
        complaint.status = "AWAITING_INFORMATION"
        complaint.updated_at = utc_now()
    elif not data.is_question_from_officer and complaint.status == "AWAITING_INFORMATION":
        complaint.status = "INVESTIGATING"
        complaint.updated_at = utc_now()

    activity = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role="OFFICER" if data.is_question_from_officer else "CITIZEN",
        activity_type=activity_type,
        public_message=data.message,
        created_at=utc_now()
    )
    db.add(activity)

    # In-app notifications
    try:
        if data.is_question_from_officer:
            notify_citizen(
                db=db,
                citizen_pseudonym_id=complaint.citizen_pseudonym_id,
                title=f"Clarification Requested: {complaint.complaint_number}",
                message=f"Investigating officer requested clarification: '{data.message[:100]}'",
                link="/citizen"
            )
        else:
            if complaint.assigned_officer_id:
                officer = db.query(User).filter(User.id == complaint.assigned_officer_id).first()
                if officer:
                    notify_officer(
                        db=db,
                        officer_id=officer.id,
                        title=f"Citizen Reply: {complaint.complaint_number}",
                        message=f"Complainant responded: '{data.message[:100]}'",
                        link="/crm"
                    )
                elif complaint.department_id:
                    notify_department_officers(
                        db=db,
                        department_id=complaint.department_id,
                        title=f"Citizen Reply: {complaint.complaint_number}",
                        message=f"Complainant responded to case {complaint.complaint_number}.",
                        link="/crm"
                    )
            elif complaint.department_id:
                notify_department_officers(
                    db=db,
                    department_id=complaint.department_id,
                    title=f"Citizen Reply: {complaint.complaint_number}",
                    message=f"Complainant responded to case {complaint.complaint_number}.",
                    link="/crm"
                )
    except Exception:
        pass

    log_audit_event(
        db=db,
        event_type="ANONYMOUS_COMMUNICATION_LOGGED",
        action=f"SEND_{activity_type}",
        actor_id=user.id if user.role != "CITIZEN" else complaint.citizen_pseudonym_id,
        actor_role=user.role,
        resource_id=complaint.id,
        details={
            "complaint_number": complaint.complaint_number,
            "activity_type": activity_type,
            "message_length": len(data.message)
        }
    )

    db.commit()
    db.refresh(activity)
    return activity

def resolve_complaint(
    db: Session,
    complaint_id: str,
    officer: User,
    data: ResolutionCreate
) -> Complaint:
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = "RESOLVED"
    complaint.resolution_summary = data.resolution_summary
    complaint.internal_investigation_notes = data.internal_resolution_notes
    complaint.updated_at = utc_now()

    activity = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=officer.role,
        activity_type="RESOLUTION",
        public_message=f"Grievance resolved: {data.resolution_summary}",
        internal_message=data.internal_resolution_notes,
        created_at=utc_now()
    )
    db.add(activity)

    notify_citizen(
        db=db,
        citizen_pseudonym_id=complaint.citizen_pseudonym_id,
        title=f"Grievance Resolved: {complaint.complaint_number}",
        message=f"Official Resolution: {data.resolution_summary}",
        link="/citizen"
    )

    log_audit_event(
        db=db,
        event_type="CASE_STATUS_TRANSITION",
        action="RESOLVE_COMPLAINT",
        actor_id=officer.id,
        actor_role=officer.role,
        resource_id=complaint.id,
        details={"summary": data.resolution_summary}
    )

    db.commit()
    db.refresh(complaint)
    return complaint
