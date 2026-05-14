from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.ai_service import AIService
from app.services.auth_service import AuthService
from app.services.interview_app_service import InterviewAppService
from app.services.interview_engine import InterviewEngine

ai_service = AIService()
interview_engine = InterviewEngine(ai_service)


async def get_interview_service(
    db: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[InterviewAppService, None]:
    yield InterviewAppService(db=db, ai_service=ai_service, engine=interview_engine)


async def get_ai_service() -> AIService:
    return ai_service


async def get_auth_service(
    db: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[AuthService, None]:
    yield AuthService(db=db)
