"""
HireBlind AI Service — FastAPI microservice.
Exposes /, /health, /parse, /anonymise, /score, /analyze endpoints.
Called internally by the Node.js Express backend.

Deploy on Render with:
  uvicorn app:app --host 0.0.0.0 --port 10000
"""
import sys
import os
import logging
import tempfile

# ── Path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("ai_service")

# ── FastAPI imports ───────────────────────────────────────────────────────────
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

# ── Service imports ───────────────────────────────────────────────────────────
from services.parser import extract_text
from services.pii_stripper import strip_pii
from services.scorer import score_resume

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HireBlind AI Service",
    version="2.0.0",
    description="Resume parsing, PII stripping, and scoring microservice.",
)

# CORS: configurable via AI_CORS_ORIGINS env var
_cors_origins = os.getenv(
    "AI_CORS_ORIGINS",
    "http://localhost:8000,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request models ────────────────────────────────────────────────────────────

class AnonymiseRequest(BaseModel):
    text: str

class ScoreRequest(BaseModel):
    anonymised_text: str
    job_description: Optional[str] = "general professional position"
    rank: Optional[int] = 1


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _read_upload(file: UploadFile) -> tuple[bytes, str]:
    """Read an uploaded file and return (bytes, filename)."""
    file_bytes = await file.read()
    fname = (file.filename or "resume.pdf").strip()
    if len(file_bytes) < 50:
        raise HTTPException(status_code=400, detail=f"'{fname}' appears empty or too small.")
    return file_bytes, fname


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "message": "AI service running",
        "status": "ok",
        "service": "HireBlind AI Service",
        "version": "2.0.0",
        "python": sys.version.split()[0],
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


# ── Parse ─────────────────────────────────────────────────────────────────────

@app.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Receive a resume file (multipart/form-data), return extracted raw text."""
    file_bytes, fname = await _read_upload(file)
    logger.info(f"[/parse] Processing '{fname}' ({len(file_bytes)} bytes)")

    try:
        raw_text = extract_text(file_bytes, fname)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception(f"[/parse] Error for '{fname}'")
        raise HTTPException(status_code=422, detail=f"Could not parse '{fname}': {e}")

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                f"No text extracted from '{fname}'. "
                "The file may be a scanned image PDF. Please use a text-based PDF or DOCX."
            ),
        )

    logger.info(f"[/parse] Extracted {len(raw_text)} chars from '{fname}'")
    return {"raw_text": raw_text, "filename": fname}


# ── Anonymise ─────────────────────────────────────────────────────────────────

@app.post("/anonymise")
async def anonymise_text_json(body: AnonymiseRequest):
    """JSON { text: str } → anonymised text."""
    text = body.text
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="No text provided.")

    logger.info(f"[/anonymise] Stripping PII from {len(text)} chars")
    try:
        result = strip_pii(text)
    except Exception as e:
        logger.exception("[/anonymise] PII stripping failed")
        raise HTTPException(status_code=500, detail=f"PII stripping failed: {e}")

    logger.info(f"[/anonymise] Done — {len(result.get('pii_found', []))} PII items removed")
    return result


@app.post("/anonymise/file")
async def anonymise_file(file: UploadFile = File(...)):
    """Multipart file upload → anonymised text."""
    file_bytes, fname = await _read_upload(file)

    try:
        text = extract_text(file_bytes, fname)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("[/anonymise/file] Parse step failed")
        raise HTTPException(status_code=422, detail=str(e))

    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the file.")

    logger.info(f"[/anonymise/file] Stripping PII from {len(text)} chars")
    try:
        result = strip_pii(text)
    except Exception as e:
        logger.exception("[/anonymise/file] PII stripping failed")
        raise HTTPException(status_code=500, detail=f"PII stripping failed: {e}")

    return result


# ── Score ─────────────────────────────────────────────────────────────────────

@app.post("/score")
def score_endpoint(body: ScoreRequest):
    """JSON: { anonymised_text, job_description, rank? } → scored result."""
    resume_text = body.anonymised_text.strip()
    jd_text = (body.job_description or "general professional position").strip() or "general professional position"
    rank = max(1, body.rank or 1)

    if not resume_text:
        raise HTTPException(status_code=400, detail="No resume text provided.")

    logger.info(f"[/score] Scoring resume (rank={rank})")
    try:
        result = score_resume(resume_text=resume_text, jd_text=jd_text, rank=rank)
    except Exception as e:
        logger.exception("[/score] Scoring failed")
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}")

    logger.info(f"[/score] overall_score={result.get('overall_score')}")
    return result


# ── Analyze (combined parse + anonymise + score) ───────────────────────────────

@app.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: Optional[str] = "general professional position",
    rank: Optional[int] = 1,
):
    """
    All-in-one endpoint:
    - Accept PDF/DOCX resume upload
    - Extract text, strip PII, score against job description
    - Return structured JSON result
    """
    file_bytes, fname = await _read_upload(file)
    logger.info(f"[/analyze] Processing '{fname}' ({len(file_bytes)} bytes)")

    # 1. Parse
    try:
        raw_text = extract_text(file_bytes, fname)
    except Exception as e:
        logger.exception(f"[/analyze] Parse failed for '{fname}'")
        raise HTTPException(status_code=422, detail=f"Could not parse '{fname}': {e}")

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=422,
            detail=f"No text extracted from '{fname}'. Use a text-based PDF or DOCX.",
        )

    # 2. Anonymise
    try:
        pii_result = strip_pii(raw_text)
        anonymised_text = pii_result.get("anonymised_text", raw_text)
    except Exception as e:
        logger.warning(f"[/analyze] PII stripping failed, using raw text: {e}")
        pii_result = {}
        anonymised_text = raw_text

    # 3. Score
    jd = (job_description or "general professional position").strip() or "general professional position"
    rank = max(1, rank or 1)
    try:
        score_result = score_resume(resume_text=anonymised_text, jd_text=jd, rank=rank)
    except Exception as e:
        logger.exception("[/analyze] Scoring failed")
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}")

    logger.info(f"[/analyze] Done — overall_score={score_result.get('overall_score')}")

    return {
        "filename": fname,
        "raw_text": raw_text,
        "anonymised_text": anonymised_text,
        "pii_found": pii_result.get("pii_found", []),
        "score": score_result,
    }
