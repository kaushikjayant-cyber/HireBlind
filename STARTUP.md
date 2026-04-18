# HireBlind Pro — Startup Guide

## Architecture

```
Browser (5173) → Vite Proxy /api/* → Express (8000) → Flask AI (8001)
                                           └──────────────→ Supabase
```

Two backend processes must run simultaneously:
| Process | Port | Command |
|---|---|---|
| **Express API** | 8000 | `node server/src/index.js` |
| **Flask AI** | 8001 | `python backend/ai_service/app.py` |
| **Frontend** | 5173 | `npm run dev` |

---

## Quick Start (3 Terminals)

### Terminal 1 — Flask AI Service
```powershell
cd d:\HireBlind
# Activate your venv first if you use one
.\.venv\Scripts\Activate.ps1   # or: .\backend\venv\Scripts\Activate.ps1
python backend/ai_service/app.py
```
Expected output: `[AI Service] Listening on http://localhost:8001`

### Terminal 2 — Express API Server
```powershell
cd d:\HireBlind\server
node src/index.js
# Or with hot-reload: npx nodemon src/index.js
```
Expected output: `[HireBlind API] Express server running on http://localhost:8000`

### Terminal 3 — React Frontend
```powershell
cd d:\HireBlind
npm run dev
```
Expected output: `Local: http://localhost:5173/`

---

## Environment Variables

### `server/.env` (Node.js)
```
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
AI_SERVICE_URL=http://localhost:8001
PORT=8000
```

### `backend/.env` (Python — unchanged)
```
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## First-Time Setup

### Node dependencies
```powershell
cd d:\HireBlind\server
npm install
```

### Python dependencies (Flask AI service only)
```powershell
cd d:\HireBlind
pip install flask flask-cors
# Core ML deps should already be installed:
# pdfplumber python-docx spacy scikit-learn numpy
```

### spaCy model (if not already downloaded)
```powershell
python -m spacy download en_core_web_sm
```

---

## Health Checks

```powershell
# Express server
Invoke-RestMethod -Uri http://localhost:8000/api/health

# Flask AI service
Invoke-RestMethod -Uri http://localhost:8001/health
```

---

## What Changed vs FastAPI

| Before | After |
|---|---|
| FastAPI on port 8000 | **Express.js on port 8000** (same port) |
| Python scorer called inline | Flask AI service on 8001 (called by Express) |
| `uvicorn backend/main.py` | `node server/src/index.js` |
| `backend/.env` credentials | Copy in `server/.env` too |

> **Frontend: zero changes required.** Vite still proxies `/api` → `localhost:8000`.
