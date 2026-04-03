from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.scorer import score_resume
from auth import require_recruiter_or_student

router = APIRouter()

class ScoreRequest(BaseModel):
    session_id: str
    resume_id: str
    anonymised_text: str
    job_description: str
    rank: Optional[int] = 1

@router.post("/score")
async def score_resume_endpoint(
    req: ScoreRequest,
    current_user: dict = Depends(require_recruiter_or_student)
):
    """
    Score an anonymised resume against a job description.
    Accessible by: Recruiter (for ranking candidates), Student (for personal score).
    Admins are blocked — they do not participate in the hiring workflow.
    Returns overall_score (0–100) and score_breakdown with explainability tags.
    """
    if not req.anonymised_text.strip():
        raise HTTPException(status_code=400, detail="No resume text provided.")
    if not req.job_description.strip():
        raise HTTPException(status_code=400, detail="No job description provided.")

    result = score_resume(
        resume_text=req.anonymised_text,
        jd_text=req.job_description,
        rank=req.rank,
    )

    return {
        "session_id": req.session_id,
        "resume_id": req.resume_id,
        "overall_score": result["overall_score"],
        "score_breakdown": result["score_breakdown"],
        "confidence": min(99, round(result["overall_score"] * 0.95 + 5)),
    }
