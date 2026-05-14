from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import Base, engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    except Exception as exc:  # pragma: no cover - local environment fallback
        logger.warning("Database startup sync skipped: %s", exc)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(api_router)
    return app


app = create_app()
