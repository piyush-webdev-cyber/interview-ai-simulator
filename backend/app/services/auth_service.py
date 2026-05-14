from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser
from app.repositories.users import UserRepository
from app.schemas.auth import UserResponse


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)

    async def get_user_profile(self, user: AuthUser) -> UserResponse:
        profile = await self.users.ensure_user(user)
        await self.db.commit()
        return UserResponse(
            id=profile.id,
            name=profile.name,
            email=profile.email,
            provider=profile.provider,
            profile_picture=profile.profile_picture,
            created_at=profile.created_at.isoformat() if profile.created_at else None,
        )
