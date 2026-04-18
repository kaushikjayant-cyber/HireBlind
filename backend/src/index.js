/**
 * HireBlind Pro — Express.js API Server
 * Replaces FastAPI backend, runs on port 8000.
 * All routes are mounted under /api to match the existing Vite proxy config.
 *
 * Python AI service (Flask, port 8001) handles parse/anonymise/score.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Route modules
const sessionsRouter = require('./routes/sessions');
const resumesRouter = require('./routes/resumes');
const anonymiseRouter = require('./routes/anonymise');
const scoreRouter = require('./routes/score');
const revealRouter = require('./routes/reveal');
const auditRouter = require('./routes/audit');
const complianceRouter = require('./routes/compliance');
const adminKeyRouter = require('./routes/adminKey');

const app = express();
const PORT = process.env.PORT || 8000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Parse JSON bodies (multer routes handle their own multipart parsing)
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/sessions', sessionsRouter);
app.use('/api/resumes', resumesRouter);
app.use('/api/anonymise', anonymiseRouter);
app.use('/api/score', scoreRouter);
app.use('/api/reveal-identity', revealRouter);
app.use('/api/audit-log', auditRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/admin-key', adminKeyRouter);

// ── Root & Health ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'HireBlind API',
    version: '2.0.0',
    roles: ['admin', 'recruiter'],
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ detail: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Express Error]', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ detail: 'File exceeds 10 MB limit.' });
  }
  res.status(500).json({ detail: err.message || 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`[HireBlind API] Express server running on http://localhost:${PORT}`);
    console.log(`[HireBlind API] AI Service expected at ${process.env.AI_SERVICE_URL || 'http://localhost:8001'}`);
  });

  // Graceful shutdown on SIGTERM (Docker / process managers)
  process.on('SIGTERM', () => {
    console.log('[HireBlind API] SIGTERM received — closing HTTP server');
    server.close(() => {
      console.log('[HireBlind API] Server closed');
      process.exit(0);
    });
  });
}

// Catch unhandled promise rejections so the process doesn't crash silently
process.on('unhandledRejection', (reason) => {
  console.error('[HireBlind API] Unhandled Rejection:', reason);
});

module.exports = app;
