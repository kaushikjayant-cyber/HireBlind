"""
RBAC helpers for FastAPI routes.

The frontend sends the Supabase user ID as `X-User-Id` header and the
role as `X-User-Role` header (set by the React app after it reads the
user profile from Supabase).  The service-role Supabase client is then
used to do a ground-truth lookup so the headers cannot be spoofed.
"""

import os
from fastapi import Header, HTTPException, Depends
from services.supabase_client import get_supabase


async def get_current_user(x_user_id: str = Header(None)):
    """
    Resolve the caller from the X-User-Id header.
    Returns the user row from the `users` table.
    Raises 401 if the header is missing or user not found.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header.")
    sb = get_supabase()
    result = sb.table("users").select("id, role, email").eq("id", x_user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="User not found.")
    return result.data


async def require_recruiter(current_user: dict = Depends(get_current_user)):
    """Dependency: only allow recruiter or company role."""
    if current_user.get("role") not in ("recruiter", "company"):
        raise HTTPException(
            status_code=403,
            detail="Access denied. This action requires a Recruiter account."
        )
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency: only allow admin role."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Access denied. This action requires an Admin account."
        )
    return current_user


async def require_recruiter_or_student(current_user: dict = Depends(get_current_user)):
    """Dependency: allow recruiter, company, or student roles."""
    if current_user.get("role") not in ("recruiter", "company", "student"):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )
    return current_user
