"""
Training and Evaluation Pipeline for CivicTrust Department Classifier.
Uses a held-out topic-group split to evaluate generalization to unseen
synthetic complaint scenarios, then serializes the trained pipeline.
"""

import os
import json
import numpy as np
import joblib
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    classification_report, confusion_matrix
)
try:
    from app.ml.dataset_generator import generate_1000_records, save_dataset
except ImportError:
    from dataset_generator import generate_1000_records, save_dataset

DEPT_NAMES = {
    "PWD": "Public Works Department",
    "WATER": "Water Supply & Sewerage Board",
    "ELEC": "State Electricity Distribution",
    "MC": "Municipal Corporation",
    "TRANS": "Metropolitan Transport Authority",
    "HEALTH": "Public Health Services",
    "EDU": "Directorate of School Education"
}

def train_and_evaluate_model():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    model_dir = os.path.join(base_dir, "model")
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(model_dir, exist_ok=True)

    json_path = os.path.join(data_dir, "synthetic_complaints_1000.json")

    # 1. Load or Generate 1,000 Synthetic Complaints
    regenerate_dataset = not os.path.exists(json_path)
    if not regenerate_dataset:
        with open(json_path, "r", encoding="utf-8") as f:
            records = json.load(f)
        # Refresh old datasets so they include scenario groups and overlap.
        regenerate_dataset = not records or any("scenario_group" not in r for r in records)

    if regenerate_dataset:
        print("[Trainer] Generating 1,000 synthetic grievance records...")
        records = generate_1000_records()
        save_dataset(records, data_dir)

    print(f"[Trainer] Loaded {len(records)} records.", flush=True)

    # 2. Extract Features and Labels
    # Combine title and description for rich semantic representation
    texts = [f"{r['title']} {r['description']}" for r in records]
    labels = [r["department_code"] for r in records]

    # 3. Split by topic group so near-identical scenarios cannot appear in
    #    both train and test. This gives a more honest unseen-topic evaluation.
    groups = [r["scenario_group"] for r in records]
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    train_idx, test_idx = next(splitter.split(texts, labels, groups))
    X_train = [texts[i] for i in train_idx]
    X_test = [texts[i] for i in test_idx]
    y_train = [labels[i] for i in train_idx]
    y_test = [labels[i] for i in test_idx]

    print(f"[Trainer] Train set size: {len(X_train)} samples", flush=True)
    print(f"[Trainer] Test set size:  {len(X_test)} samples", flush=True)

    # 4. Pipeline: TF-IDF Vectorizer + Calibrated Logistic Regression
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=5000,
            sublinear_tf=True,
            stop_words="english",
            token_pattern=r"(?u)\b\w+\b"
        )),
        ("classifier", LogisticRegression(
            C=3.0,
            max_iter=1000,
            solver="lbfgs",
            random_state=42
        ))
    ])

    print("[Trainer] Training model pipeline...", flush=True)
    pipeline.fit(X_train, y_train)

    # 5. Evaluate on the held-out topic-group samples
    print(f"[Trainer] Evaluating model on {len(X_test)} hold-out test samples...", flush=True)
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    classes = list(pipeline.classes_)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred, labels=classes, zero_division=0
    )

    cm = confusion_matrix(y_test, y_pred, labels=classes).tolist()
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

    # Calculate Top Indicative Keywords per Department
    tfidf = pipeline.named_steps["tfidf"]
    clf = pipeline.named_steps["classifier"]
    feature_names = np.array(tfidf.get_feature_names_out())

    top_keywords_per_dept = {}
    for idx, dept_code in enumerate(clf.classes_):
        top_indices = np.argsort(clf.coef_[idx])[-8:][::-1]
        top_keywords_per_dept[dept_code] = {
            "department_name": DEPT_NAMES.get(dept_code, dept_code),
            "top_features": feature_names[top_indices].tolist()
        }

    per_dept_metrics = {}
    for idx, c in enumerate(classes):
        per_dept_metrics[c] = {
            "department_name": DEPT_NAMES.get(c, c),
            "precision": round(float(precision[idx]), 4),
            "recall": round(float(recall[idx]), 4),
            "f1_score": round(float(f1[idx]), 4),
            "test_samples": int(support[idx])
        }

    metrics_summary = {
        "dataset_total_records": len(records),
        "train_samples_count": len(X_train),
        "test_samples_count": len(X_test),
        "test_accuracy": round(acc, 4),
        "test_accuracy_pct": f"{round(acc * 100, 2)}%",
        "macro_avg_f1": round(float(report["macro avg"]["f1-score"]), 4),
        "weighted_avg_f1": round(float(report["weighted avg"]["f1-score"]), 4),
        "departments_evaluated": classes,
        "per_department_metrics": per_dept_metrics,
        "confusion_matrix": {
            "classes": classes,
            "matrix": cm
        },
        "top_keywords_per_department": top_keywords_per_dept
    }

    print("=" * 60)
    print(f"MODEL PERFORMANCE SUMMARY (Trained on {len(X_train)}, Tested on {len(X_test)})")
    print(f"Overall Accuracy: {metrics_summary['test_accuracy_pct']}")
    print(f"Macro F1 Score:   {metrics_summary['macro_avg_f1']}")
    print(f"Weighted F1:      {metrics_summary['weighted_avg_f1']}")
    print("=" * 60)
    for code, m in per_dept_metrics.items():
        print(f"  [{code:5}] {m['department_name'][:30]:30} | Prec: {m['precision']:.3f} | Rec: {m['recall']:.3f} | F1: {m['f1_score']:.3f} ({m['test_samples']} tests)")
    print("=" * 60)

    # 6. Save Model Artifacts
    model_path = os.path.join(model_dir, "department_classifier.joblib")
    metrics_path = os.path.join(model_dir, "eval_metrics.json")

    joblib.dump(pipeline, model_path)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    print(f"[Trainer] Saved Model Pipeline: {model_path}")
    print(f"[Trainer] Saved Metrics Report: {metrics_path}")

    return metrics_summary

if __name__ == "__main__":
    train_and_evaluate_model()
