import os
import json
import re
from typing import Optional, Dict, Any, List
import numpy as np
import joblib
from sqlalchemy.orm import Session

from app.models.models import Department
from app.ml.train_classifier import train_and_evaluate_model, DEPT_NAMES
from app.ml.dataset_generator import generate_1000_records, save_dataset

# Global in-memory cache for singleton pipeline & metrics
_CLASSIFIER_CACHE: Dict[str, Any] = {
    "pipeline": None,
    "metrics": None
}

def get_base_dirs():
    app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ml_dir = os.path.join(app_dir, "ml")
    data_dir = os.path.join(ml_dir, "data")
    model_dir = os.path.join(ml_dir, "model")
    return ml_dir, data_dir, model_dir

def load_classifier_pipeline():
    """
    Loads or trains the department classification pipeline and metrics.
    Ensures model artifacts exist on disk and caches them in memory.
    """
    global _CLASSIFIER_CACHE
    if _CLASSIFIER_CACHE["pipeline"] is not None and _CLASSIFIER_CACHE["metrics"] is not None:
        return _CLASSIFIER_CACHE["pipeline"], _CLASSIFIER_CACHE["metrics"]

    ml_dir, data_dir, model_dir = get_base_dirs()
    model_path = os.path.join(model_dir, "department_classifier.joblib")
    metrics_path = os.path.join(model_dir, "eval_metrics.json")
    json_path = os.path.join(data_dir, "synthetic_complaints_1000.json")

    # Generate synthetic dataset if not present
    if not os.path.exists(json_path):
        records = generate_1000_records()
        save_dataset(records, data_dir)

    # Train model if artifacts missing
    if not os.path.exists(model_path) or not os.path.exists(metrics_path):
        metrics = train_and_evaluate_model()
    else:
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics = json.load(f)

    pipeline = joblib.load(model_path)
    _CLASSIFIER_CACHE["pipeline"] = pipeline
    _CLASSIFIER_CACHE["metrics"] = metrics
    return pipeline, metrics

def extract_matched_keywords(text: str, dept_code: str, metrics: Dict[str, Any]) -> List[str]:
    """Extracts top domain features that appear in the grievance text."""
    top_features_dict = metrics.get("top_keywords_per_department", {})
    dept_info = top_features_dict.get(dept_code, {})
    top_features = dept_info.get("top_features", [])

    text_lower = text.lower()
    matched = []
    for feat in top_features:
        # Check whole word match or phrase match
        pattern = r"\b" + re.escape(feat.lower()) + r"\b"
        if re.search(pattern, text_lower):
            matched.append(feat)

    # If no top features matched directly, extract relevant tokens
    if not matched:
        words = re.findall(r"\b[a-zA-Z]{4,}\b", text_lower)
        for w in words:
            if w in [f.lower() for f in top_features]:
                matched.append(w)
                if len(matched) >= 3:
                    break

    return matched[:6]

