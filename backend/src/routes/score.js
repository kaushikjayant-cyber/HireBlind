/**
 * Score router — mirrors Python routers/score.py.
 * Proxies to Flask AI service for ML scoring.
 *
 * POST /api/score
 *   Body: { session_id, resume_id, anonymised_text, job_description?, rank? }
 */
const express = require('express');
const axios = require('axios');
const { requireRecruiterOrAdmin } = require('../middleware/auth');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();
const AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8001';

router.post('/', requireRecruiterOrAdmin, async (req, res) => {
  const {
    session_id,
    resume_id,
    anonymised_text,
    job_description = '',
    rank = 1,
  } = req.body;

  if (!anonymised_text || !anonymised_text.trim()) {
    return res.status(400).json({ detail: 'No resume text provided.' });
  }

  const jd = job_description.trim() || 'general professional position';

  try {
    const aiRes = await axios.post(
      `${AI_SERVICE}/score`,
      { anonymised_text, job_description: jd, rank },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );

    const result = aiRes.data;
    const breakdown = result.score_breakdown || {};

    const scorePayload = {
      overall_score: result.overall_score,
      score_breakdown: {
        skills: breakdown.skills || 0,
        experience: breakdown.experience || 0,
        relevance: breakdown.relevance || 0,
        tags: breakdown.tags || [],
        explanation: breakdown.explanation || '',
        details: breakdown.details || {},
      },
    };

    // Persist scores to DB when resume_id is provided
    if (resume_id) {
      try {
        const sb = getSupabase();
        await sb
          .from('resumes')
          .update({ ...scorePayload, processing_status: 'scored' })
          .eq('id', resume_id);
      } catch (dbErr) {
        // Non-fatal — log but don't block the response
        console.error('[score] DB persist failed:', dbErr.message);
      }
    }

    return res.json({
      session_id,
      resume_id,
      ...scorePayload,
      confidence: Math.min(99, Math.round(result.overall_score * 0.95 + 5)),
      jd_provided: Boolean(job_description.trim()),
    });
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    const status = err.response?.status || 502;
    return res.status(status).json({ detail: `Scoring failed: ${detail}` });
  }
});

module.exports = router;

