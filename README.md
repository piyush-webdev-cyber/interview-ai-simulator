# Interview AI Simulator

Production-oriented MVP for a cross-platform mobile interview simulation app.

## What is included

- React Native Expo mobile app in `mobile/`
- Separate React Native Expo frontend in `frontend/`
- FastAPI backend in `backend/`
- Dynamic interview engine for 3 MVP roles: Frontend Developer, Product Manager, Sales Executive
- 3 MVP rounds: Behavioral, Domain, Final
- Groq AI service for question generation, answer evaluation, follow-ups, and final reports
- Deterministic AI fallback so the app runs before OpenAI credentials are configured
- REST API plus a starter WebSocket endpoint for real-time interview flow
- Versioned `/api/v1` backend architecture with PostgreSQL repositories
- Alembic migration scaffold and initial schema
- Progress tracking through persisted reports in the versioned API

## Folder structure

```text
interview-ai-simulator/
  backend/
    migrations/        # Alembic migration environment and initial schema
    app/
      api/              # REST and WebSocket routes
      core/             # settings and app configuration
      models/           # supported roles, rounds, enums
      repositories/     # PostgreSQL persistence boundaries
      schemas/          # Pydantic request/response contracts
      services/         # AI service, prompt templates, interview engine
  frontend/
    src/
      api/              # /api/v1 backend API client
      components/       # reusable mobile UI primitives
      navigation/       # stack and tab navigation
      screens/          # splash, auth, dashboard, role, interview, feedback, progress
      store/            # Zustand interview state
      types/            # TypeScript API contracts
  mobile/
    src/
      api/              # backend API client
      components/       # reusable mobile UI
      constants/        # MVP roles, modes, difficulty levels
      navigation/       # stack and tab navigation
      screens/          # splash, auth, dashboard, role, interview, feedback, progress
      store/            # Zustand app state
      types/            # shared TypeScript API types
  docs/
    architecture.md
```

## Run backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

## Run mobile

```bash
cd mobile
npm install
copy .env.example .env
npm run start
```

## Run separate frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run start
```

For Android emulator access to a local backend, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`.

## API routes

- `POST /start-interview`
- `POST /next-question`
- `POST /submit-answer`
- `GET /feedback/{session_id}`
- `GET /progress`
- `WS /ws/interview/{session_id}`

Production-shaped routes are also available under `/api/v1`, including `GET /api/v1/catalog`.