def classify_department(
    title: str,
    description: str,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Classifies a citizen's grievance report into one of the 7 municipal/civic departments.
    Returns predicted department, confidence score, ranked alternatives, and extracted keywords.
    """
    pipeline, metrics = load_classifier_pipeline()
    text = f"{title.strip()} {description.strip()}".strip()

    if not text:
        # Default fallback
        first_dept = "MC"
        return {
            "predicted_department_code": first_dept,
            "predicted_department_name": DEPT_NAMES.get(first_dept, first_dept),
            "predicted_department_id": None,
            "confidence": 0.0,
            "confidence_pct": "0.0%",
            "detected_keywords": [],
            "department_rankings": []
        }

    classes = [str(c) for c in pipeline.classes_]
    probas = pipeline.predict_proba([text])[0]
    
    top_idx = int(np.argmax(probas))
    predicted_code = str(classes[top_idx])
    confidence = float(probas[top_idx])

    # Rank all departments by descending probability
    sorted_indices = np.argsort(probas)[::-1]
    rankings = []
    for idx in sorted_indices:
        code = str(classes[idx])
        p = float(probas[idx])
        rankings.append({
            "code": code,
            "name": DEPT_NAMES.get(code, code),
            "probability": round(p, 4),
            "percentage": f"{round(p * 100, 1)}%"
        })

    # Resolve Department ID from DB if session provided
    dept_id = None
    if db:
        dept_obj = db.query(Department).filter(Department.code == predicted_code).first()
        if dept_obj:
            dept_id = dept_obj.id

    detected_keywords = extract_matched_keywords(text, predicted_code, metrics)

    return {
        "predicted_department_code": predicted_code,
        "predicted_department_name": DEPT_NAMES.get(predicted_code, predicted_code),
        "predicted_department_id": dept_id,
        "confidence": round(confidence, 4),
        "confidence_pct": f"{round(confidence * 100, 1)}%",
        "detected_keywords": detected_keywords,
        "department_rankings": rankings
    }

def verify_department_routing(
    title: str,
    description: str,
    selected_department_id: Optional[str] = None,
    selected_department_code: Optional[str] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Verifies whether the target department chosen by a citizen (or proposed by system)
    is the correct, appropriate department for this grievance report.

    Validates against the trained classifier and returns a verification verdict,
    confidence score, mismatch warning (if applicable), and routing recommendation.
    """
    classification = classify_department(title, description, db=db)
    predicted_code = classification["predicted_department_code"]
    predicted_name = classification["predicted_department_name"]
    predicted_id = classification["predicted_department_id"]
    confidence = classification["confidence"]
    detected_keywords = classification["detected_keywords"]
    rankings = classification["department_rankings"]

    # Build quick lookup of probability per department code
    prob_map = {r["code"]: r["probability"] for r in rankings}

    # Resolve selected department
    selected_dept_code = selected_department_code
    selected_dept_name = None
    selected_dept_id = selected_department_id

    if db and selected_department_id:
        dept_record = db.query(Department).filter(Department.id == selected_department_id).first()
        if dept_record:
            selected_dept_code = dept_record.code
            selected_dept_name = dept_record.name

    if selected_dept_code and not selected_dept_name:
        selected_dept_name = DEPT_NAMES.get(selected_dept_code, selected_dept_code)

    # CASE A: No selected department provided -> verify the predicted department itself
    if not selected_dept_code:
        if confidence >= 0.70:
            is_good = True
            status = "VERIFIED_GOOD_MATCH"
            score = int(round(confidence * 100))
            msg = f"Verified Department: Grievance aligns directly with {predicted_name} ({classification['confidence_pct']} confidence)."
        elif confidence >= 0.40:
            is_good = True
            status = "ACCEPTABLE_MATCH"
            score = int(round(confidence * 100))
            msg = f"Acceptable Match: Plausible alignment with {predicted_name} ({classification['confidence_pct']} confidence)."
        else:
            is_good = False
            status = "UNCERTAIN"
            score = int(round(confidence * 100))
            msg = f"Ambiguous Grievance: Low classification confidence ({classification['confidence_pct']}). Please specify key details."

        return {
            **classification,
            "is_good_department": is_good,
            "verification_status": status,
            "verification_score": score,
            "verification_message": msg,
            "selected_department_code": None,
            "selected_department_name": None,
            "recommended_department_code": predicted_code,
            "recommended_department_name": predicted_name,
            "recommended_department_id": predicted_id
        }

    # CASE B: Selected department matches predicted department
    if selected_dept_code == predicted_code:
        if confidence >= 0.60:
            is_good = True
            status = "VERIFIED_GOOD_MATCH"
            score = int(round(confidence * 100))
            keyword_str = f" Key indicators: {', '.join(detected_keywords)}." if detected_keywords else ""
            msg = f"Verified Good Department: High alignment with {selected_dept_name} ({classification['confidence_pct']} confidence).{keyword_str}"
        else:
            is_good = True
            status = "ACCEPTABLE_MATCH"
            score = int(round(confidence * 100))
            msg = f"Acceptable Match: Grievance corresponds to {selected_dept_name} ({classification['confidence_pct']} confidence)."

        return {
            **classification,
            "is_good_department": is_good,
            "verification_status": status,
            "verification_score": score,
            "verification_message": msg,
            "selected_department_code": selected_dept_code,
            "selected_department_name": selected_dept_name,
            "recommended_department_code": predicted_code,
            "recommended_department_name": predicted_name,
            "recommended_department_id": predicted_id
        }

    # CASE C: Selected department DOES NOT match predicted department
    selected_prob = prob_map.get(selected_dept_code, 0.0)
    
    # Check if this is a severe mismatch or plausible overlap
    if confidence >= 0.40 and selected_prob < 0.30:
        is_good = False
        status = "WARNING_MISMATCH"
        score = int(round(selected_prob * 100))
        keyword_str = f" (detected indicators: {', '.join(detected_keywords[:3])})" if detected_keywords else ""
        msg = (
            f"Department Mismatch Warning: Your grievance report strongly indicates '{predicted_name}'{keyword_str} "
            f"with {classification['confidence_pct']} confidence, but you have selected '{selected_dept_name}' ({round(selected_prob * 100, 1)}%). "
            f"Routing to the wrong department may cause resolution delays or transfer."
        )
    else:
        is_good = True
        status = "PLAUSIBLE_OVERLAP"
        score = int(round(selected_prob * 100))
        msg = (
            f"Plausible Multi-Department Overlap: Grievance involves aspects of both {selected_dept_name} ({round(selected_prob * 100, 1)}%) "
            f"and {predicted_name} ({classification['confidence_pct']})."
        )

    return {
        **classification,
        "is_good_department": is_good,
        "verification_status": status,
        "verification_score": score,
        "verification_message": msg,
        "selected_department_code": selected_dept_code,
        "selected_department_name": selected_dept_name,
        "recommended_department_code": predicted_code,
        "recommended_department_name": predicted_name,
        "recommended_department_id": predicted_id
    }

def get_classifier_metrics() -> Dict[str, Any]:
    """Retrieves full evaluation report of the 1,000 synthetic records training and test split."""
    _, metrics = load_classifier_pipeline()
    return metrics

def retrain_classifier(generate_fresh_data: bool = False) -> Dict[str, Any]:
    """
    Retrains the model pipeline on the 1,000 synthetic records.
    Optionally re-generates fresh synthetic data.
    """
    global _CLASSIFIER_CACHE
    ml_dir, data_dir, _ = get_base_dirs()

    if generate_fresh_data:
        records = generate_1000_records()
        save_dataset(records, data_dir)

    metrics = train_and_evaluate_model()
    _CLASSIFIER_CACHE["pipeline"] = None
    _CLASSIFIER_CACHE["metrics"] = None
    load_classifier_pipeline()
    return metrics
