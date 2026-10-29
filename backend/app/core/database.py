from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def ensure_db_columns(bind_engine):
    """Safely adds newly introduced columns to existing SQLite tables if not present."""
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(bind_engine)
        if "complaints" in inspector.get_table_names():
            existing_cols = {c["name"] for c in inspector.get_columns("complaints")}
            with bind_engine.connect() as conn:
                if "predicted_department_id" not in existing_cols:
                    conn.execute(text("ALTER TABLE complaints ADD COLUMN predicted_department_id VARCHAR(36)"))
                if "predicted_department_code" not in existing_cols:
                    conn.execute(text("ALTER TABLE complaints ADD COLUMN predicted_department_code VARCHAR(20)"))
                if "classification_confidence" not in existing_cols:
                    conn.execute(text("ALTER TABLE complaints ADD COLUMN classification_confidence FLOAT"))
                if "is_department_verified" not in existing_cols:
                    conn.execute(text("ALTER TABLE complaints ADD COLUMN is_department_verified BOOLEAN DEFAULT TRUE"))
                if "department_verification_status" not in existing_cols:
                    conn.execute(text("ALTER TABLE complaints ADD COLUMN department_verification_status VARCHAR(50) DEFAULT 'VERIFIED_GOOD_MATCH'"))
                if "department_verification_notes" not in existing_cols:
                    conn.execute(text("ALTER TABLE complaints ADD COLUMN department_verification_notes TEXT"))
                conn.commit()
    except Exception as e:
        print(f"[Database] Column check notice: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
