from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal, ensure_db_columns
from app.models.models import User
from app.services.seed_service import reset_and_seed_demo_data

# Import API Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.verification import router as verification_router
from app.api.v1.complaints import router as complaints_router
from app.api.v1.public import router as public_router
from app.api.v1.crm import router as crm_router
from app.api.v1.trust_safety import router as trust_safety_router
from app.api.v1.disclosure import router as disclosure_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.audit import router as audit_router
from app.api.v1.demo import router as demo_router
from app.api.v1.notifications import router as notifications_router

# Initialize database schema
Base.metadata.create_all(bind=engine)
ensure_db_columns(engine)

# Auto-seed database if fresh
with SessionLocal() as db:
    user_count = db.query(User).count()
    if user_count == 0:
        print("[CivicTrust] Seeding initial demo datasets for Scenarios A through H...")
        reset_and_seed_demo_data(db)
        print("[CivicTrust] Database successfully initialized with synthetic demo data.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="CivicTrust: Privacy-Preserving Citizen Grievance CRM"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(verification_router, prefix=settings.API_V1_STR)
app.include_router(complaints_router, prefix=settings.API_V1_STR)
app.include_router(public_router, prefix=settings.API_V1_STR)
app.include_router(crm_router, prefix=settings.API_V1_STR)
app.include_router(trust_safety_router, prefix=settings.API_V1_STR)
app.include_router(disclosure_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "system": "CivicTrust Backend API",
        "version": settings.VERSION
    }

@app.get("/")
def root():
    return {
        "title": "CivicTrust API - Privacy-Preserving Citizen Grievance CRM",
        "docs_url": "/docs",
        "system_status": "Operational"
    }
