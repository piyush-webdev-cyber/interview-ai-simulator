from fastapi import APIRouter, Depends

from app.core.security import AuthUser, get_current_user
from app.schemas.interview import ProgressSummary
from app.services.dependencies import get_interview_service
from app.services.interview_app_service import InterviewAppService

router = APIRouter()


@router.get("/progress", response_model=ProgressSummary)
async def get_progress(
    user: AuthUser = Depends(get_current_user),
    service: InterviewAppService = Depends(get_interview_service),
) -> ProgressSummary:
    return await service.get_progress(user)

