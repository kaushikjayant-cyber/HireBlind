/**
 * Reveal-Identity router — mirrors Python routers/reveal.py.
 *
 * POST /api/reveal-identity/:resume_id   — permanently reveal candidate identity
 * GET  /api/reveal-identity/status/:resume_id — check if already revealed
 */
const express = require('express');
const { requireRecruiterOrAdmin } = require('../middleware/auth');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();

function buildDisplayName(raw) {
  let display = raw || 'Unknown';
  for (const ext of ['.pdf', '.docx', '.doc', '.txt']) {
    if (display.toLowerCase().endsWith(ext)) {
      display = display.slice(0, -ext.length);
    }
  }
  display = display.replace(/_/g, ' ').replace(/-/g, ' ').trim();
  return display || raw;
}

// POST /api/reveal-identity/:resume_id
router.post('/:resume_id', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const { resume_id } = req.params;
    const user = req.currentUser;

    const { data: resume, error } = await sb
      .from('resumes')
      .select('id, session_id, original_file_name, identity_revealed, overall_score, uploaded_by')
      .eq('id', resume_id)
      .single();

    if (error || !resume) return res.status(404).json({ detail: 'Resume not found.' });

    const now = new Date().toISOString();
    const already_revealed = resume.identity_revealed || false;

    // Always log every reveal attempt (idempotent)
    try {
      await sb.from('identity_reveal_log').insert({
        resume_id,
        session_id: resume.session_id,
        revealed_by: user.id,
        revealed_at: now,
        already_revealed,
      });
    } catch (_) {
      // Non-fatal
    }

    // Mark resume as revealed
    await sb.from('resumes').update({
      identity_revealed: true,
      identity_revealed_at: now,
      identity_revealed_by: user.id,
    }).eq('id', resume_id);

    const raw_name = resume.original_file_name || 'Unknown';
    const display_name = buildDisplayName(raw_name);

    return res.json({
      resume_id,
      session_id: resume.session_id,
      original_file_name: raw_name,
      display_name,
      overall_score: resume.overall_score || 0,
      revealed_at: now,
      revealed_by_email: user.email || '',
      revealed_by_role: user.role || '',
      already_revealed,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// GET /api/reveal-identity/status/:resume_id
router.get('/status/:resume_id', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const { resume_id } = req.params;

    const { data: r, error } = await sb
      .from('resumes')
      .select('id, identity_revealed, identity_revealed_at, original_file_name')
      .eq('id', resume_id)
      .single();

    if (error || !r) return res.status(404).json({ detail: 'Resume not found.' });

    if (r.identity_revealed) {
      const raw = r.original_file_name || '';
      const display = buildDisplayName(raw);
      return res.json({
        revealed: true,
        original_file_name: raw,
        display_name: display,
        revealed_at: r.identity_revealed_at,
      });
    }

    return res.json({
      revealed: false,
      original_file_name: null,
      display_name: null,
      revealed_at: null,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
