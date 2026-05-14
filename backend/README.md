# Interview AI Simulator Backend

FastAPI backend for the text-based MVP interview engine, shaped for production growth.

## Run locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

The MVP works without `GROQ_API_KEY` by using deterministic fallback questions and feedback. Add a Groq key to enable AI-powered question generation, evaluation, follow-ups, and reports.

## Architecture

```text
app/
  api/
    routes.py              # backwards-compatible root MVP routes
    v1/
      router.py            # versioned API entrypoint
      routes/              # catalog, interviews, feedback, progress, health
  core/
    config.py              # environment settings
    database.py            # async SQLAlchemy engine/session
    security.py            # Supabase auth boundary
    exceptions.py          # API exception helpers
  models/
    session.py             # interview domain constants/enums
    db.py                  # SQLAlchemy persistence models
  repositories/
    users.py               # user profile persistence
    interviews.py          # sessions, answers, reports persistence
  schemas/
    interview.py           # Pydantic API contracts
  services/
    ai_service.py          # Groq integration and fallback
    interview_engine.py    # round progression and core interview rules
    interview_app_service.py
    dependencies.py        # service singletons and FastAPI dependency wiring
    prompt_templates.py    # question/evaluation/report prompts
    websocket_manager.py   # real-time connection registry
```

## API routes

Root MVP-compatible routes:

- `POST /start-interview`
- `POST /next-question`
- `POST /submit-answer`
- `GET /feedback/{session_id}`
- `GET /progress`
- `GET /health`
- `WS /ws/interview/{session_id}`

Versioned production routes:

- `GET /api/v1/catalog`
- `POST /api/v1/start-interview`
- `POST /api/v1/next-question`
- `POST /api/v1/submit-answer`
- `GET /api/v1/feedback/{session_id}`
- `GET /api/v1/progress`
- `GET /api/v1/health`
- `WS /api/v1/ws/interview/{session_id}`

## Database

SQLAlchemy models live in `app/models/db.py`. Alembic migrations live in `migrations/`.

```bash
alembic upgrade head
```

The root routes remain in-memory friendly for quick MVP demos. The `/api/v1` routes use the application service and repository architecture for durable PostgreSQL-backed sessions.

## Auth

`app/core/security.py` is the single auth boundary. In development, auth defaults to a `demo-user`. In production, set `REQUIRE_AUTH=true` and wire Supabase JWT validation in `get_current_user`.

## Groq

The backend uses Groq through its OpenAI-compatible API endpoint:

```text
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

The Python `openai` client remains in `requirements.txt` because Groq supports the same Chat Completions API shape through a Groq base URL.
