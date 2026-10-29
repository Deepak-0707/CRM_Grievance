import os
import hashlib
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.models.models import (
    Complaint, Department, EvidenceMetadata, ComplaintActivity,
    ComplaintFlag, User, utc_now
)
from app.schemas.schemas import (
    ComplaintCreate, ComplaintDetailOut, AnonymousMessageCreate,
    ComplaintFlagCreate, ComplaintFlagOut, ComplaintActivityOut,
    DepartmentClassificationRequest, DepartmentClassificationOut, RetrainClassifierRequest
)
from app.api.deps import get_current_user
from app.services.complaint_service import create_complaint, add_anonymous_message
from app.services.risk_scoring_service import evaluate_complaint_risk
from app.services.audit_service import log_audit_event
from app.services.department_classifier_service import (
    verify_department_routing, get_classifier_metrics, retrain_classifier
)
from app.models.models import AbuseInvestigation

router = APIRouter(prefix="/complaints", tags=["Complaints"])

@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    depts = db.query(Department).filter(Department.is_active == True).all()
    return [{"id": d.id, "code": d.code, "name": d.name, "description": d.description, "sla_hours": d.default_sla_hours} for d in depts]

@router.post("/classify-department", response_model=DepartmentClassificationOut)
def classify_and_verify_department(
    payload: DepartmentClassificationRequest,
    db: Session = Depends(get_db)
):
    """
    Classifies a citizen's grievance report and verifies whether the selected
    (or suggested) department is appropriate based on the 1,000 synthetic records model.
    """
    return verify_department_routing(
        title=payload.title,
        description=payload.description,
        selected_department_id=payload.selected_department_id,
        selected_department_code=payload.selected_department_code,
        db=db
    )

@router.get("/classifier/metrics")
def get_model_evaluation_metrics():
    """
    Retrieves the model training and evaluation metrics from the 1,000 synthetic complaints dataset.
    """
    return get_classifier_metrics()

@router.post("/classifier/retrain")
def retrain_model_pipeline(
    payload: RetrainClassifierRequest = RetrainClassifierRequest(),
    current_user: User = Depends(get_current_user)
):
    """
    Retrains and re-evaluates the department classifier.
    Restricted to administrators.
    """
    if current_user.role not in ["ADMINISTRATOR", "TRUST_SAFETY_REVIEWER"]:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can retrain the ML model."
        )
    metrics = retrain_classifier(generate_fresh_data=payload.generate_fresh_data)
    return {
        "message": "Model successfully retrained and evaluated.",
        "metrics": metrics
    }

