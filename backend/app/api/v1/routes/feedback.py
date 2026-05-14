from fastapi import APIRouter, Depends

from app.core.security import AuthUser, get_current_user
from app.schemas.interview import FinalReport
from app.services.dependencies import get_interview_service
from app.services.interview_app_service import InterviewAppService

router = APIRouter()


@router.get("/feedback/{session_id}", response_model=FinalReport)
async def get_feedback(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    service: InterviewAppService = Depends(get_interview_service),
) -> FinalReport:
    return await service.get_feedback(user, session_id)

