from fastapi import APIRouter, HTTPException
from services.supabase_client import get_supabase

router = APIRouter()


@router.get("/resumes/{session_id}")
async def get_resumes(session_id: str):
    sb = get_supabase()
    res = sb.table("resumes").select("*").eq("session_id", session_id)\
        .order("overall_score", desc=True).execute()
    return res.data

@router.delete("/resumes/{resume_id}")
async def delete_resume(resume_id: str):
    sb = get_supabase()
    sb.table("resumes").delete().eq("id", resume_id).execute()
    return {"deleted": True}