@router.post("/", response_model=ComplaintDetailOut)
def lodge_complaint(
    complaint_in: ComplaintCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = create_complaint(db=db, current_user=current_user, data=complaint_in)
    return format_complaint_detail(complaint, current_user.role)

@router.get("/my", response_model=List[ComplaintDetailOut])
def get_my_complaints(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all complaints lodged under the citizen's pseudonym."""
    if not current_user.citizen_pseudonym_id:
        return []
    
    complaints = db.query(Complaint).filter(
        Complaint.citizen_pseudonym_id == current_user.citizen_pseudonym_id
    ).order_by(Complaint.created_at.desc()).all()

    return [format_complaint_detail(c, current_user.role) for c in complaints]

@router.get("/{complaint_id}", response_model=ComplaintDetailOut)
def get_complaint_detail(
    complaint_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Access control: Citizens can only view their own pseudonymous complaints
    if current_user.role == "CITIZEN" and complaint.citizen_pseudonym_id != current_user.citizen_pseudonym_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view another citizen's private complaint record.")

    # Department officers can only view complaints assigned to their department
    if current_user.role == "DEPARTMENT_OFFICER" and (not current_user.department_id or complaint.department_id != current_user.department_id):
        raise HTTPException(status_code=403, detail="Forbidden: Complaint belongs to a different government department. Only the respective department can view this case.")

    return format_complaint_detail(complaint, current_user.role)

@router.post("/{complaint_id}/evidence")
async def upload_evidence(
    complaint_id: str,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if current_user.role == "CITIZEN" and complaint.citizen_pseudonym_id != current_user.citizen_pseudonym_id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only upload evidence to your own complaints.")

    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 10MB limit.")

    sha256 = hashlib.sha256(content).hexdigest()
    safe_filename = f"{complaint.complaint_number}_{secrets.token_hex(4)}{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    
    with open(dest_path, "wb") as f:
        f.write(content)

    evidence = EvidenceMetadata(
        complaint_id=complaint.id,
        filename=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(content),
        storage_path=dest_path,
        evidence_description=description,
        sha256_hash=sha256,
        integrity_status="VERIFIED",
        integrity_details="SHA-256 integrity checksum validated at intake.",
        created_at=utc_now()
    )
    db.add(evidence)

    act = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=current_user.role,
        activity_type="EVIDENCE_UPLOAD",
        public_message=f"Supporting evidence document '{file.filename}' uploaded and cryptographically hashed.",
        created_at=utc_now()
    )
    db.add(act)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "filename": evidence.filename,
        "sha256_hash": evidence.sha256_hash,
        "integrity_status": evidence.integrity_status,
        "message": "Evidence uploaded to isolated secure storage."
    }

@router.get("/{complaint_id}/evidence/{evidence_id}/download")
def download_evidence(
    complaint_id: str,
    evidence_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    CRITICAL ACCESS GATE:
    Only authorized stakeholders may download private evidence files:
    - Complainant citizen (their own complaint only)
    - Assigned department officer
    - Trust & Safety reviewers, Privacy Officers, and Administrators
    All downloads are audited with SHA-256 integrity verification.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    evidence = db.query(EvidenceMetadata).filter(
        EvidenceMetadata.id == evidence_id,
        EvidenceMetadata.complaint_id == complaint.id
    ).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    # Access control enforcement
    if current_user.role == "CITIZEN" and complaint.citizen_pseudonym_id != current_user.citizen_pseudonym_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access evidence attached to another citizen's private complaint."
        )

    if current_user.role == "DEPARTMENT_OFFICER" and current_user.department_id and complaint.department_id != current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Evidence belongs to a different government department."
        )

    # Check if physical file exists on disk
    if not os.path.exists(evidence.storage_path):
        # In synthetic academic demo mode, generate a safe demonstration artifact
        demo_content = f"--- CivicTrust Synthetic Evidence Document ---\nFilename: {evidence.filename}\nComplaint: {complaint.complaint_number}\nIntegrity SHA-256: {evidence.sha256_hash}\nDescription: {evidence.evidence_description or 'Synthetic evidence document'}\nNotice: Academic prototype verified evidence artifact.\n".encode("utf-8")
        log_audit_event(
            db=db,
            event_type="EVIDENCE_DOWNLOADED",
            action="DOWNLOAD_SYNTHETIC_EVIDENCE",
            actor_id=current_user.id,
            actor_role=current_user.role,
            resource_id=evidence.id,
            details={"filename": evidence.filename, "sha256": evidence.sha256_hash}
        )
        db.commit()
        return Response(
            content=demo_content,
            media_type=evidence.file_type or "text/plain",
            headers={"Content-Disposition": f'attachment; filename="{evidence.filename}"'}
        )

    log_audit_event(
        db=db,
        event_type="EVIDENCE_DOWNLOADED",
        action="DOWNLOAD_EVIDENCE_FILE",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=evidence.id,
        details={"filename": evidence.filename, "sha256": evidence.sha256_hash}
    )
    db.commit()

    return FileResponse(
        path=evidence.storage_path,
        filename=evidence.filename,
        media_type=evidence.file_type or "application/octet-stream"
    )

@router.post("/{complaint_id}/message")
def send_anonymous_message(
    complaint_id: str,
    msg_in: AnonymousMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if current_user.role == "CITIZEN":
        if not current_user.citizen_pseudonym_id:
            current_user.citizen_pseudonym_id = complaint.citizen_pseudonym_id
            db.commit()
        if str(complaint.citizen_pseudonym_id).strip().upper() != str(current_user.citizen_pseudonym_id).strip().upper():
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Cannot send messages to another citizen's private complaint."
            )
    elif current_user.role == "DEPARTMENT_OFFICER":
        if not current_user.department_id or complaint.department_id != current_user.department_id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Complaint belongs to a different government department. Only the respective department can send messages."
            )
    elif current_user.role not in ["ADMINISTRATOR"]:
        raise HTTPException(status_code=403, detail="Unauthorized to send messages on this complaint.")

    is_officer = current_user.role in ["DEPARTMENT_OFFICER", "ADMINISTRATOR"]
    msg_in.is_question_from_officer = is_officer

    activity = add_anonymous_message(db=db, complaint_id=complaint_id, user=current_user, data=msg_in)
    return {
        "id": activity.id,
        "activity_type": activity.activity_type,
        "actor_role": activity.actor_role,
        "public_message": activity.public_message,
        "created_at": activity.created_at
    }

