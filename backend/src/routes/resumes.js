/**
 * Resumes router — mirrors Python routers/resumes.py.
 * Returns only anonymised fields; never original_file_name
 * (that is only returned by /reveal-identity/:id).
 */
const express = require('express');
const { requireRecruiter, requireRecruiterOrAdmin } = require('../middleware/auth');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();

// GET /api/resumes/:session_id
router.get('/:session_id', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const { session_id } = req.params;

    const { data, error } = await sb
      .from('resumes')
      .select(
        'id, session_id, overall_score, score_breakdown, is_shortlisted, manually_adjusted, identity_revealed, identity_revealed_at, processing_status, uploaded_at'
      )
      .eq('session_id', session_id)
      .order('overall_score', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// DELETE /api/resumes/:resume_id
router.delete('/:resume_id', requireRecruiter, async (req, res) => {
  try {
    const sb = getSupabase();
    const { error } = await sb.from('resumes').delete().eq('id', req.params.resume_id);
    if (error) throw error;
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// PATCH /api/resumes/:resume_id/shortlist
router.patch('/:resume_id/shortlist', requireRecruiter, async (req, res) => {
  try {
    const sb = getSupabase();
    const { is_shortlisted = false } = req.body;

    const { data, error } = await sb
      .from('resumes')
      .update({ is_shortlisted })
      .eq('id', req.params.resume_id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data || {});
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
