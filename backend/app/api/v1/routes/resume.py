from fastapi import APIRouter

from app.schemas.interview import ResumeAnalysisRequest, ResumeAnalysisResponse, ResumeFileAnalysisRequest
from app.services.dependencies import interview_engine

router = APIRouter()


@router.post("/analyze-resume", response_model=ResumeAnalysisResponse)
async def analyze_resume(payload: ResumeAnalysisRequest) -> ResumeAnalysisResponse:
    return await interview_engine.ai_service.analyze_resume(payload.target_role, payload.resume_text)


@router.post("/analyze-resume-file", response_model=ResumeAnalysisResponse)
async def analyze_resume_file(payload: ResumeFileAnalysisRequest) -> ResumeAnalysisResponse:
    return await interview_engine.ai_service.analyze_resume_file(
        payload.target_role,
        payload.file_name,
        payload.file_base64,
        payload.file_mime_type,
    )
