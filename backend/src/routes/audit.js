/**
 * Audit Log router — mirrors Python routers/audit.py.
 * Admin only. Aggregates pii_audit_log + override_log + identity_reveal_log.
 *
 * GET /api/audit-log?session_id=...&limit=50
 */
const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const session_id = req.query.session_id || null;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));

    // PII audit log
    let piiQuery = sb.from('pii_audit_log').select('*').order('stripped_at', { ascending: false }).limit(limit);
    if (session_id) piiQuery = piiQuery.eq('session_id', session_id);
    const { data: pii_logs } = await piiQuery;

    // Override log
    let overrideQuery = sb.from('override_log').select('*').order('overridden_at', { ascending: false }).limit(limit);
    if (session_id) overrideQuery = overrideQuery.eq('session_id', session_id);
    const { data: override_logs } = await overrideQuery;

    // Identity reveal log
    let revealQuery = sb.from('identity_reveal_log').select('*').order('revealed_at', { ascending: false }).limit(limit);
    if (session_id) revealQuery = revealQuery.eq('session_id', session_id);
    const { data: reveal_logs } = await revealQuery;

    const pii = pii_logs || [];
    const overrides = override_logs || [];
    const reveals = reveal_logs || [];

    // Build unified timeline
    const events = [];
    for (const e of pii) {
      events.push({
        type: 'pii_stripped',
        timestamp: e.stripped_at,
        session_id: e.session_id,
        resume_id: e.resume_id,
        detail: `PII fields stripped: ${Array.isArray(e.pii_fields_removed) ? e.pii_fields_removed.join(', ') : (e.field_stripped || 'unknown')}`,
        actor: e.stripped_by || 'system',
      });
    }
    for (const e of overrides) {
      events.push({
        type: 'ranking_override',
        timestamp: e.overridden_at,
        session_id: e.session_id,
        resume_id: e.resume_id,
        detail: `Rank changed #${e.original_rank} → #${e.new_rank}: ${e.reason}`,
        actor: e.overridden_by,
      });
    }
    for (const e of reveals) {
      events.push({
        type: 'identity_revealed',
        timestamp: e.revealed_at,
        session_id: e.session_id,
        resume_id: e.resume_id,
        detail: `Identity revealed (already_revealed=${e.already_revealed || false})`,
        actor: e.revealed_by,
      });
    }

    // Sort by timestamp descending
    events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    return res.json({
      generated_at: new Date().toISOString(),
      total_events: events.length,
      pii_events: pii.length,
      override_events: overrides.length,
      reveal_events: reveals.length,
      events: events.slice(0, limit),
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
