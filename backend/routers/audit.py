"""
Audit Log router — Admin only.
Aggregates pii_audit_log, override_log, and identity_reveal_log into one view.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
from typing import Optional
from services.supabase_client import get_supabase
from auth import require_admin

router = APIRouter()


@router.get("/audit-log")
async def get_audit_log(
    current_user: dict = Depends(require_admin),
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Admin-only: Fetch combined audit trail.
    Returns PII stripping events, ranking overrides, and identity reveal events.
    """
    sb = get_supabase()

    # PII audit log
    pii_query = sb.table("pii_audit_log").select("*").order("stripped_at", desc=True).limit(limit)
    if session_id:
        pii_query = pii_query.eq("session_id", session_id)
    pii_res = pii_query.execute()

    # Override log
    override_query = sb.table("override_log").select("*").order("overridden_at", desc=True).limit(limit)
    if session_id:
        override_query = override_query.eq("session_id", session_id)
    override_res = override_query.execute()

    # Identity reveal log
    reveal_query = sb.table("identity_reveal_log").select("*").order("revealed_at", desc=True).limit(limit)
    if session_id:
        reveal_query = reveal_query.eq("session_id", session_id)
    reveal_res = reveal_query.execute()

    pii_logs = pii_res.data or []
    override_logs = override_res.data or []
    reveal_logs = reveal_res.data or []

    # Build unified timeline
    events = []
    for e in pii_logs:
        events.append({
            "type": "pii_stripped",
            "timestamp": e.get("stripped_at"),
            "session_id": e.get("session_id"),
            "resume_id": e.get("resume_id"),
            "detail": f"PII field stripped: {e.get('field_stripped')}",
            "actor": e.get("stripped_by", "system"),
        })
    for e in override_logs:
        events.append({
            "type": "ranking_override",
            "timestamp": e.get("overridden_at"),
            "session_id": e.get("session_id"),
            "resume_id": e.get("resume_id"),
            "detail": f"Rank changed #{e.get('original_rank')} → #{e.get('new_rank')}: {e.get('reason')}",
            "actor": e.get("overridden_by"),
        })
    for e in reveal_logs:
        events.append({
            "type": "identity_revealed",
            "timestamp": e.get("revealed_at"),
            "session_id": e.get("session_id"),
            "resume_id": e.get("resume_id"),
            "detail": f"Identity revealed (already_revealed={e.get('already_revealed', False)})",
            "actor": e.get("revealed_by"),
        })

    # Sort by timestamp descending
    events.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "total_events": len(events),
        "pii_events": len(pii_logs),
        "override_events": len(override_logs),
        "reveal_events": len(reveal_logs),
        "events": events[:limit],
    }
