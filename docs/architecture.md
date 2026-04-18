# HireBlind Architecture

## Service Map

| Service | Port | Runtime | Folder |
|---|---|---|---|
| React Frontend | 5173 | Vite + React | `frontend/` |
| Express API | 8000 | Node.js 18+ | `backend/` |
| AI Microservice | 8001 | Python 3.11 Flask | `ai-services/` |

## Request Flow

```
Browser (5173)
  └──> Vite proxy /api → Express (8000)
         ├──> Supabase (DB + Auth)
         └──> AI Service (8001)
                ├── POST /parse       → parser.py
                ├── POST /anonymise   → pii_stripper.py
                └── POST /score       → scorer.py
```

## Folder Structure

```
d:\HireBlind\
├── frontend/         # React + Vite UI
├── backend/          # Node.js Express API
│   └── src/
│       ├── index.js
│       ├── routes/
│       ├── middleware/
│       └── lib/
├── ai-services/      # Python Flask AI
│   ├── app.py
│   ├── services/
│   ├── install.bat
│   └── start_ai.bat
├── docs/
├── index.html        # Vite entry (root required)
├── vite.config.js
├── tailwind.config.js
├── .env              # Frontend Supabase keys
└── backend/.env      # Backend Supabase service role key
```

## How to Run

### 1. AI Service (port 8001)
```cmd
cd ai-services
install.bat      # first time only
start_ai.bat     # start Flask
```

### 2. Express Backend (port 8000)
```cmd
cd backend
npm install
node src/index.js
```

### 3. React Frontend (port 5173)
```cmd
npm install      # from project root
npm run dev
```

## Environment Variables

| File | Key | Description |
|---|---|---|
| `.env` | `VITE_SUPABASE_URL` | Supabase project URL |
| `.env` | `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `backend/.env` | `SUPABASE_URL` | Supabase project URL |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Service role key (rotate!) |
| `backend/.env` | `AI_SERVICE_URL` | `http://localhost:8001` |
| `backend/.env` | `PORT` | Express port (default 8000) |
