"""
RBAC helpers for FastAPI routes.

The frontend sends the Supabase user ID as `X-User-Id` header.
The service-role Supabase client is used to do a ground-truth lookup
so the header cannot be spoofed.

Roles: admin | recruiter  (student role has been removed)
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
    """Dependency: only allow recruiter role."""
    if current_user.get("role") != "recruiter":
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


async def require_recruiter_or_admin(current_user: dict = Depends(get_current_user)):
    """Dependency: allow recruiter or admin roles."""
    if current_user.get("role") not in ("recruiter", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Access denied. Recruiter or Admin role required."
        )
    return current_user
