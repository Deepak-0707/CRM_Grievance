from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.models import Complaint, Department, ComplaintActivity
from app.schemas.schemas import ComplaintPublicOut

router = APIRouter(prefix="/public", tags=["Public Transparency"])

@router.get("/complaints", response_model=List[ComplaintPublicOut])
def get_public_complaints(
    search: Optional[str] = Query(None, description="Search by complaint number, category, or approximate area"),
    department_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    CRITICAL PRIVACY BOUNDARY:
    Returns strictly sanitized public records.
    Never reveals complainant name, email, internal notes, or raw evidence.
    """
    query = db.query(Complaint).join(Complaint.department)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                Complaint.complaint_number.ilike(search_fmt),
                Complaint.category.ilike(search_fmt),
                Complaint.approximate_location.ilike(search_fmt),
                Complaint.district.ilike(search_fmt)
            )
        )

    if department_id:
        query = query.filter(Complaint.department_id == department_id)

    if status:
        query = query.filter(Complaint.status == status)

    if category:
        query = query.filter(Complaint.category == category)

    complaints = query.order_by(Complaint.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for c in complaints:
        # Build general location: only district and sanitized approximate zone
        gen_loc = f"{c.district} ({c.approximate_location})" if c.district else c.approximate_location
        results.append(
            ComplaintPublicOut(
                id=c.id,
                complaint_number=c.complaint_number,
                category=c.category,
                department_name=c.department.name if c.department else "Civic Department",
                general_location=gen_loc,
                incident_date=c.incident_date,
                status=c.status,
                resolution_summary=c.resolution_summary,
                created_at=c.created_at,
                updated_at=c.updated_at
            )
        )

    return results

@router.get("/complaints/{complaint_number}")
def get_public_complaint_timeline(
    complaint_number: str,
    db: Session = Depends(get_db)
):
    """View public sanitized timeline updates for a specific complaint."""
    complaint = db.query(Complaint).filter(Complaint.complaint_number == complaint_number).first()
    if not complaint:
        return {"error": "Complaint reference not found in public registry."}

    # Public-safe sanitized activities
    activities = []
    for a in complaint.activities:
        if a.public_message:
            activities.append({
                "activity_type": a.activity_type,
                "actor_role": a.actor_role,
                "public_update": a.public_message,
                "timestamp": a.created_at.isoformat()
            })

    return {
        "complaint_number": complaint.complaint_number,
        "department": complaint.department.name if complaint.department else "General Civic Services",
        "category": complaint.category,
        "status": complaint.status,
        "general_location": f"{complaint.district} ({complaint.approximate_location})",
        "incident_date": complaint.incident_date.isoformat(),
        "created_at": complaint.created_at.isoformat(),
        "resolution_summary": complaint.resolution_summary,
        "timeline_updates": activities,
        "transparency_notice": "CivicTrust Public Registry: Submissions represent community grievance filings. A filing constitutes an allegation under civic review and does not independently establish institutional liability."
    }
