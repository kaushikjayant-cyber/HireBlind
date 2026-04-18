/**
 * Sessions (Job Pipelines) router — mirrors Python routers/sessions.py.
 * Multi-tenant aware:
 *   - Recruiter sees only their own sessions (created_by == self)
 *   - Admin sees only sessions from their tenant (admin_id == self)
 */
const express = require('express');
const { requireRecruiterOrAdmin, getTenantAdminId } = require('../middleware/auth');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();

// GET /api/sessions
router.get('/', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const user = req.currentUser;
    let query = sb.from('sessions').select('*').order('created_at', { ascending: false });

    if (user.role === 'admin') {
      query = query.eq('admin_id', user.id);
    } else {
      query = query.eq('created_by', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// POST /api/sessions
router.post('/', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const user = req.currentUser;
    const { job_title, job_description, status = 'active' } = req.body;

    if (!job_title) return res.status(400).json({ detail: 'job_title is required.' });

    const payload = {
      job_title,
      job_description,
      status,
      created_by: user.id,
      admin_id: getTenantAdminId(user),
    };

    const { data, error } = await sb.from('sessions').insert(payload).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// GET /api/sessions/:session_id
router.get('/:session_id', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const user = req.currentUser;
    const { session_id } = req.params;

    const { data, error } = await sb
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (error || !data) return res.status(404).json({ detail: 'Session not found.' });

    // Ownership check
    if (user.role === 'recruiter' && data.created_by !== user.id) {
      return res.status(403).json({ detail: 'Access denied — not your session.' });
    }
    if (user.role === 'admin' && data.admin_id !== user.id) {
      return res.status(403).json({ detail: "Access denied — not your tenant's session." });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// PATCH /api/sessions/:session_id
router.patch('/:session_id', requireRecruiterOrAdmin, async (req, res) => {
  try {
    const sb = getSupabase();
    const user = req.currentUser;
    const { session_id } = req.params;

    const { data: check, error: checkError } = await sb
      .from('sessions')
      .select('created_by, admin_id')
      .eq('id', session_id)
      .single();

    if (checkError || !check) return res.status(404).json({ detail: 'Session not found.' });

    if (user.role === 'recruiter' && check.created_by !== user.id) {
      return res.status(403).json({ detail: 'You can only update your own sessions.' });
    }
    if (user.role === 'admin' && check.admin_id !== user.id) {
      return res.status(403).json({ detail: "Access denied — not your tenant's session." });
    }

    // Prevent tampering with ownership fields
    const body = { ...req.body };
    delete body.created_by;
    delete body.admin_id;

    const { data, error } = await sb
      .from('sessions')
      .update(body)
      .eq('id', session_id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data || {});
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
