/**
 * Centralized API client for HireBlind FastAPI backend.
 * Vite dev-server proxies /api → http://localhost:8000 (see vite.config.js).
 * In production, set VITE_API_URL to the deployed backend origin.
 *
 * All requests send `X-User-Id` header so the FastAPI RBAC dependency
 * can verify the caller's role from the `users` table — not trusting the client.
 */
import { useAuthStore } from '../store/authStore'

const BASE = import.meta.env.VITE_API_URL || ''

function getUserId() {
  return useAuthStore.getState().user?.id || ''
}

/**
 * POST /api/anonymise  — Recruiter only
 * Uploads a resume file, strips PII, returns anonymised text.
 * Anonymisation MUST happen before scoring (PII-first rule).
 */
export async function anonymiseResume(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)

  const res = await fetch(`${BASE}/api/anonymise`, {
    method: 'POST',
    headers: { 'X-User-Id': getUserId() },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Anonymise failed (${res.status})`)
  }
  return res.json()
}

/**
 * POST /api/score  — Recruiter only
 * Scores anonymised resume text against a job description.
 * Input MUST be pre-anonymised text (no PII).
 */
export async function scoreResume(payload) {
  const res = await fetch(`${BASE}/api/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId(),
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Score failed (${res.status})`)
  }
  return res.json()
}

/**
 * GET /api/sessions  — Admin (all) or Recruiter (own)
 */
export async function fetchSessionsAPI() {
  const res = await fetch(`${BASE}/api/sessions`, {
    headers: { 'X-User-Id': getUserId() },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Fetch sessions failed (${res.status})`)
  }
  return res.json()
}

/**
 * POST /api/sessions  — Recruiter only
 * Creates a new hiring pipeline (job description).
 */
export async function createSessionAPI(payload) {
  const res = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId(),
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Create session failed (${res.status})`)
  }
  return res.json()
}

/**
 * POST /api/reveal-identity/{resumeId}  — Recruiter only
 * Permanently reveals a candidate identity. Logs to identity_reveal_log.
 * Returns: { resume_id, original_file_name, revealed_at, revealed_by }
 */
export async function revealIdentity(resumeId) {
  const res = await fetch(`${BASE}/api/reveal-identity/${resumeId}`, {
    method: 'POST',
    headers: { 'X-User-Id': getUserId() },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Reveal failed (${res.status})`)
  }
  return res.json()
}

/**
 * GET /api/reveal-identity/status/{resumeId}  — Recruiter only
 * Returns whether identity has already been revealed.
 */
export async function getRevealStatus(resumeId) {
  const res = await fetch(`${BASE}/api/reveal-identity/status/${resumeId}`, {
    headers: { 'X-User-Id': getUserId() },
  })
  if (!res.ok) return { revealed: false }
  return res.json()
}

/**
 * GET /api/health  — Public
 */
export async function checkHealth() {
  const res = await fetch(`${BASE}/api/health`)
  if (!res.ok) throw new Error('Backend not reachable')
  return res.json()
}
