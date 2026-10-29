from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.models import Complaint, Department, User, ComplaintActivity, utc_now
from app.schemas.schemas import (
    ComplaintDetailOut, CaseStatusUpdate, CaseAssignmentUpdate,
    CasePriorityUpdate, InternalNoteCreate, ResolutionCreate,
    DepartmentWorkloadOut, DepartmentSLAUpdate, CaseDepartmentTransfer
)
from app.api.deps import get_current_user, require_role
from app.services.complaint_service import (
    update_case_status, assign_case_to_officer, resolve_complaint, transfer_case_department
)
from app.api.v1.complaints import format_complaint_detail
from app.services.audit_service import log_audit_event

def _is_overdue(deadline, now) -> bool:
    if not deadline:
        return False
    d = deadline if deadline.tzinfo is not None else deadline.replace(tzinfo=timezone.utc)
    n = now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)
    return d < n

router = APIRouter(prefix="/crm", tags=["CRM Case Management"])

@router.get("/cases")
def list_cases(
    department_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to_me: Optional[bool] = Query(False),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR", "TRUST_SAFETY_REVIEWER"])),
    db: Session = Depends(get_db)
):
    """
    Searchable CRM table & Kanban query with role-based scoping.
    Officers default to viewing their department's cases.
    """
    query = db.query(Complaint)

    # Scoping for Department Officers - Strictly restricted to assigned department
    if current_user.role == "DEPARTMENT_OFFICER":
        if not current_user.department_id:
            return []
        query = query.filter(Complaint.department_id == current_user.department_id)
        if assigned_to_me:
            query = query.filter(Complaint.assigned_officer_id == current_user.id)
    elif department_id:
        query = query.filter(Complaint.department_id == department_id)

    if status:
        query = query.filter(Complaint.status == status)

    if priority:
        query = query.filter(Complaint.priority == priority)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                Complaint.complaint_number.ilike(search_fmt),
                Complaint.title.ilike(search_fmt),
                Complaint.district.ilike(search_fmt),
                Complaint.approximate_location.ilike(search_fmt)
            )
        )

    cases = query.order_by(Complaint.created_at.desc()).all()

    # Check for overdue cases against SLA deadline
    now = utc_now()
    results = []
    for c in cases:
        if c.sla_deadline and c.status not in ["RESOLVED", "REJECTED_WITH_REASON"] and _is_overdue(c.sla_deadline, now):
            c.is_overdue = True
        results.append(format_complaint_detail(c, current_user.role))

    return results

