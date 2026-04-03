# HireBlind 🧿

**Bias-Free Resume Screening Tool — EU AI Act Compliant**

> Hire for Skills. Not Stories.

---

## ⚡ Quick Start

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `supabase_schema.sql`
3. Go to **Storage** → create a bucket called `resumes` (private)
4. Copy your **Project URL**, **anon key**, and **service_role key**

### 2. Environment Variables

**Frontend** — edit `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Backend** — edit `backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Install & Run Frontend

```bash
cd d:\HireBlind
npm install
npm run dev
# → http://localhost:5173
```

### 4. Setup & Run Backend

```bash
cd d:\HireBlind\backend

# Create virtual env
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Start server
uvicorn main:app --reload --port 8000
# → http://localhost:8000/docs
```

---

## 📚 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + JavaScript |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| State | Zustand |
| Routing | React Router v6 |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage |
| Backend | FastAPI (Python) |
| PDF Parsing | pdfplumber |
| DOCX Parsing | python-docx |
| PII Stripping | spaCy NER + regex |
| Scoring | TF-IDF + Cosine Similarity |

---

## 🏗️ Project Structure

```
HireBlind/
├── src/                     # React frontend
│   ├── components/
│   │   ├── layout/          # Sidebar, AppShell
│   │   └── ui/              # Modal, ProgressBar, LoadingSpinner
│   ├── pages/
│   │   ├── auth/            # Login, Register
│   │   ├── session/         # Upload, Results, Compliance, Interviews
│   │   └── admin/           # Settings
│   ├── store/               # Zustand stores (auth, session)
│   ├── lib/                 # Supabase client
│   └── router/              # React Router setup
├── backend/                 # FastAPI backend
│   ├── routers/             # anonymise, score, sessions, resumes, compliance
│   ├── services/            # pii_stripper, scorer, parser
│   └── main.py
├── supabase_schema.sql      # Run once in Supabase SQL Editor
└── .env                     # Frontend env vars
```

---

## 🚫 Hard Constraints (EU AI Act)

- No real candidate name ever shown in ranking
- All AI decisions are reversible by humans
- No PII stored in plain text
- Every ranking + override logged with timestamp
- Explainability tags shown for each rank

---

## 🏛️ EU AI Act Compliance

- **High-Risk Classification**: Annex III (Employment & Workers)
- **Article 14**: Human oversight enforced — no automated decisions
- **Article 13**: Transparency via explainability tags
- **Audit trail**: PII log, override log, session log
- **Export**: Compliance report downloadable as JSON
