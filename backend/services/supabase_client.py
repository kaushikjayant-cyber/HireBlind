import os
from fastapi import HTTPException
from supabase import create_client, Client


def get_supabase() -> Client:
    """Return a Supabase client using env-configured credentials.
    
    Raises HTTPException 500 if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
    are not set so callers get a clear error instead of a cryptic crash.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(
            status_code=500,
            detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
        )
    return create_client(url, key)
