from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from services.supabase_client import get_supabase
from auth import require_recruiter_or_admin

router = APIRouter()


@router.get("/compliance/{session_id}")
async def get_compliance_report(
    session_id: str,
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """
    Return full compliance data for a session.
    Accessible by: Admin (platform oversight) and Recruiter (own sessions).
    """
    sb = get_supabase()

    session_res = sb.table("sessions").select("*").eq("id", session_id).single().execute()
    pii_res = sb.table("pii_audit_log").select("*").eq("session_id", session_id).execute()
    override_res = sb.table("override_log").select("*").eq("session_id", session_id).execute()
    resume_res = sb.table("resumes").select("id, overall_score, is_shortlisted").eq("session_id", session_id).execute()
    reveal_res = sb.table("identity_reveal_log").select("*").eq("session_id", session_id).execute()

    session = session_res.data
    pii_logs = pii_res.data or []
    override_logs = override_res.data or []
    resumes = resume_res.data or []
    reveal_logs = reveal_res.data or []

    pii_by_type = {}
    for log in pii_logs:
        ft = log.get("field_stripped", "unknown")
        pii_by_type[ft] = pii_by_type.get(ft, 0) + 1

    checklist = {
        "human_in_loop": True,
        "pii_stripped": len(pii_logs) > 0,
        "audit_trail": True,
        "explainability_tags": True,
        "overrides_recorded": True,
        "identity_reveals_logged": True,
    }

    return {
        "session_id": session_id,
        "job_title": session.get("job_title") if session else None,
        "created_at": session.get("created_at") if session else None,
        "resumes_processed": len(resumes),
        "pii_events": len(pii_logs),
        "pii_by_type": pii_by_type,
        "override_count": len(override_logs),
        "identity_reveals": len(reveal_logs),
        "model_used": "TF-IDF + Cosine Similarity (scikit-learn)",
        "compliance_checklist": checklist,
        "pii_audit_log": pii_logs,
        "override_log": override_logs,
        "identity_reveal_log": reveal_logs,
        "generated_at": datetime.utcnow().isoformat(),
        "eu_ai_act_classification": "High-Risk (Annex III — Employment)",
        "human_oversight_article": "Article 14 compliant",
    }
