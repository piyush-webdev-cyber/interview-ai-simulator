from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.core.security import AuthUser, get_current_user
from app.schemas.auth import UserResponse
from app.schemas.interview import (
    FinalReport,
    InterviewCatalog,
    NextQuestionRequest,
    ProgressSummary,
    ResumeFileAnalysisRequest,
    ResumeAnalysisRequest,
    ResumeAnalysisResponse,
    RoleSuggestionsResponse,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.models.session import ROUND_ORDER
from app.services.auth_service import AuthService
from app.services.dependencies import get_auth_service, interview_engine

router = APIRouter()
engine = interview_engine


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/catalog", response_model=InterviewCatalog)
async def get_catalog() -> InterviewCatalog:
    return InterviewCatalog(
        roles=[],
        modes=["Practice Mode", "Mock Interview", "Rapid Fire Mode"],
        difficulties=["Beginner", "Intermediate", "Senior"],
        rounds=[round_name.value for round_name in ROUND_ORDER],
    )


@router.get("/suggest-roles", response_model=RoleSuggestionsResponse)
async def suggest_roles(query: str = Query(min_length=2, max_length=80)) -> RoleSuggestionsResponse:
    suggestions = await engine.ai_service.suggest_roles(query)
    return RoleSuggestionsResponse(suggestions=suggestions)


def _supabase_only_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="This project uses Supabase Auth. Sign up and sign in from the mobile app with the Supabase client.",
    )


@router.post("/register")
async def register() -> None:
    raise _supabase_only_error()


@router.post("/login")
async def login() -> None:
    raise _supabase_only_error()


@router.post("/auth/google")
async def google_login() -> None:
    raise _supabase_only_error()


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: AuthUser = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    return await auth_service.get_user_profile(current_user)


@router.post("/change-password")
async def change_password() -> None:
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Password changes are handled by Supabase Auth on the client side.",
    )


@router.post("/start-interview", response_model=StartInterviewResponse)
async def start_interview(
    payload: StartInterviewRequest,
    _user: AuthUser = Depends(get_current_user),
) -> StartInterviewResponse:
    session = await engine.start(payload)
    return StartInterviewResponse(session=session)


@router.post("/next-question")
async def next_question(
    payload: NextQuestionRequest,
    _user: AuthUser = Depends(get_current_user),
):
    return await engine.next_question(payload.session_id)


@router.post("/submit-answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    payload: SubmitAnswerRequest,
    _user: AuthUser = Depends(get_current_user),
) -> SubmitAnswerResponse:
    session, feedback, is_completed = await engine.submit_answer(payload.session_id, payload.answer, payload.voice_metrics)
    return SubmitAnswerResponse(session=session, feedback=feedback, is_completed=is_completed)


@router.get("/feedback/{session_id}", response_model=FinalReport)
async def get_feedback(
    session_id: str,
    _user: AuthUser = Depends(get_current_user),
) -> FinalReport:
    return await engine.feedback(session_id)


@router.get("/progress", response_model=ProgressSummary)
async def get_progress(
    _user: AuthUser = Depends(get_current_user),
) -> ProgressSummary:
    return engine.progress()


@router.post("/analyze-resume", response_model=ResumeAnalysisResponse)
async def analyze_resume(
    payload: ResumeAnalysisRequest,
    _user: AuthUser = Depends(get_current_user),
) -> ResumeAnalysisResponse:
    return await engine.ai_service.analyze_resume(payload.target_role, payload.resume_text)


@router.post("/analyze-resume-file", response_model=ResumeAnalysisResponse)
async def analyze_resume_file(
    payload: ResumeFileAnalysisRequest,
    _user: AuthUser = Depends(get_current_user),
) -> ResumeAnalysisResponse:
    return await engine.ai_service.analyze_resume_file(
        payload.target_role,
        payload.file_name,
        payload.file_base64,
        payload.file_mime_type,
    )


@router.websocket("/ws/interview/{session_id}")
async def interview_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    try:
      session = await engine.next_question(session_id)
      await websocket.send_json({"type": "session", "payload": session.model_dump(mode="json")})
      while True:
          message = await websocket.receive_json()
          if message.get("type") != "answer":
              await websocket.send_json({"type": "error", "payload": "Unsupported message type"})
              continue
          session, feedback, is_completed = await engine.submit_answer(session_id, str(message.get("answer", "")))
          await websocket.send_json(
              {
                  "type": "evaluation",
                  "payload": {
                      "session": session.model_dump(mode="json"),
                      "feedback": feedback.model_dump(mode="json"),
                      "is_completed": is_completed,
                  },
              }
          )
    except WebSocketDisconnect:
        return
