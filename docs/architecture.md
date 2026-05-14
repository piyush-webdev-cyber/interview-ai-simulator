# Architecture

## MVP product flow

1. User logs in through the demo auth shell.
2. User selects role, difficulty, and interview mode.
3. Mobile calls `POST /start-interview` for MVP demos or `POST /api/v1/start-interview` for the production-shaped API.
4. Backend creates a session:

```json
{
  "role": "Frontend Developer",
  "difficulty": "Intermediate",
  "current_round": "Behavioral",
  "history": [],
  "scores": {},
  "state": "active"
}
```

5. User answers each round via text.
6. Backend evaluates the answer and advances to the next round.
7. After the Final round, backend generates a feedback report.
8. Mobile displays scores, strengths, weak topics, and an improvement roadmap.

## Backend modules

- Auth Service: `app/core/security.py` is the single FastAPI dependency for Supabase JWT validation.
- Interview Engine: `app/services/interview_engine.py` owns round progression and interview completion rules.
- AI Service: `app/services/ai_service.py` wraps Groq Chat Completions calls and deterministic local fallback.
- Evaluation Engine: `AIService.evaluate_answer` returns strict structured feedback for each answer.
- Progress Tracker: `InterviewAppService.get_progress` reads reports from PostgreSQL repositories.
- Persistence: `app/models/db.py` and `app/repositories/*` isolate database storage from route handlers.
- API Versioning: root endpoints are MVP-compatible; `/api/v1` is the production contract.

## Backend folder structure

```text
backend/
  alembic.ini
  migrations/
    env.py
    script.py.mako
    versions/
      0001_initial_schema.py
  app/
    api/
      routes.py
      v1/
        router.py
        routes/
          catalog.py
          feedback.py
          health.py
          interview.py
          progress.py
    core/
      config.py
      database.py
      exceptions.py
      security.py
    models/
      db.py
      session.py
    repositories/
      interviews.py
      users.py
    schemas/
      interview.py
    services/
      ai_service.py
      dependencies.py
      interview_app_service.py
      interview_engine.py
      prompt_templates.py
      websocket_manager.py
```

## PostgreSQL schema

- `user_profiles`: Supabase user profile mirror.
- `interview_sessions`: one interview simulation instance.
- `interview_answers`: one answer and round-level evaluation per question.
- `feedback_reports`: final report per completed interview.

## API contract

- `GET /api/v1/catalog`: roles, modes, difficulties, rounds.
- `POST /api/v1/start-interview`: creates a durable session for the authenticated user.
- `POST /api/v1/submit-answer`: evaluates answer, stores feedback, advances the round.
- `GET /api/v1/feedback/{session_id}`: returns final report after completion.
- `GET /api/v1/progress`: returns score trends, weak topics, and recent sessions.
- `WS /api/v1/ws/interview/{session_id}`: connection manager scaffold for real-time interview events.

## AI prompts

Prompt templates live in `backend/app/services/prompt_templates.py`.

- `QUESTION_PROMPT`: generates one realistic round-specific question.
- `EVALUATION_PROMPT`: returns strict JSON with score, strengths, weaknesses, and follow-up.
- `REPORT_PROMPT`: returns strict JSON with overall score, category breakdown, weak topics, and roadmap.

## Groq integration

The backend uses Groq's OpenAI-compatible endpoint through the Python `openai` client:

```text
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

## Production next steps

- Implement Supabase JWT validation in `get_current_user`.
- Persist prompt/response traces with redaction for observability.
- Move active WebSocket fan-out to Redis pub/sub when horizontally scaling.
- Add voice input with Whisper and TTS with ElevenLabs.
- Add coding round using mobile-friendly logic prompts before code execution.
