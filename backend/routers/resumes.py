from fastapi import APIRouter, HTTPException, Depends
from services.supabase_client import get_supabase
from auth import require_recruiter, get_current_user

router = APIRouter()


@router.get("/resumes/{session_id}")
async def get_resumes(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin and recruiters can list resumes in a session. Students blocked."""
    role = current_user.get("role")
    if role not in ("admin", "recruiter", "company"):
        raise HTTPException(status_code=403, detail="Students cannot access candidate lists.")
    sb = get_supabase()
    res = sb.table("resumes").select("*").eq("session_id", session_id)\
        .order("overall_score", desc=True).execute()
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
