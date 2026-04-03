from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from services.parser import extract_text
from services.pii_stripper import strip_pii
from auth import require_recruiter_or_student

router = APIRouter()

@router.post("/anonymise")
async def anonymise_resume(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    current_user: dict = Depends(require_recruiter_or_student)
):
    """
    Parse a resume file (PDF/DOCX) and strip all PII.
    Accessible by: Recruiter (for bulk hiring flow), Student (for personal analysis).
    Returns anonymised text + list of PII fields removed.
    """
    fname = file.filename or "resume"
    if not (fname.lower().endswith(".pdf") or fname.lower().endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are accepted.")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 5MB limit.")

    try:
        raw_text = extract_text(contents, fname)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract any text from the file.")

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
    current_user: dict = Depends(require_recruiter_or_student)
):
    """
    Anonymise plain text (for testing / demo).
    Accessible by: Recruiter and Student.
    Body: { "text": "..." }
    """
    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided.")
    result = strip_pii(text)
    return result
