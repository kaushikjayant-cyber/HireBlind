"""
pii_stripper.py — PII detection and anonymisation service.
Uses regex patterns for emails, phone numbers, URLs, LinkedIn/GitHub profiles
and optionally spaCy NER for PERSON/GPE name detection.

Fixes applied:
  - Removed unused `os` import
  - Fixed regex ordering: specific patterns (LinkedIn, GitHub) BEFORE generic URL
    so LinkedIn/GitHub URLs aren't swallowed by the generic https?:// pattern
  - Removed dangerous spaCy lazy model download (production anti-pattern).
    spaCy is used only if `en_core_web_sm` is already installed.
  - pii_found now preserves all occurrences (not prematurely deduplicated) so
    the audit log receives the full list before the Node.js side deduplicates.
  - Added structured logging for each PII type found
"""
import re
import logging

logger = logging.getLogger(__name__)

# ── University name → generic label mapping ───────────────────────────────────
# Keys are regex patterns (case-insensitive); values are anonymised labels.
UNIVERSITY_ALIASES = {
    r"iit\s+\w+": "TOP_ENGINEERING_COLLEGE",
    r"iim\s+\w+": "TOP_MANAGEMENT_COLLEGE",
    r"bits\s+\w+": "TOP_ENGINEERING_COLLEGE",
    r"nit\s+\w+": "TOP_ENGINEERING_COLLEGE",
    r"harvard\s+university": "TOP_UNIVERSITY",
    r"\bmit\b": "TOP_ENGINEERING_COLLEGE",          # word-boundary to avoid false matches
    r"stanford\s+university": "TOP_UNIVERSITY",
    r"oxford\s+university": "TOP_UNIVERSITY",
    r"cambridge\s+university": "TOP_UNIVERSITY",
    r"delhi\s+university": "CENTRAL_UNIVERSITY",
    r"mumbai\s+university": "CENTRAL_UNIVERSITY",
    r"anna\s+university": "CENTRAL_UNIVERSITY",
    r"vtu\b": "CENTRAL_UNIVERSITY",
}

# ── PII regex patterns — ORDER MATTERS ────────────────────────────────────────
# More specific patterns must come BEFORE generic ones.
# e.g. LinkedIn URL must be matched before generic https?:// rule.
PII_PATTERNS = [
    # Email (before URL so foo@bar.com isn't treated as a URL path)
    (r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", "[EMAIL]", "email"),
    # LinkedIn profile URL — SPECIFIC before generic https?://
    (r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+/?", "[LINKEDIN]", "linkedin_url"),
    # GitHub profile URL — SPECIFIC before generic https?://
    (r"(?:https?://)?(?:www\.)?github\.com/[\w\-]+/?", "[GITHUB]", "github_url"),
    # Generic URL (catches all remaining https/http links)
    (r"https?://[^\s]+", "[URL]", "url"),
    # Phone: international (+91 98765 43210) and local (098-765-4321) formats
    (r"(?<!\d)(\+?\d[\d\s\-().]{7,}\d)(?!\d)", "[PHONE]", "phone"),
    # Social handle starting with @ (e.g. @john_doe)
    (r"(?<!\w)@[\w]{2,30}(?!\w)", "[HANDLE]", "social_handle"),
    # Aadhaar-style 12-digit Indian ID (spaced or unspaced)
    (r"\b\d{4}\s?\d{4}\s?\d{4}\b", "[AADHAAR]", "aadhaar"),
    # PAN card format (India)
    (r"\b[A-Z]{5}\d{4}[A-Z]\b", "[PAN]", "pan"),
]


def strip_pii(text: str) -> dict:
    """
    Remove PII from resume text.

    Returns:
        {
          "anonymised_text":        str,
          "pii_found":              list[str],  # all occurrences, not deduplicated
          "spacy_used":             bool,
          "university_mapping_count": int,
        }
    """
    if not text or not text.strip():
        return {
            "anonymised_text": text or "",
            "pii_found": [],
            "spacy_used": False,
            "university_mapping_count": 0,
        }

    anonymised = text
    pii_found: list = []

    # ── 1. Regex-based PII removal (ordered) ──────────────────────────────────
    for pattern, replacement, label in PII_PATTERNS:
        new_text, count = re.subn(pattern, replacement, anonymised, flags=re.IGNORECASE)
        if count > 0:
            pii_found.extend([label] * count)
            anonymised = new_text
            logger.debug(f"[pii_stripper] Removed {count}x '{label}'")

    # ── 2. University name mapping ─────────────────────────────────────────────
    university_mapping_count = 0
    for uni_pattern, label in UNIVERSITY_ALIASES.items():
        new_text, count = re.subn(uni_pattern, label, anonymised, flags=re.IGNORECASE)
        if count > 0:
            university_mapping_count += count
            anonymised = new_text
            logger.debug(f"[pii_stripper] Mapped {count}x university → '{label}'")

    # ── 3. spaCy NER (PERSON + location) — used only if model is pre-installed ─
    spacy_used = False
    try:
        import spacy
        # Only load if already installed — never trigger a download in production
        nlp = spacy.load("en_core_web_sm")

        doc = nlp(anonymised)
        replacements = []
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                replacements.append((ent.start_char, ent.end_char, "[NAME]", "person_name"))
            elif ent.label_ in ("GPE", "LOC"):
                replacements.append((ent.start_char, ent.end_char, "[LOCATION]", "location"))

        # Apply in reverse order to preserve character offsets
        for start, end, repl, label in sorted(replacements, key=lambda x: x[0], reverse=True):
            anonymised = anonymised[:start] + repl + anonymised[end:]
            pii_found.append(label)

        spacy_used = bool(replacements)
        logger.debug(f"[pii_stripper] spaCy found {len(replacements)} NER entities")

    except OSError:
        # Model not installed — skip NER silently (not an error in production)
        logger.info("[pii_stripper] spaCy model 'en_core_web_sm' not found — NER skipped")
    except ImportError:
        logger.info("[pii_stripper] spaCy not installed — NER skipped")
    except Exception as e:
        logger.warning(f"[pii_stripper] spaCy NER failed unexpectedly: {e}")

    return {
        "anonymised_text": anonymised,
        "pii_found": pii_found,          # all occurrences for audit log
        "spacy_used": spacy_used,
        "university_mapping_count": university_mapping_count,
    }
