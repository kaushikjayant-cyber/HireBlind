from fastapi import APIRouter, HTTPException, Depends
from services.supabase_client import get_supabase
from auth import require_recruiter, require_recruiter_or_admin

router = APIRouter()


@router.get("/resumes/{session_id}")
async def get_resumes(
    session_id: str,
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """
    Admin and Recruiters can list resumes in a session.
    IMPORTANT: This returns ONLY anonymised fields — never original_file_name.
    original_file_name is returned ONLY after explicit reveal via /reveal-identity/{id}.
    """
    sb = get_supabase()
    res = sb.table("resumes")\
        .select("id, session_id, overall_score, score_breakdown, is_shortlisted, manually_adjusted, identity_revealed, identity_revealed_at, processing_status, uploaded_at")\
        .eq("session_id", session_id)\
        .order("overall_score", desc=True)\
        .execute()
    return res.data


@router.delete("/resumes/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user: dict = Depends(require_recruiter)
):
    """Recruiter-only: delete a specific resume."""
    sb = get_supabase()
    sb.table("resumes").delete().eq("id", resume_id).execute()
    return {"deleted": True}


@router.patch("/resumes/{resume_id}/shortlist")
async def toggle_shortlist(
    resume_id: str,
    body: dict,
    current_user: dict = Depends(require_recruiter)
):
    """Recruiter-only: toggle shortlisted status on a resume."""
    sb = get_supabase()
    is_shortlisted = body.get("is_shortlisted", False)
    res = sb.table("resumes").update({"is_shortlisted": is_shortlisted}).eq("id", resume_id).execute()
    return res.data[0] if res.data else {}