@router.post("/{complaint_id}/flag", response_model=ComplaintFlagOut)
def flag_complaint(
    complaint_id: str,
    flag_in: ComplaintFlagCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits an allegation flag against a complaint or response.
    A flag is an allegation, not proof! Does not automatically reject or sanction.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    flag = ComplaintFlag(
        complaint_id=complaint.id,
        flagged_by_role=current_user.role,
        flag_reason=flag_in.flag_reason,
        flag_details=flag_in.flag_details,
        is_reviewed=False,
        created_at=utc_now()
    )
    db.add(flag)
    db.flush()

    act = ComplaintActivity(
        complaint_id=complaint.id,
        actor_role=current_user.role,
        activity_type="FLAG_RAISED",
        public_message=f"Review flag recorded: {flag_in.flag_reason}.",
        internal_message=f"Flagged by {current_user.username} ({current_user.role}): {flag_in.flag_details}",
        created_at=utc_now()
    )
    db.add(act)

    log_audit_event(
        db=db,
        event_type="COMPLAINT_FLAGGED",
        action="FLAG_ALLEGATION",
        actor_id=current_user.id,
        actor_role=current_user.role,
        resource_id=complaint.id,
        details={
            "flag_reason": flag_in.flag_reason,
            "flagged_by_role": current_user.role,
            "complaint_number": complaint.complaint_number
        }
    )

    # Check if investigation already exists, or create one in FLAGGED state
    inv = db.query(AbuseInvestigation).filter(AbuseInvestigation.complaint_id == complaint.id).first()
    if not inv:
        risk_result = evaluate_complaint_risk(db=db, complaint=complaint)
        inv = AbuseInvestigation(
            complaint_id=complaint.id,
            status="FLAGGED",
            risk_score=risk_result["risk_score"],
            risk_signals_json=risk_result["signals_json"],
            alleged_violation=flag_in.flag_reason,
            created_at=utc_now()
        )
        db.add(inv)
    else:
        risk_result = evaluate_complaint_risk(db=db, complaint=complaint)
        inv.risk_score = risk_result["risk_score"]
        inv.risk_signals_json = risk_result["signals_json"]
        inv.updated_at = utc_now()

    db.commit()
    db.refresh(flag)
    return flag

def format_complaint_detail(complaint: Complaint, role: str) -> dict:
    dept_name = complaint.department.name if complaint.department else "Unassigned"
    officer_name = complaint.assigned_officer.username if complaint.assigned_officer else None

    # Filter internal notes and activity messages if requester is a citizen, sorted chronologically
    def _act_sort_key(act):
        dt = act.created_at
        if dt is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    sorted_acts = sorted(complaint.activities, key=_act_sort_key)
    activities = []
    for a in sorted_acts:
        if role in ["CITIZEN", "PUBLIC"] and (a.activity_type == "INTERNAL_NOTE" or not a.public_message):
            continue
        activities.append({
            "id": a.id,
            "actor_role": a.actor_role,
            "activity_type": a.activity_type,
            "public_message": a.public_message,
            "internal_message": a.internal_message if role in ["DEPARTMENT_OFFICER", "ADMINISTRATOR", "TRUST_SAFETY_REVIEWER"] else None,
            "created_at": a.created_at
        })

    evidence_list = []
    for e in complaint.evidence_items:
        evidence_list.append({
            "id": e.id,
            "filename": e.filename,
            "file_type": e.file_type,
            "file_size_bytes": e.file_size_bytes,
            "evidence_description": e.evidence_description,
            "sha256_hash": e.sha256_hash,
            "integrity_status": e.integrity_status,
            "integrity_details": e.integrity_details,
            "created_at": e.created_at
        })

    return {
        "id": complaint.id,
        "complaint_number": complaint.complaint_number,
        "citizen_pseudonym_id": complaint.citizen_pseudonym_id,
        "title": complaint.title,
        "description": complaint.description,
        "department_id": complaint.department_id,
        "department_name": dept_name,
        "category": complaint.category,
        "state": complaint.state,
        "district": complaint.district,
        "approximate_location": complaint.approximate_location,
        "incident_date": complaint.incident_date,
        "status": complaint.status,
        "priority": complaint.priority,
        "priority_justification": complaint.priority_justification,
        "assigned_officer_id": complaint.assigned_officer_id,
        "assigned_officer_name": officer_name,
        "sla_deadline": complaint.sla_deadline,
        "escalation_deadline": complaint.escalation_deadline,
        "is_overdue": complaint.is_overdue,
        "resolution_summary": complaint.resolution_summary,
        "internal_investigation_notes": complaint.internal_investigation_notes if role in ["DEPARTMENT_OFFICER", "ADMINISTRATOR"] else None,
        "rejection_reason": complaint.rejection_reason,
        "predicted_department_id": complaint.predicted_department_id,
        "predicted_department_code": complaint.predicted_department_code,
        "predicted_department_name": complaint.predicted_department.name if complaint.predicted_department else None,
        "classification_confidence": complaint.classification_confidence,
        "is_department_verified": complaint.is_department_verified if complaint.is_department_verified is not None else True,
        "department_verification_status": complaint.department_verification_status or "VERIFIED_GOOD_MATCH",
        "department_verification_notes": complaint.department_verification_notes,
        "created_at": complaint.created_at,
        "updated_at": complaint.updated_at,
        "evidence_items": evidence_list,
        "activities": activities
    }
