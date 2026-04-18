/**
 * Admin Key router — mirrors Python routers/admin_key.py.
 * Validates admin keys during recruiter signup and assigns admin_id.
 *
 * POST /api/admin-key/validate  — public, no auth required
 * POST /api/admin-key/assign    — public, called after Supabase signUp()
 * POST /api/admin-key/generate  — regenerate key for an admin
 */
const express = require('express');
const crypto = require('crypto');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();

function generateAdminKey(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    key += chars[bytes[i] % chars.length];
  }
  return key;
}

// POST /api/admin-key/validate
router.post('/validate', async (req, res) => {
  const { admin_key } = req.body;

  if (!admin_key || admin_key.length < 4) {
    return res.status(400).json({ detail: 'Admin key is too short.' });
  }

  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('users')
      .select('id, email')
      .eq('admin_key', admin_key.trim().toUpperCase())
      .eq('role', 'admin')
      .single();

    if (!data) {
      return res.json({ valid: false, admin_email: null, admin_id: null });
    }

    return res.json({ valid: true, admin_email: data.email, admin_id: data.id });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// POST /api/admin-key/assign
router.post('/assign', async (req, res) => {
  const { user_id, admin_key } = req.body;

  if (!admin_key) {
    return res.status(400).json({ detail: 'Admin key is required for recruiters.' });
  }

  try {
    const sb = getSupabase();

    // Find admin by key
    const { data: adminData } = await sb
      .from('users')
      .select('id')
      .eq('admin_key', admin_key.trim().toUpperCase())
      .eq('role', 'admin')
      .single();

    if (!adminData) {
      return res
        .status(400)
        .json({ detail: 'Invalid admin key. Please ask your Admin for the correct key.' });
    }

    const admin_id = adminData.id;

    // Stamp admin_id on recruiter's users row
    await sb.from('users').update({ admin_id }).eq('id', user_id);

    return res.json({ success: true, admin_id });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

// POST /api/admin-key/generate
// Body: { admin_id: string }
router.post('/generate', async (req, res) => {
  const { admin_id } = req.body;

  if (!admin_id) {
    return res.status(400).json({ detail: 'admin_id is required in request body.' });
  }

  try {
    const sb = getSupabase();

    // Verify target is admin
    const { data } = await sb.from('users').select('role').eq('id', admin_id).single();

    if (!data || data.role !== 'admin') {
      return res.status(403).json({ detail: 'Only admin users can have an admin key.' });
    }

    const new_key = generateAdminKey();
    await sb.from('users').update({ admin_key: new_key }).eq('id', admin_id);

    return res.json({ admin_key: new_key });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
