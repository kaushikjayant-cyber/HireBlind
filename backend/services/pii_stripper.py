import re
import unicodedata
from typing import List, Dict

# Attempt to load spaCy; fallback to regex-only if unavailable
try:
    import spacy
    _nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    _nlp = None


# ─── Regex patterns ────────────────────────────────────────────────────────────
PATTERNS = {
    "email": re.compile(
        r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b'
    ),
    "phone": re.compile(
        r'(?:\+?\d{1,3}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}(?:[\s\-.]?\d{1,4})?(?:\s?(?:#|x\.?|ext\.?|extension)\s?\d{1,4})?',
        re.IGNORECASE
    ),
    "url": re.compile(
        r'https?://[^\s]+|(?:www\.|linkedin\.com|github\.com|twitter\.com)[^\s]*',
        re.IGNORECASE
    ),
    "dob": re.compile(
        r'\b(?:born|b\.?\s*)?(?:\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|'
        r'\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}|'
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b',
        re.IGNORECASE
    ),
    "postcode_nl": re.compile(r'\b[1-9][0-9]{3}\s?[A-Z]{2}\b', re.IGNORECASE),
    "postcode_gen": re.compile(r'\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b', re.IGNORECASE),
    "gender_pronoun": re.compile(
        r'\b(he/him|she/her|they/them|he|she|his|her|hers|him)\b',
        re.IGNORECASE
    ),
    "address": re.compile(
        r'\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Weg|straat|laan|plein|kade|singel)\b',
        re.IGNORECASE
    ),
    "nationality": re.compile(
        r'\b(Dutch|German|French|British|American|Belgian|Spanish|Italian|'
        r'Polish|Romanian|Portuguese|Greek|Swedish|Danish|Norwegian|Finnish|'
        r'Moroccan|Turkish|Surinamese|Indonesian|Chinese|Indian|Pakistani|'
        r'Nationality:\s*\w+)\b',
        re.IGNORECASE
    ),
}

UNIVERSITY_KEYWORDS = [
    "universiteit", "university", "hogeschool", "polytechnic", "institute of technology",
    "college", "academy", "business school", "school of", "faculty of"
]

REPLACE_MAP = {
    "email": "[EMAIL REMOVED]",
    "phone": "[PHONE REMOVED]",
    "url": "[URL REMOVED]",
    "dob": "[DOB REMOVED]",
    "postcode_nl": "[POSTCODE REMOVED]",
    "postcode_gen": "[POSTCODE REMOVED]",
    "gender_pronoun": "[PRONOUN REMOVED]",
    "address": "[ADDRESS REMOVED]",
    "nationality": "[NATIONALITY REMOVED]",
    "name": "[NAME REMOVED]",
    "location": "[LOCATION REMOVED]",
    "org": "[ORGANISATION REMOVED]",
    "university": "[UNIVERSITY REMOVED]",
}


def _assign_university_code(name: str, mapping: dict) -> str:
    """Consistently map university names to Univ A/B/C."""
    if name not in mapping:
        idx = len(mapping)
        codes = ["A", "B", "C", "D", "E", "F", "G", "H"]
        mapping[name] = f"University {codes[idx % len(codes)]}"
    return mapping[name]


def _is_university_line(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in UNIVERSITY_KEYWORDS)


def strip_pii(text: str) -> Dict:
    """
    Strip all PII from resume text.
    Returns: { anonymised_text, pii_found: [{field, count}] }
    """
    result = text
    pii_found: List[Dict] = []
    univ_mapping: Dict[str, str] = {}

    def _log(field: str, count: int = 1):
        pii_found.append({"field": field, "count": count})

    # 1. spaCy NER (names, locations, organisations)
    if SPACY_AVAILABLE and _nlp:
        doc = _nlp(result[:10000])  # cap at 10k chars for speed
        # Process longest spans first to avoid partial replacements
        ents = sorted(doc.ents, key=lambda e: len(e.text), reverse=True)
        for ent in ents:
            if ent.label_ == "PERSON":
                result = result.replace(ent.text, "[NAME REMOVED]")
                _log("name")
            elif ent.label_ in ("GPE", "LOC"):
                result = result.replace(ent.text, "[LOCATION REMOVED]")
                _log("location")
            elif ent.label_ == "ORG":
                # University detection before generic org strip
                if _is_university_line(ent.text):
                    code = _assign_university_code(ent.text, univ_mapping)
                    result = result.replace(ent.text, code)
                    _log("university")
                else:
                    # Keep company names (work experience is relevant)
                    pass

    # 2. University lines via keyword matching (catch non-NER cases)
    lines = result.split("\n")
    processed_lines = []
    for line in lines:
        if _is_university_line(line):
            # Extract university name heuristically
            code = _assign_university_code(line.strip()[:80], univ_mapping)
            processed_lines.append(code)
            _log("university")
        else:
            processed_lines.append(line)
    result = "\n".join(processed_lines)

    # 3. Regex patterns
    for field, pattern in PATTERNS.items():
        matches = pattern.findall(result)
        if matches:
            result = pattern.sub(REPLACE_MAP.get(field, f"[{field.upper()} REMOVED]"), result)
            _log(field, len(matches))

    # 4. Clean up multiple consecutive removals
    result = re.sub(r'(\[[\w\s]+REMOVED\]\s*){3,}', '[MULTIPLE FIELDS REMOVED] ', result)

    return {
        "anonymised_text": result,
        "pii_found": pii_found,
        "university_mapping_count": len(univ_mapping),
        "spacy_used": SPACY_AVAILABLE,
    }
