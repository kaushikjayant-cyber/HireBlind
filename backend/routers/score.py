from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.scorer import score_resume
from auth import require_recruiter_or_admin

router = APIRouter()


class ScoreRequest(BaseModel):
    session_id: str
    resume_id: str
    anonymised_text: str
    job_description: str = ""   # Optional — graceful if empty
    rank: Optional[int] = 1


@router.post("/score")
async def score_resume_endpoint(
    req: ScoreRequest,
    current_user: dict = Depends(require_recruiter_or_admin)
):
    """
    Score an anonymised resume against a job description.
    Accessible by: Recruiter or Admin.
    Anonymisation MUST happen before this endpoint is called.
    Returns overall_score (0–100) and score_breakdown with full explainability.

    If job_description is empty, scoring still runs but relevance score will be low.
    """
    if not req.anonymised_text.strip():
        raise HTTPException(status_code=400, detail="No resume text provided.")

    # Graceful: allow empty JD (scores will be low, not 400 error)
    jd = req.job_description.strip() or "general professional position"

    result = score_resume(
        resume_text=req.anonymised_text,
        jd_text=jd,
        rank=req.rank,
    )

    breakdown = result["score_breakdown"]

    return {
        "session_id": req.session_id,
        "resume_id": req.resume_id,
        "overall_score": result["overall_score"],
        "score_breakdown": {
            "skills":      breakdown.get("skills", 0),
            "experience":  breakdown.get("experience", 0),
            "relevance":   breakdown.get("relevance", 0),
            "tags":        breakdown.get("tags", []),
            "explanation": breakdown.get("explanation", ""),
            "details":     breakdown.get("details", {}),
        },
        "confidence": min(99, round(result["overall_score"] * 0.95 + 5)),
        "jd_provided": bool(req.job_description.strip()),
    }
