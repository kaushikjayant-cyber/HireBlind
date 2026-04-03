from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import anonymise, score, sessions, resumes, compliance, reveal, audit
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="HireBlind API",
    description="EU AI Act Compliant Resume Screening Backend — Admin & Recruiter roles only.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(anonymise.router, prefix="/api")
app.include_router(score.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(compliance.router, prefix="/api")
app.include_router(reveal.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "HireBlind API",
        "version": "2.0.0",
        "roles": ["admin", "recruiter"],
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}
