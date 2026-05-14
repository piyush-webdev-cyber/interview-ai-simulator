from fastapi import APIRouter

from app.api.v1.routes import auth, catalog, feedback, health, interview, progress, resume, roles

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(catalog.router, tags=["catalog"])
api_router.include_router(roles.router, tags=["roles"])
api_router.include_router(interview.router, tags=["interviews"])
api_router.include_router(feedback.router, tags=["feedback"])
api_router.include_router(progress.router, tags=["progress"])
api_router.include_router(resume.router, tags=["resume"])
