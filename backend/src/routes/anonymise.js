/**
 * Anonymise router — mirrors Python routers/anonymise.py.
 *
 * POST /api/anonymise      — receive file via multer → call Flask AI /parse + /anonymise
 *                            → save anonymised_content to Supabase → return result
 * POST /api/anonymise/text — plain-text version (demo/testing)
 */
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { requireRecruiterOrAdmin, getTenantAdminId } = require('../middleware/auth');
const { getSupabase } = require('../lib/supabase');

const router = express.Router();

const AI_SERVICE = process.env.AI_SERVICE_URL || 'http://localhost:8001';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.txt']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Store file in memory for forwarding to AI service
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function getExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx).toLowerCase();
}

// POST /api/anonymise
router.post('/', upload.single('file'), requireRecruiterOrAdmin, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ detail: 'No file uploaded.' });
  }

  const fname = req.file.originalname || 'resume.pdf';
  const ext = getExtension(fname);
  const session_id = req.body.session_id;

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res
      .status(400)
      .json({ detail: `File type '${ext}' not supported. Accepted: PDF, DOCX, DOC, TXT.` });
  }

  if (req.file.size < 50) {
    return res.status(400).json({ detail: `'${fname}' appears to be empty or too small.` });
  }

  // ── 1. Call Flask AI service: parse ──────────────────────────────────────
  let raw_text;
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: fname, contentType: req.file.mimetype });
    form.append('filename', fname);

    const parseRes = await axios.post(`${AI_SERVICE}/parse`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
    raw_text = parseRes.data.raw_text;
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    const status = err.response?.status || 502;
    return res.status(status).json({ detail: `Parsing failed: ${detail}` });
  }

  if (!raw_text || !raw_text.trim()) {
    return res.status(422).json({
      detail: `No text extracted from '${fname}'. The file may be image-based (scanned PDF). Please use a text-based PDF or DOCX.`,
    });
  }

  // ── 2. Call Flask AI service: anonymise ───────────────────────────────────
  let anonymiseResult;
  try {
    const anonymiseRes = await axios.post(
      `${AI_SERVICE}/anonymise`,
      { text: raw_text },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    anonymiseResult = anonymiseRes.data;
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    return res.status(500).json({ detail: `PII stripping failed: ${detail}` });
  }

  const anonymised_text = anonymiseResult.anonymised_text || '';
  const pii_found = anonymiseResult.pii_found || [];

  // ── 3. Save anonymised_content to Supabase ────────────────────────────────
  const sb = getSupabase();
  const user = req.currentUser;
  const tenant_admin_id = getTenantAdminId(user);
  const now = new Date().toISOString();

  let resume_id = null;
  try {
    const { data: updateData } = await sb
      .from('resumes')
      .update({
        anonymised_content: anonymised_text,
        processing_status: 'anonymised',
        file_type: ext.slice(1),
        recruiter_id: user.id,
        admin_id: tenant_admin_id,
      })
      .eq('session_id', session_id)
      .eq('original_file_name', fname)
      .select('id');

    if (updateData && updateData.length > 0) {
      resume_id = updateData[0].id;
    }
  } catch (_) {
    // Non-fatal — don't block anonymisation if DB update fails
  }

  // ── 4. Log PII audit event ────────────────────────────────────────────────
  if (pii_found.length > 0) {
    try {
      await sb.from('pii_audit_log').insert({
        session_id,
        resume_id,
        filename: fname,
        pii_fields_removed: pii_found,
        stripped_by: user.id,
        stripped_at: now,
      });
    } catch (_) {
      // Non-fatal
    }
  }

  return res.json({
    session_id,
    filename: fname,
    resume_id,
    original_length: raw_text.length,
    anonymised_length: anonymised_text.length,
    anonymised_text,
    pii_found,
    university_mapping_count: anonymiseResult.university_mapping_count || 0,
    spacy_used: anonymiseResult.spacy_used || false,
  });
});

// POST /api/anonymise/text
router.post('/text', requireRecruiterOrAdmin, async (req, res) => {
  const text = req.body.text || '';
  if (!text) return res.status(400).json({ detail: 'No text provided.' });

  try {
    const aiRes = await axios.post(
      `${AI_SERVICE}/anonymise`,
      { text },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    return res.json(aiRes.data);
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    return res.status(500).json({ detail: `Anonymisation failed: ${detail}` });
  }
});

module.exports = router;
