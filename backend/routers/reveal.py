"""
Reveal-Identity router.
Recruiter-only endpoint.  Returns the original filename (which contains
the candidate's real name) and logs the reveal action to the audit table.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from services.supabase_client import get_supabase
from auth import require_recruiter

router = APIRouter()


@router.post("/reveal-identity/{resume_id}")
async def reveal_identity(
    resume_id: str,
    current_user: dict = Depends(require_recruiter),
):
    """
    Permanently reveal a candidate's identity.
    - Recruiter-only (403 for all other roles)
    - Returns original_file_name stored at upload time
    - Logs reveal action in `identity_reveal_log` table
    - Marks resume as `identity_revealed = true`
    Anonymity is maintained during evaluation; this is ONLY called after ranking.
    """
    sb = get_supabase()

    # Fetch resume — only safe non-PII fields + the reveal gate field
    res = sb.table("resumes")\
        .select("id, session_id, original_file_name, identity_revealed, overall_score")\
        .eq("id", resume_id)\
        .single()\
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Resume not found.")

    resume = res.data

    now = datetime.utcnow().isoformat()

    # Log the reveal regardless of whether already revealed (idempotent log)
    sb.table("identity_reveal_log").insert({
        "resume_id": resume_id,
        "session_id": resume.get("session_id"),
        "revealed_by": current_user["id"],
        "revealed_at": now,
        "already_revealed": resume.get("identity_revealed", False),
    }).execute()

    # Mark reveal on resume record
    sb.table("resumes").update({
        "identity_revealed": True,
        "identity_revealed_at": now,
        "identity_revealed_by": current_user["id"],
    }).eq("id", resume_id).execute()

    return {
        "resume_id": resume_id,
        "session_id": resume.get("session_id"),
        "original_file_name": resume.get("original_file_name", "Unknown"),
        "revealed_at": now,
        "revealed_by": current_user["email"],
    }


@router.get("/reveal-identity/status/{resume_id}")
async def reveal_status(
    resume_id: str,
    current_user: dict = Depends(require_recruiter),
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
        return {
            "revealed": True,
            "original_file_name": r.get("original_file_name"),
            "revealed_at": r.get("identity_revealed_at"),
        }
    return {"revealed": False, "original_file_name": None, "revealed_at": None}
