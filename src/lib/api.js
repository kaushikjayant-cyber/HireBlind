/**
 * Centralized API client for HireBlind FastAPI backend.
 * Vite dev-server proxies /api → http://localhost:8000 (see vite.config.js).
 * In production, set VITE_API_URL to the deployed backend origin.
 */
const BASE = import.meta.env.VITE_API_URL || ''

/**
 * POST /api/anonymise
 * Uploads a resume file and strips PII.
 * @param {File} file
 * @param {string} sessionId
 * @returns {Promise<{anonymised_text: string, pii_found: Array, spacy_used: boolean}>}
 */
export async function anonymiseResume(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)

  const res = await fetch(`${BASE}/api/anonymise`, { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Anonymise failed (${res.status})`)
  }
  return res.json()
}

/**
 * POST /api/score
 * Scores an anonymised resume against a job description.
 * @param {{ session_id: string, resume_id: string, anonymised_text: string, job_description: string, rank?: number }} payload
 * @returns {Promise<{overall_score: number, score_breakdown: object, confidence: number}>}
 */
export async function scoreResume(payload) {
  const res = await fetch(`${BASE}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Score failed (${res.status})`)
  }
  return res.json()
}

/**
 * GET /api/health
 * Quick liveness check for the backend.
 * @returns {Promise<{status: string}>}
 */
export async function checkHealth() {
  const res = await fetch(`${BASE}/api/health`)
  if (!res.ok) throw new Error('Backend not reachable')
  return res.json()
}
