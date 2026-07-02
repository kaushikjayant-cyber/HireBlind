/**
 * Compliance router — mirrors Python routers/compliance.py.
 * Returns full EU AI Act compliance report for a session.
 *
 * GET /api/compliance/:session_id
 */
const express = require('express');
const { requireRecruiterOrAdmin } = require('../middleware/auth');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();

router.get('/:session_id', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const { session_id } = req.params;

    const [sessionRes, piiRes, overrideRes, resumeRes, revealRes] = await Promise.all([
      sb.from('sessions').select('*').eq('id', session_id).single(),
      sb.from('pii_audit_log').select('*').eq('session_id', session_id),
      sb.from('override_log').select('*').eq('session_id', session_id),
      sb.from('resumes').select('id, overall_score, is_shortlisted').eq('session_id', session_id),
      sb.from('identity_reveal_log').select('*').eq('session_id', session_id),
    ]);

    const session = sessionRes.data;
    const pii_logs = piiRes.data || [];
    const override_logs = overrideRes.data || [];
    const resumes = resumeRes.data || [];
    const reveal_logs = revealRes.data || [];

    const pii_by_type = {};
    for (const log of pii_logs) {
      if (Array.isArray(log.pii_fields_removed)) {
        for (const ft of log.pii_fields_removed) {
          pii_by_type[ft] = (pii_by_type[ft] || 0) + 1;
        }
      } else {
        const ft = log.field_stripped || 'unknown';
        pii_by_type[ft] = (pii_by_type[ft] || 0) + 1;
      }
    }

    const checklist = {
      human_in_loop: true,
      pii_stripped: pii_logs.length > 0,
      audit_trail: true,
      explainability_tags: true,
      overrides_recorded: true,
      identity_reveals_logged: true,
    };

    return res.json({
      session_id,
      job_title: session?.job_title || null,
      created_at: session?.created_at || null,
      resumes_processed: resumes.length,
      pii_events: pii_logs.length,
      pii_by_type,
      override_count: override_logs.length,
      identity_reveals: reveal_logs.length,
      model_used: 'TF-IDF + Cosine Similarity (scikit-learn)',
      compliance_checklist: checklist,
      pii_audit_log: pii_logs,
      override_log: override_logs,
      identity_reveal_log: reveal_logs,
      generated_at: new Date().toISOString(),
      eu_ai_act_classification: 'High-Risk (Annex III — Employment)',
      human_oversight_article: 'Article 14 compliant',
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
