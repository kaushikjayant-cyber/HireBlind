"""
scorer.py — Resume scoring service.
Uses TF-IDF + Cosine Similarity (scikit-learn) to score an anonymised
resume against a job description, plus keyword-based skills/experience extraction.

Fixes applied:
  - Removed unused `math` import
  - Added explicit import error messages for scikit-learn
  - Improved experience pattern to catch more resume formats
  - Added logging for debug traceability
"""
import re
import logging

logger = logging.getLogger(__name__)

# ── Skill keyword set ─────────────────────────────────────────────────────────
SKILL_KEYWORDS = {
    "python", "java", "javascript", "typescript", "react", "node", "nodejs",
    "express", "django", "fastapi", "flask", "sql", "nosql", "mongodb",
    "postgresql", "mysql", "redis", "docker", "kubernetes", "aws", "azure",
    "gcp", "git", "ci/cd", "rest", "graphql", "machine learning", "deep learning",
    "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn", "nlp",
    "html", "css", "tailwind", "c++", "c#", "go", "rust", "linux", "bash",
    "spring", "hibernate", "angular", "vue", "svelte", "next.js", "nestjs",
    "terraform", "ansible", "jenkins", "github actions", "kafka", "rabbitmq",
}

# ── Experience detection patterns ─────────────────────────────────────────────
EXPERIENCE_PATTERNS = [
    r"(\d+)\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?experience",
    r"(\d+)\+?\s*yrs?\s+(?:of\s+)?(?:professional\s+)?experience",
    r"experience\s+of\s+(\d+)\+?\s*years?",
    r"(\d+)\+?\s*years?\s+in\s+(?:the\s+)?(?:industry|field|domain|software|tech)",
    # Pattern: "2019 - 2024" → 5 years (approximate)
    # Handled separately below
]


def _extract_years_experience(text: str) -> float:
    """Return the highest experience claim found in the resume text."""
    best = 0.0
    for pattern in EXPERIENCE_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            try:
                val = float(match.group(1))
                best = max(best, val)
            except (ValueError, IndexError):
                continue

    # Fallback: count year ranges like "2019 – 2024" to approximate tenure
    if best == 0.0:
        years_found = re.findall(r"\b(20\d{2}|19\d{2})\b", text)
        if len(years_found) >= 2:
            years_int = sorted(set(int(y) for y in years_found))
            span = years_int[-1] - years_int[0]
            if 0 < span <= 40:
                best = float(span)

    return best


def _extract_skills(text: str) -> list:
    """Return all skill keywords found in the text (case-insensitive)."""
    text_lower = text.lower()
    return [skill for skill in SKILL_KEYWORDS if skill in text_lower]


def _cosine_similarity(text_a: str, text_b: str) -> float:
    """
    TF-IDF cosine similarity between two texts.
    Falls back to Jaccard similarity on word sets if scikit-learn is unavailable.
    """
    if not text_a.strip() or not text_b.strip():
        return 0.0

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity as sk_cos

        vec = TfidfVectorizer(stop_words="english", max_features=500, min_df=1)
        tfidf = vec.fit_transform([text_a, text_b])
        score = sk_cos(tfidf[0:1], tfidf[1:2])[0][0]
        return float(score)

    except ImportError:
        logger.warning("[scorer] scikit-learn not installed — falling back to Jaccard similarity")
    except Exception as e:
        logger.warning(f"[scorer] TF-IDF failed ({e}) — falling back to Jaccard similarity")

    # Jaccard fallback
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    union = words_a | words_b
    if not union:
        return 0.0
    return len(words_a & words_b) / len(union)


def score_resume(resume_text: str, jd_text: str, rank: int = 1) -> dict:
    """
    Score a (pre-anonymised) resume against a job description.

    Args:
        resume_text: Anonymised resume text.
        jd_text:     Job description text.
        rank:        Position in the batch (1-indexed).

    Returns:
        {
          "overall_score": float (0–100),
          "score_breakdown": {
              "skills":      float (0–100),
              "experience":  float (0–100),
              "relevance":   float (0–100),
              "tags":        list[str],
              "explanation": str,
              "details":     dict,
          }
        }
    """
    # ── 1. Skill match ────────────────────────────────────────────────────────
    resume_skills = set(_extract_skills(resume_text))
    jd_skills = set(_extract_skills(jd_text))

    if jd_skills:
        skill_score = (len(resume_skills & jd_skills) / len(jd_skills)) * 100
    else:
        # No skills in JD — score on absolute breadth of resume skills
        skill_score = min(100.0, len(resume_skills) * 6.0)

    skill_score = min(100.0, round(skill_score, 1))
    matched_skills = sorted(resume_skills & jd_skills) if jd_skills else sorted(resume_skills)

    # ── 2. Experience score ───────────────────────────────────────────────────
    years = _extract_years_experience(resume_text)
    if years == 0:
        exp_score = 20.0
    elif years <= 2:
        exp_score = 20.0 + years * 12.5       # 0→20, 2→45
    elif years <= 5:
        exp_score = 45.0 + (years - 2) * 10.0  # 2→45, 5→75
    else:
        exp_score = min(95.0, 75.0 + (years - 5) * 4.0)  # 5→75, 10→95

    exp_score = min(100.0, round(exp_score, 1))

    # ── 3. Content relevance via TF-IDF/Jaccard ───────────────────────────────
    raw_relevance = _cosine_similarity(resume_text, jd_text)
    # Scale 0–1 → 10–100 (floor of 10 so generic resumes still show a value)
    relevance_score = min(100.0, round(10.0 + raw_relevance * 90.0, 1))

    # ── 4. Weighted overall (relevance 50%, skills 30%, experience 20%) ───────
    overall = (
        relevance_score * 0.50
        + skill_score * 0.30
        + exp_score * 0.20
    )
    overall = min(100.0, round(overall, 1))

    explanation = (
        f"Matched {len(matched_skills)} required skill(s). "
        f"Detected ~{int(years)} year(s) of experience. "
        f"Content relevance to JD: {raw_relevance:.0%}."
    )

    logger.debug(
        f"[scorer] rank={rank} overall={overall} "
        f"skills={skill_score} exp={exp_score} relevance={relevance_score}"
    )

    return {
        "overall_score": overall,
        "score_breakdown": {
            "skills": skill_score,
            "experience": exp_score,
            "relevance": relevance_score,
            "tags": matched_skills[:10],
            "explanation": explanation,
            "details": {
                "years_detected": years,
                "resume_skills_count": len(resume_skills),
                "jd_skills_count": len(jd_skills),
                "raw_cosine_similarity": round(raw_relevance, 4),
                "rank": rank,
            },
        },
    }
