"""
Anonymise router — strips PII from uploaded resumes.
Accessible by: Recruiter or Admin.
Saves anonymised_content to the resumes table for re-scoring.
Logs PII strip events to pii_audit_log for Admin audit trail.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from services.parser import extract_text
from services.pii_stripper import strip_pii
from services.supabase_client import get_supabase
from auth import require_recruiter_or_admin
from datetime import datetime, timezone
import os

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}
ALLOWED_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "application/octet-stream",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_extension(filename: str) -> str:
    return os.path.splitext(filename.lower())[1]


@router.post("/anonymise")
async def anonymise_resume(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """
    Parse a resume file (PDF/DOCX/DOC/TXT), strip all PII, and save
    anonymised_content to the resumes table for re-scoring later.
    Accessible by: Recruiter or Admin.
    """
    fname = file.filename or "resume.pdf"
    ext = _get_extension(fname)

    # Validate extension
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not supported. Accepted: PDF, DOCX, DOC, TXT."
        )

    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read upload: {str(e)}")

    # Validate file size
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"'{fname}' exceeds 10 MB limit."
        )

    if len(contents) < 50:
        raise HTTPException(
            status_code=400,
            detail=f"'{fname}' appears to be empty or too small."
        )

    # ── 1. Extract text ──────────────────────────────────────────────────────
    try:
        raw_text = extract_text(contents, fname)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse '{fname}': {str(e)}. Try re-saving as PDF or DOCX."
        )

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                f"No text extracted from '{fname}'. "
                "The file may be image-based (scanned PDF). "
                "Please use a text-based PDF or DOCX."
            )
        )

    # ── 2. Strip PII ─────────────────────────────────────────────────────────
    try:
        result = strip_pii(raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PII stripping failed: {str(e)}")

    anonymised_text = result.get("anonymised_text", "")
    pii_found = result.get("pii_found", [])

    # ── 3. Save anonymised_content to resumes table ──────────────────────────
    # This is critical — re-scoring reads from this column.
    # The actual resume DB record is typically created by the frontend before
    # calling /anonymise. We upsert here to ensure anonymised_content is saved.
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    try:
        # Update existing record if it exists (frontend creates it first)
        update_res = sb.table("resumes") \
            .update({
                "anonymised_content": anonymised_text,
                "processing_status": "anonymised",
                "file_type": ext.lstrip("."),
            }) \
            .eq("session_id", session_id) \
            .eq("original_file_name", fname) \
            .execute()

        resume_id = None
        if update_res.data:
            resume_id = update_res.data[0].get("id")
    except Exception:
        # Non-fatal — don't block anonymisation if DB update fails
        resume_id = None

    # ── 4. Log PII audit event ────────────────────────────────────────────────
    if pii_found:
        try:
            sb.table("pii_audit_log").insert({
                "session_id": session_id,
                "resume_id": resume_id,
                "filename": fname,
                "pii_fields_removed": pii_found,
                "stripped_by": current_user.get("id"),
                "stripped_at": now,
            }).execute()
        except Exception:
            pass  # Non-fatal — pii_audit_log table may not exist yet

    return {
        "session_id": session_id,
        "filename": fname,
        "resume_id": resume_id,
        "original_length": len(raw_text),
        "anonymised_length": len(anonymised_text),
        "anonymised_text": anonymised_text,
        "pii_found": pii_found,
        "university_mapping_count": result.get("university_mapping_count", 0),
        "spacy_used": result.get("spacy_used", False),
    }


@router.post("/anonymise/text")
async def anonymise_text(
    payload: dict,
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """Anonymise plain text (for testing/demo). Body: { 'text': '...' }"""
    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided.")
    result = strip_pii(text)
    return result
