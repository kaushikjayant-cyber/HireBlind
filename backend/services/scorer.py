import re
from typing import List, Dict, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


SKILLS_KEYWORDS = [
    "python", "javascript", "typescript", "react", "node", "fastapi", "django", "flask",
    "sql", "postgresql", "mysql", "mongodb", "redis", "docker", "kubernetes", "aws", "azure",
    "gcp", "git", "ci/cd", "rest", "graphql", "java", "kotlin", "swift", "go", "rust",
    "c++", "c#", ".net", "vue", "angular", "tailwind", "css", "html", "linux", "terraform",
    "machine learning", "deep learning", "nlp", "pandas", "numpy", "tensorflow", "pytorch",
    "scikit-learn", "spark", "hadoop", "tableau", "power bi", "excel", "agile", "scrum",
    "leadership", "management", "communication", "teamwork", "problem solving",
    "recruitment", "hr", "sourcing", "interviewing", "onboarding", "compliance",
]


def _extract_experience_years(text: str) -> float:
    """Extract years of experience from resume text."""
    patterns = [
        r'(\d+)\+?\s*(?:years?|yr)s?\s+(?:of\s+)?(?:experience|exp)',
        r'(?:experience|exp)[:\s]+(\d+)\+?\s*(?:years?|yr)s?',
        r'(\d{4})\s*[-–]\s*(?:present|now|current|\d{4})',
    ]
    max_years = 0.0
    for p in patterns[:2]:
        for match in re.finditer(p, text, re.IGNORECASE):
            yrs = float(match.group(1))
            max_years = max(max_years, yrs)

    # Date range patterns (count job durations)
    date_ranges = re.findall(r'(\d{4})\s*[-–]\s*(present|now|current|\d{4})', text, re.IGNORECASE)
    import datetime
    current_year = datetime.datetime.now().year
    total_from_ranges = 0.0
    for start, end in date_ranges:
        start_yr = int(start)
        end_yr = current_year if end.lower() in ("present", "now", "current") else int(end)
        diff = max(0, end_yr - start_yr)
        total_from_ranges += diff

    return max(max_years, min(total_from_ranges, 30))  # cap at 30 years


def _extract_skills_from_text(text: str) -> List[str]:
    """Extract known skills mentioned in text."""
    text_lower = text.lower()
    found = []
    for skill in SKILLS_KEYWORDS:
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            found.append(skill)
    return found


def _skills_score(resume_text: str, jd_text: str) -> Dict:
    """Compute skills match score (0-40) using TF-IDF cosine similarity."""
    texts = [resume_text, jd_text]
    try:
        vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=500,
            ngram_range=(1, 2)
        )
        tfidf = vectorizer.fit_transform(texts)
        similarity = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        raw_score = float(similarity) * 40

        # Skill tag matching bonus
        resume_skills = set(_extract_skills_from_text(resume_text))
        jd_skills = set(_extract_skills_from_text(jd_text))
        matched_skills = resume_skills & jd_skills
        bonus = min(5, len(matched_skills) * 0.5)

        return {
            "score": min(40, round(raw_score + bonus, 1)),
            "matched_skills": list(matched_skills),
            "similarity": round(float(similarity), 3),
        }
    except Exception:
        return {"score": 0.0, "matched_skills": [], "similarity": 0.0}


def _experience_score(resume_text: str, jd_text: str) -> Dict:
    """Compute experience score (0-30) based on years extracted."""
    # Extract required years from JD
    jd_years = 0.0
    jd_match = re.search(r'(\d+)\+?\s*(?:years?|yr)s?\s+(?:of\s+)?(?:experience|exp)', jd_text, re.IGNORECASE)
    if jd_match:
        jd_years = float(jd_match.group(1))

    resume_years = _extract_experience_years(resume_text)

    if jd_years <= 0:
        # No requirement specified — score based on absolute experience
        score = min(30, resume_years * 3)
    elif resume_years >= jd_years:
        # Meets or exceeds requirement
        score = min(30, 25 + min(5, (resume_years - jd_years) * 0.5))
    else:
        # Proportional score
        score = (resume_years / jd_years) * 25

    return {
        "score": round(score, 1),
        "resume_years": resume_years,
        "required_years": jd_years,
    }


def _relevance_score(resume_text: str, jd_text: str) -> Dict:
    """Compute overall role relevance score (0-30) using TF-IDF cosine similarity."""
    texts = [resume_text, jd_text]
    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=1000)
        tfidf = vectorizer.fit_transform(texts)
        similarity = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        return {
            "score": round(float(similarity) * 30, 1),
            "similarity": round(float(similarity), 3),
        }
    except Exception:
        return {"score": 0.0, "similarity": 0.0}


def _build_explanation(skills_r: Dict, exp_r: Dict, rel_r: Dict, rank: int) -> str:
    parts = []
    if skills_r["score"] >= 30:
        parts.append(f"strong skills match ({skills_r['score']:.0f}/40)")
    elif skills_r["score"] >= 20:
        parts.append(f"good skills match ({skills_r['score']:.0f}/40)")
    else:
        parts.append(f"partial skills match ({skills_r['score']:.0f}/40)")

    yrs = exp_r["resume_years"]
    parts.append(f"{yrs:.0f} year{'s' if yrs != 1 else ''} exp")

    if rel_r["score"] >= 20:
        parts.append("high role relevance")
    elif rel_r["score"] >= 12:
        parts.append("moderate role relevance")
    else:
        parts.append("low role relevance")

    return f"Ranked #{rank} because: {', '.join(parts)}."


def score_resume(resume_text: str, jd_text: str, rank: int = 1) -> Dict:
    """
    Score a resume against a job description.
    Returns score_breakdown + overall_score (0-100).
    """
    skills_r = _skills_score(resume_text, jd_text)
    exp_r = _experience_score(resume_text, jd_text)
    rel_r = _relevance_score(resume_text, jd_text)

    overall = round(skills_r["score"] + exp_r["score"] + rel_r["score"], 1)
    overall = min(100, overall)

    # Build tags from matched skills
    tags = [f"{s} ✓" for s in skills_r["matched_skills"][:6]]
    if exp_r["resume_years"] >= (exp_r["required_years"] or 1):
        tags.append(f"{exp_r['resume_years']:.0f} yrs exp ✓")

    explanation = _build_explanation(skills_r, exp_r, rel_r, rank)

    return {
        "overall_score": overall,
        "score_breakdown": {
            "skills": skills_r["score"],
            "experience": exp_r["score"],
            "relevance": rel_r["score"],
            "tags": tags,
            "explanation": explanation,
            "details": {
                "matched_skills": skills_r["matched_skills"],
                "resume_years": exp_r["resume_years"],
                "required_years": exp_r["required_years"],
                "skills_similarity": skills_r["similarity"],
                "relevance_similarity": rel_r["similarity"],
            }
        }
    }
