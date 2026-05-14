from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser
from app.models.db import UserProfile


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: str) -> UserProfile | None:
        return await self.session.get(UserProfile, user_id)

    async def get_by_email(self, email: str) -> UserProfile | None:
        statement = select(UserProfile).where(UserProfile.email == email.lower())
        return await self.session.scalar(statement)

    async def ensure_user(self, auth_user: AuthUser) -> UserProfile:
        profile = await self.get_by_id(auth_user.id)
        if profile:
            profile.email = (auth_user.email or profile.email).lower()
            profile.name = auth_user.name or profile.name
            profile.provider = auth_user.provider or profile.provider
            profile.profile_picture = auth_user.profile_picture or profile.profile_picture
            profile.last_login = datetime.now(timezone.utc)
            await self.session.flush()
            return profile

        profile = UserProfile(
            id=auth_user.id,
            name=auth_user.name or "Interview AI User",
            email=(auth_user.email or f"{auth_user.id}@supabase.local").lower(),
            provider=auth_user.provider or "local",
            profile_picture=auth_user.profile_picture,
            last_login=datetime.now(timezone.utc),
        )
        self.session.add(profile)
        await self.session.flush()
        return profile
