from fastapi import APIRouter, Depends, Query

from app.core.security import AuthUser, get_current_user
from app.schemas.interview import RoleSuggestionsResponse
from app.services.ai_service import AIService
from app.services.dependencies import get_ai_service

router = APIRouter()


@router.get("/suggest-roles", response_model=RoleSuggestionsResponse)
async def suggest_roles(
    query: str = Query(min_length=2, max_length=80),
    _: AuthUser = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service),
) -> RoleSuggestionsResponse:
    suggestions = await ai_service.suggest_roles(query)
    return RoleSuggestionsResponse(suggestions=suggestions)
