from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    provider: str
    profile_picture: str | None = None
    created_at: str | None = None
