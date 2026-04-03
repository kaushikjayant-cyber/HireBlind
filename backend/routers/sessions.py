from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import get_supabase
from auth import require_recruiter, require_admin, get_current_user

router = APIRouter()


class SessionCreate(BaseModel):
    job_title: str
    job_description: str
    created_by: str
    status: str = "active"


@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    """
    Admin sees all sessions.
    Recruiter sees only their own sessions.
    Students are not allowed.
    """
    role = current_user.get("role")
    if role not in ("admin", "recruiter", "company"):
        raise HTTPException(status_code=403, detail="Students cannot view hiring sessions.")

    sb = get_supabase()
    if role == "admin":
        res = sb.table("sessions").select("*").order("created_at", desc=True).execute()
    else:
        res = sb.table("sessions").select("*")\
            .eq("created_by", current_user["id"])\
            .order("created_at", desc=True).execute()
    return res.data


@router.post("/sessions")
async def create_session(
    body: SessionCreate,
    current_user: dict = Depends(require_recruiter)
):
    """Recruiter-only: create a new hiring session (job description)."""
    sb = get_supabase()
    res = sb.table("sessions").insert(body.dict()).execute()
    return res.data[0]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin and recruiters can fetch a specific session."""
    role = current_user.get("role")
    if role not in ("admin", "recruiter", "company"):
        raise HTTPException(status_code=403, detail="Access denied.")
    sb = get_supabase()
    res = sb.table("sessions").select("*").eq("id", session_id).single().execute()
    return res.data
