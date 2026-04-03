from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import get_supabase
from auth import require_recruiter, require_admin, get_current_user, require_recruiter_or_admin

router = APIRouter()


class SessionCreate(BaseModel):
    job_title: str
    job_description: str
    created_by: str
    status: str = "active"


@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(require_recruiter_or_admin)):
    """
    Admin sees all sessions.
    Recruiter sees only their own sessions.
    """
    role = current_user.get("role")
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
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """Recruiter and Admin: create a new hiring session (job description)."""
    sb = get_supabase()
    res = sb.table("sessions").insert(body.dict()).execute()
    return res.data[0]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """Admin and recruiters can fetch a specific session."""
    sb = get_supabase()
    res = sb.table("sessions").select("*").eq("id", session_id).single().execute()
    return res.data


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: str,
    body: dict,
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """Update a session (e.g. close it). Admin can update any; recruiter can update own."""
    sb = get_supabase()
    # Recruiters can only update their own sessions
    if current_user.get("role") == "recruiter":
        check = sb.table("sessions").select("created_by").eq("id", session_id).single().execute()
        if not check.data or check.data.get("created_by") != current_user["id"]:
            raise HTTPException(status_code=403, detail="You can only update your own sessions.")
    res = sb.table("sessions").update(body).eq("id", session_id).execute()
    return res.data[0] if res.data else {}
