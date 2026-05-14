from fastapi import APIRouter

from app.models.session import ROUND_ORDER
from app.schemas.interview import InterviewCatalog

router = APIRouter()


@router.get("/catalog", response_model=InterviewCatalog)
async def get_catalog() -> InterviewCatalog:
    return InterviewCatalog(
        roles=[],
        modes=["Practice Mode", "Mock Interview", "Rapid Fire Mode"],
        difficulties=["Beginner", "Intermediate", "Senior"],
        rounds=[round_name.value for round_name in ROUND_ORDER],
    )