@router.get("/kanban")
def get_kanban_board(
    department_id: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR", "TRUST_SAFETY_REVIEWER"])),
    db: Session = Depends(get_db)
):
    """Returns grouped columns for interactive Kanban CRM board."""
    columns = {
        "SUBMITTED": [],
        "UNDER_REVIEW": [],
        "ASSIGNED": [],
        "INVESTIGATING": [],
        "AWAITING_INFORMATION": [],
        "RESOLVED": [],
        "REJECTED_WITH_REASON": [],
        "APPEALED": []
    }

    query = db.query(Complaint)
    if current_user.role == "DEPARTMENT_OFFICER":
        if not current_user.department_id:
            return columns
        query = query.filter(Complaint.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(Complaint.department_id == department_id)

    cases = query.order_by(Complaint.created_at.desc()).all()

    now = utc_now()
    for c in cases:
        if c.sla_deadline and c.status not in ["RESOLVED", "REJECTED_WITH_REASON"] and _is_overdue(c.sla_deadline, now):
            c.is_overdue = True
        status_key = c.status if c.status in columns else "SUBMITTED"
        columns[status_key].append(format_complaint_detail(c, current_user.role))

    return columns

@router.patch("/cases/{complaint_id}/status")
def change_case_status(
    complaint_id: str,
    status_in: CaseStatusUpdate,
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "DEPARTMENT_OFFICER" and (not current_user.department_id or complaint.department_id != current_user.department_id):
        raise HTTPException(status_code=403, detail="Forbidden: Complaint belongs to a different government department. Only the respective department can view or modify this case.")

    complaint = update_case_status(db=db, complaint_id=complaint_id, user=current_user, data=status_in)
    return format_complaint_detail(complaint, current_user.role)

@router.patch("/cases/{complaint_id}/assign")
def assign_case(
    complaint_id: str,
    assign_in: CaseAssignmentUpdate,
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "DEPARTMENT_OFFICER" and (not current_user.department_id or complaint.department_id != current_user.department_id):
        raise HTTPException(status_code=403, detail="Forbidden: Complaint belongs to a different government department. Only the respective department can view or modify this case.")

    complaint = assign_case_to_officer(db=db, complaint_id=complaint_id, assigned_by=current_user, data=assign_in)
    return format_complaint_detail(complaint, current_user.role)

@router.patch("/cases/{complaint_id}/priority")
def update_case_priority(
    complaint_id: str,
    priority_in: CasePriorityUpdate,
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "DEPARTMENT_OFFICER" and (not current_user.department_id or complaint.department_id != current_user.department_id):
        raise HTTPException(status_code=403, detail="Forbidden: Complaint belongs to a different government department. Only the respective department can view or modify this case.")

    complaint.priority = priority_in.priority
    complaint.priority_justification = priority_in.priority_justification
    complaint.updated_at = utc_now()

    act = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=current_user.role,
        activity_type="PRIORITY_CHANGE",
        public_message=f"Investigation priority calibrated to {priority_in.priority}.",
        internal_message=f"Priority adjusted to {priority_in.priority}. Justification: {priority_in.priority_justification}",
        created_at=utc_now()
    )
    db.add(act)

    log_audit_event(
        db=db,
        event_type="CASE_PRIORITY_UPDATED",
        action="UPDATE_PRIORITY",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=complaint.id,
        details={"new_priority": priority_in.priority, "justification": priority_in.priority_justification}
    )

    db.commit()
    db.refresh(complaint)
    return format_complaint_detail(complaint, current_user.role)

@router.post("/cases/{complaint_id}/internal-notes")
def add_internal_note(
    complaint_id: str,
    note_in: InternalNoteCreate,
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR", "TRUST_SAFETY_REVIEWER"])),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "DEPARTMENT_OFFICER" and (not current_user.department_id or complaint.department_id != current_user.department_id):
        raise HTTPException(status_code=403, detail="Forbidden: Complaint belongs to a different government department. Only the respective department can view or modify this case.")

    # Append to existing notes or set
    new_note_entry = f"[{utc_now().strftime('%Y-%m-%d %H:%M:%S UTC')} - {current_user.username} ({current_user.role})]: {note_in.internal_note}"
    if complaint.internal_investigation_notes:
        complaint.internal_investigation_notes += f"\n\n{new_note_entry}"
    else:
        complaint.internal_investigation_notes = new_note_entry

    act = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=current_user.role,
        activity_type="INTERNAL_NOTE",
        internal_message=note_in.internal_note,
        created_at=utc_now()
    )
    db.add(act)

    log_audit_event(
        db=db,
        event_type="INTERNAL_NOTE_ADDED",
        action="RECORD_INTERNAL_NOTE",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=complaint.id,
        details={
            "complaint_number": complaint.complaint_number,
            "note_preview": note_in.internal_note[:100]
        }
    )

    db.commit()
    return {"message": "Internal note recorded.", "notes": complaint.internal_investigation_notes}

@router.post("/cases/{complaint_id}/resolve")
def resolve_case(
    complaint_id: str,
    res_in: ResolutionCreate,
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "DEPARTMENT_OFFICER" and (not current_user.department_id or complaint.department_id != current_user.department_id):
        raise HTTPException(status_code=403, detail="Forbidden: Complaint belongs to a different government department. Only the respective department can view or modify this case.")

    complaint = resolve_complaint(db=db, complaint_id=complaint_id, officer=current_user, data=res_in)
    return format_complaint_detail(complaint, current_user.role)

@router.post("/cases/{complaint_id}/transfer")
def transfer_case(
    complaint_id: str,
    transfer_in: CaseDepartmentTransfer,
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    """Transfers a case across departments with SLA recalibration and audit tracking."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "DEPARTMENT_OFFICER" and (not current_user.department_id or complaint.department_id != current_user.department_id):
        raise HTTPException(status_code=403, detail="Forbidden: Complaint belongs to a different government department. Only the respective department can view or modify this case.")

    complaint = transfer_case_department(
        db=db,
        complaint_id=complaint_id,
        transferred_by=current_user,
        new_department_id=transfer_in.new_department_id,
        justification=transfer_in.transfer_justification
    )
    return format_complaint_detail(complaint, current_user.role)

@router.get("/departments", response_model=List[DepartmentWorkloadOut])
def list_department_workloads(
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR", "TRUST_SAFETY_REVIEWER"])),
    db: Session = Depends(get_db)
):
    """Returns department workload breakdown. Department Officers only receive their scoped department."""
    if current_user.role == "DEPARTMENT_OFFICER":
        depts = db.query(Department).filter(Department.id == current_user.department_id).all() if current_user.department_id else []
    else:
        depts = db.query(Department).all()
    now = utc_now()
    results = []
    for d in depts:
        officer_count = db.query(User).filter(
            User.role == "DEPARTMENT_OFFICER",
            User.department_id == d.id,
            User.is_active == True
        ).count()

        active_cases = db.query(Complaint).filter(
            Complaint.department_id == d.id,
            Complaint.status.notin_(["RESOLVED", "REJECTED_WITH_REASON"])
        ).count()

        overdue_cases = db.query(Complaint).filter(
            Complaint.department_id == d.id,
            Complaint.status.notin_(["RESOLVED", "REJECTED_WITH_REASON"]),
            Complaint.sla_deadline < now
        ).count()

        results.append(
            DepartmentWorkloadOut(
                id=d.id,
                code=d.code,
                name=d.name,
                description=d.description,
                default_sla_hours=d.default_sla_hours,
                is_active=d.is_active,
                officer_count=officer_count,
                active_cases=active_cases,
                overdue_cases=overdue_cases
            )
        )
    return results

@router.patch("/departments/{department_id}/sla")
def update_department_sla(
    department_id: str,
    sla_in: DepartmentSLAUpdate,
    current_user: User = Depends(require_role(["ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    """Configures SLA policy and response deadlines for a department."""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    old_sla = dept.default_sla_hours
    dept.default_sla_hours = sla_in.default_sla_hours
    if sla_in.description:
        dept.description = sla_in.description

    log_audit_event(
        db=db,
        event_type="DEPARTMENT_SLA_MODIFIED",
        action="UPDATE_SLA_POLICY",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=dept.id,
        details={
            "department_code": dept.code,
            "old_sla_hours": old_sla,
            "new_sla_hours": sla_in.default_sla_hours
        }
    )
    db.commit()
    db.refresh(dept)
    return {
        "message": f"Department {dept.code} SLA updated to {dept.default_sla_hours} hours.",
        "department_id": dept.id,
        "default_sla_hours": dept.default_sla_hours
    }

@router.get("/departments/{department_id}/officers")
def list_department_officers(
    department_id: str,
    current_user: User = Depends(require_role(["DEPARTMENT_OFFICER", "ADMINISTRATOR"])),
    db: Session = Depends(get_db)
):
    """Lists eligible officers in department for case assignment."""
    officers = db.query(User).filter(
        User.role == "DEPARTMENT_OFFICER",
        User.department_id == department_id,
        User.is_active == True
    ).all()
    return [{"id": o.id, "username": o.username, "email": o.email} for o in officers]

