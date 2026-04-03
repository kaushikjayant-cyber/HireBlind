from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import get_supabase

router = APIRouter()


class SessionCreate(BaseModel):
    job_title: str
    job_description: str
    created_by: str
    status: str = "active"

@router.get("/sessions")
async def list_sessions():
    sb = get_supabase()
    res = sb.table("sessions").select("*").order("created_at", desc=True).execute()
    return res.data

@router.post("/sessions")
async def create_session(body: SessionCreate):
    sb = get_supabase()
    res = sb.table("sessions").insert(body.dict()).execute()
    return res.data[0]

@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    sb = get_supabase()
    res = sb.table("sessions").select("*").eq("id", session_id).single().execute()
    return res.data
