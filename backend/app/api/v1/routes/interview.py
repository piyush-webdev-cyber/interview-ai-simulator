from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.core.security import AuthUser, get_current_user
from app.schemas.interview import (
    NextQuestionRequest,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.services.dependencies import get_interview_service
from app.services.interview_app_service import InterviewAppService
from app.services.websocket_manager import websocket_manager

router = APIRouter()


@router.post("/start-interview", response_model=StartInterviewResponse)
async def start_interview(
    payload: StartInterviewRequest,
    user: AuthUser = Depends(get_current_user),
    service: InterviewAppService = Depends(get_interview_service),
) -> StartInterviewResponse:
    session = await service.start_interview(user, payload)
    return StartInterviewResponse(session=session)


@router.post("/next-question")
async def next_question(
    payload: NextQuestionRequest,
    user: AuthUser = Depends(get_current_user),
    service: InterviewAppService = Depends(get_interview_service),
):
    return await service.get_session(user, payload.session_id)


@router.post("/submit-answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    payload: SubmitAnswerRequest,
    user: AuthUser = Depends(get_current_user),
    service: InterviewAppService = Depends(get_interview_service),
) -> SubmitAnswerResponse:
    session, feedback, is_completed = await service.submit_answer(user, payload.session_id, payload.answer, payload.voice_metrics)
    return SubmitAnswerResponse(session=session, feedback=feedback, is_completed=is_completed)


@router.websocket("/ws/interview/{session_id}")
async def interview_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket_manager.connect(session_id, websocket)
    try:
        await websocket_manager.broadcast(session_id, {"type": "connected", "payload": {"session_id": session_id}})
        while True:
            message = await websocket.receive_json()
            await websocket_manager.broadcast(session_id, {"type": "client_message", "payload": message})
    except WebSocketDisconnect:
        websocket_manager.disconnect(session_id, websocket)
