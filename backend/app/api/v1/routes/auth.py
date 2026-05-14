from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthUser, get_current_user
from app.schemas.auth import UserResponse
from app.services.auth_service import AuthService
from app.services.dependencies import get_auth_service

router = APIRouter()


def _supabase_only_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="This project uses Supabase Auth. Sign up and sign in from the mobile app with the Supabase client.",
    )


@router.post("/register")
async def register() -> None:
    raise _supabase_only_error()


@router.post("/login")
async def login() -> None:
    raise _supabase_only_error()


@router.post("/auth/google")
async def google_login() -> None:
    raise _supabase_only_error()


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: AuthUser = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    return await auth_service.get_user_profile(current_user)


@router.post("/change-password")
async def change_password() -> None:
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Password changes are handled by Supabase Auth on the client side.",
    )
