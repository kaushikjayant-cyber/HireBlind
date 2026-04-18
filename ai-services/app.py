"""
HireBlind AI Service — Flask microservice on port 8001.
Exposes /parse, /anonymise, /score endpoints.
Called internally by the Node.js Express backend (port 8000).

Self-healing: on startup, automatically installs any missing packages
using sys.executable (the EXACT Python running this process).
"""
import sys
import os
import subprocess
import logging

# ── Self-install missing packages ─────────────────────────────────────────────
# Uses sys.executable so packages ALWAYS go into the right Python environment.
REQUIRED_PACKAGES = {
    "pdfplumber":         "pdfplumber",
    "fitz":               "PyMuPDF",
    "pdfminer":           "pdfminer.six",
    "docx":               "python-docx",
    "sklearn":            "scikit-learn",
    "numpy":              "numpy",
    "flask":              "flask",
    "flask_cors":         "flask-cors",
}

_missing = []
for _import_name, _pkg in REQUIRED_PACKAGES.items():
    try:
        __import__(_import_name)
    except ImportError:
        _missing.append(_pkg)

if _missing:
    print(f"[AI Service] Auto-installing missing packages: {_missing}")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--quiet"] + _missing,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    print("[AI Service] Auto-install complete.")

# ── Path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("ai_service")

# ── Flask imports ─────────────────────────────────────────────────────────────
from flask import Flask, request, jsonify
from flask_cors import CORS
from services.parser import extract_text
from services.pii_stripper import strip_pii
from services.scorer import score_resume

app = Flask(__name__)

# 12 MB max upload
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024

# CORS: configurable via AI_CORS_ORIGINS env var
_cors_origins = os.getenv(
    "AI_CORS_ORIGINS",
    "http://localhost:8000,http://localhost:5173"
).split(",")
CORS(app, origins=[o.strip() for o in _cors_origins])


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return jsonify({
        "status": "ok",
        "service": "HireBlind AI Service",
        "version": "1.0.0",
        "python": sys.version.split()[0],
        "executable": sys.executable,
    })


@app.get("/health")
def health():
    return jsonify({"status": "healthy"})


@app.errorhandler(413)
def request_too_large(_e):
    return jsonify({"error": "File exceeds the 12 MB size limit."}), 413


# ── Parse ─────────────────────────────────────────────────────────────────────

@app.post("/parse")
def parse_resume():
    """Receive a resume file (multipart/form-data), return extracted raw text."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400

    upload = request.files["file"]
    fname = (request.form.get("filename") or upload.filename or "resume.pdf").strip()

    try:
        file_bytes = upload.read()
    except Exception as e:
        logger.error(f"[/parse] Failed to read file: {e}")
        return jsonify({"error": f"Failed to read file: {e}"}), 500

    if len(file_bytes) < 50:
        return jsonify({"error": f"'{fname}' appears empty or too small."}), 400

    logger.info(f"[/parse] Processing '{fname}' ({len(file_bytes)} bytes)")

    try:
        raw_text = extract_text(file_bytes, fname)
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        logger.exception(f"[/parse] Error for '{fname}'")
        return jsonify({"error": f"Could not parse '{fname}': {e}"}), 422

    if not raw_text or not raw_text.strip():
        return jsonify({
            "error": (
                f"No text extracted from '{fname}'. "
                "The file may be a scanned image PDF. Please use a text-based PDF or DOCX."
            )
        }), 422

    logger.info(f"[/parse] Extracted {len(raw_text)} chars from '{fname}'")
    return jsonify({"raw_text": raw_text, "filename": fname})


# ── Anonymise ─────────────────────────────────────────────────────────────────

@app.post("/anonymise")
def anonymise_text():
    """JSON { text: str } or multipart file upload → anonymised text."""
    if request.is_json:
        data = request.get_json(force=True) or {}
        text = data.get("text", "")
    else:
        if "file" not in request.files:
            return jsonify({"error": "No file or text provided."}), 400
        upload = request.files["file"]
        fname = (request.form.get("filename") or upload.filename or "resume.pdf").strip()
        try:
            text = extract_text(upload.read(), fname)
        except ValueError as e:
            return jsonify({"error": str(e)}), 422
        except Exception as e:
            logger.exception("[/anonymise] Parse step failed")
            return jsonify({"error": str(e)}), 422

    if not text or not text.strip():
        return jsonify({"error": "No text provided."}), 400

    logger.info(f"[/anonymise] Stripping PII from {len(text)} chars")
    try:
        result = strip_pii(text)
    except Exception as e:
        logger.exception("[/anonymise] PII stripping failed")
        return jsonify({"error": f"PII stripping failed: {e}"}), 500

    logger.info(f"[/anonymise] Done — {len(result.get('pii_found', []))} PII items removed")
    return jsonify(result)


# ── Score ─────────────────────────────────────────────────────────────────────

@app.post("/score")
def score_endpoint():
    """JSON: { anonymised_text, job_description, rank? } → scored result."""
    data = request.get_json(force=True) or {}
    resume_text = (data.get("anonymised_text") or "").strip()
    jd_text = (data.get("job_description") or "general professional position").strip() \
              or "general professional position"
    rank = max(1, int(data.get("rank", 1)))

    if not resume_text:
        return jsonify({"error": "No resume text provided."}), 400

    logger.info(f"[/score] Scoring resume (rank={rank})")
    try:
        result = score_resume(resume_text=resume_text, jd_text=jd_text, rank=rank)
    except Exception as e:
        logger.exception("[/score] Scoring failed")
        return jsonify({"error": f"Scoring failed: {e}"}), 500

    logger.info(f"[/score] overall_score={result.get('overall_score')}")
    return jsonify(result)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("AI_SERVICE_PORT", 8001))
    logger.info(f"[AI Service] Python: {sys.executable}")
    logger.info(f"[AI Service] Listening on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
