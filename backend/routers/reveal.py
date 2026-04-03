"""
Reveal-Identity router.
Recruiter or Admin — only one who clicks "Reveal Identity" button.
Returns the original filename and full candidate details.
Logs every reveal to identity_reveal_log for audit.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from services.supabase_client import get_supabase
from auth import require_recruiter_or_admin

router = APIRouter()


@router.post("/reveal-identity/{resume_id}")
async def reveal_identity(
    resume_id: str,
    current_user: dict = Depends(require_recruiter_or_admin),
):
    """
    Permanently reveal a candidate's identity.
    - Recruiter or Admin only (403 for all other roles)
    - Returns original_file_name stored at upload time
    - Logs reveal action in `identity_reveal_log` table
    - Marks resume as `identity_revealed = true`
    Anonymity is maintained during evaluation — this is ONLY called after ranking.
    """
    sb = get_supabase()

    # Fetch resume — retrieve PII only at reveal time
    res = sb.table("resumes")\
        .select("id, session_id, original_file_name, identity_revealed, overall_score, uploaded_by")\
        .eq("id", resume_id)\
        .single()\
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Resume not found.")

    resume = res.data
    now = datetime.now(timezone.utc).isoformat()

    already_revealed = resume.get("identity_revealed", False)

    # Always log every reveal attempt (idempotent)
    try:
        sb.table("identity_reveal_log").insert({
            "resume_id": resume_id,
            "session_id": resume.get("session_id"),
            "revealed_by": current_user["id"],
            "revealed_at": now,
            "already_revealed": already_revealed,
        }).execute()
    except Exception:
        pass  # Non-fatal — don't block reveal if log insert fails

    # Mark resume as revealed
    sb.table("resumes").update({
        "identity_revealed": True,
        "identity_revealed_at": now,
        "identity_revealed_by": current_user["id"],
    }).eq("id", resume_id).execute()

    # Extract a presentable candidate name from the filename
    raw_name = resume.get("original_file_name", "Unknown")
    # Strip extension for display: "John_Smith.pdf" → "John Smith"
    display_name = raw_name
    for ext in (".pdf", ".docx", ".doc", ".txt"):
        if display_name.lower().endswith(ext):
            display_name = display_name[: -len(ext)]
    display_name = display_name.replace("_", " ").replace("-", " ").strip()
    if not display_name:
        display_name = raw_name

    return {
        "resume_id": resume_id,
        "session_id": resume.get("session_id"),
        "original_file_name": raw_name,
        "display_name": display_name,
        "overall_score": resume.get("overall_score", 0),
        "revealed_at": now,
        "revealed_by_email": current_user.get("email", ""),
        "revealed_by_role": current_user.get("role", ""),
        "already_revealed": already_revealed,
    }


@router.get("/reveal-identity/status/{resume_id}")
async def reveal_status(
    resume_id: str,
    current_user: dict = Depends(require_recruiter_or_admin),
):
    """Check if a resume's identity has already been revealed."""
    sb = get_supabase()
    res = sb.table("resumes")\
        .select("id, identity_revealed, identity_revealed_at, original_file_name")\
        .eq("id", resume_id)\
        .single()\
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Resume not found.")

    r = res.data
    if r.get("identity_revealed"):
        raw = r.get("original_file_name", "")
        display = raw
        for ext in (".pdf", ".docx", ".doc", ".txt"):
            if display.lower().endswith(ext):
                display = display[: -len(ext)]
        display = display.replace("_", " ").replace("-", " ").strip() or raw
        return {
            "revealed": True,
            "original_file_name": raw,
            "display_name": display,
            "revealed_at": r.get("identity_revealed_at"),
        }
    return {"revealed": False, "original_file_name": None, "display_name": None, "revealed_at": None}
