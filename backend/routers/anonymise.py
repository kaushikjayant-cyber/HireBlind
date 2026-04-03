from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from services.parser import extract_text
from services.pii_stripper import strip_pii
from auth import require_recruiter

router = APIRouter()

# Allowed file extensions and their MIME types
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}
ALLOWED_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "application/octet-stream",  # some browsers send this for .doc
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_extension(filename: str) -> str:
    import os
    return os.path.splitext(filename.lower())[1]


@router.post("/anonymise")
async def anonymise_resume(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    current_user: dict = Depends(require_recruiter)
):
    """
    Parse a resume file (PDF/DOCX/DOC/TXT) and strip all PII.
    Accessible by: Recruiter only.
    Anonymisation MUST happen before any scoring.
    Returns anonymised text + list of PII fields removed.
    """
    fname = file.filename or "resume.pdf"
    ext = _get_extension(fname)

    # Validate extension
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is not supported. Accepted formats: PDF, DOCX, DOC, TXT."
        )

    contents = await file.read()

    # Validate file size
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File '{fname}' exceeds 10MB limit ({len(contents) // 1024 // 1024}MB)."
        )

    # Validate not empty
    if len(contents) < 100:
        raise HTTPException(
            status_code=400,
            detail=f"File '{fname}' appears to be empty or too small."
        )

    # Extract text
    try:
        raw_text = extract_text(contents, fname)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read file '{fname}': {str(e)}")

    if not raw_text.strip():
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract any text from '{fname}'. File may be image-based or corrupted."
        )

    # Anonymise PII
    result = strip_pii(raw_text)

    return {
        "session_id": session_id,
        "filename": fname,
        "original_length": len(raw_text),
        "anonymised_length": len(result["anonymised_text"]),
        "anonymised_text": result["anonymised_text"],
        "pii_found": result["pii_found"],
        "university_mapping_count": result["university_mapping_count"],
        "spacy_used": result["spacy_used"],
    }


@router.post("/anonymise/text")
async def anonymise_text(
    payload: dict,
    current_user: dict = Depends(require_recruiter)
):
    """
    Anonymise plain text (for testing / demo).
    Body: { "text": "..." }
    """
    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided.")
    result = strip_pii(text)
    return result
