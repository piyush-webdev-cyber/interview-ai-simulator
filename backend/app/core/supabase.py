from fastapi import HTTPException, status
from supabase import AsyncClient, acreate_client

from app.core.config import settings


async def create_supabase_admin_client() -> AsyncClient:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not configured on the backend",
        )
    return await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
