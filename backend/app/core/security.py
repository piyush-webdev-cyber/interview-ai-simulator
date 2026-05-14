from dataclasses import dataclass
from time import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.supabase import create_supabase_admin_client


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None = None
    name: str | None = None
    provider: str | None = None
    profile_picture: str | None = None


bearer_scheme = HTTPBearer(auto_error=False)


def _extract_provider(user_data: dict[str, Any]) -> str | None:
    app_metadata = user_data.get("app_metadata") or {}
    raw_provider = app_metadata.get("provider")
    if raw_provider == "email":
        return "local"
    return raw_provider


def _extract_name(user_data: dict[str, Any]) -> str | None:
    user_metadata = user_data.get("user_metadata") or {}
    return user_metadata.get("name") or user_metadata.get("full_name") or user_data.get("email")


def _extract_picture(user_data: dict[str, Any]) -> str | None:
    user_metadata = user_data.get("user_metadata") or {}
    return user_metadata.get("avatar_url") or user_metadata.get("picture")


def _claims_to_dict(claims: Any) -> dict[str, Any]:
    if claims is None:
        return {}
    if hasattr(claims, "model_dump"):
        return claims.model_dump()
    if isinstance(claims, dict):
        return claims
    try:
        return dict(claims)
    except Exception:  # noqa: BLE001
        return {}


def _user_from_development_jwt(token: str) -> AuthUser | None:
    if settings.app_env.casefold() not in {"development", "dev", "local"}:
        return None

    try:
        claims = jwt.get_unverified_claims(token)
    except JWTError:
        return None

    subject = claims.get("sub")
    if not subject:
        return None

    expires_at = claims.get("exp")
    if isinstance(expires_at, (int, float)) and expires_at < time():
        return None

    issuer = str(claims.get("iss") or "")
    if settings.supabase_url and not issuer.startswith(settings.supabase_url):
        return None

    user_metadata = claims.get("user_metadata") or {}
    app_metadata = claims.get("app_metadata") or {}
    return AuthUser(
        id=str(subject),
        email=claims.get("email"),
        name=user_metadata.get("name") or user_metadata.get("full_name") or claims.get("email"),
        provider=app_metadata.get("provider"),
        profile_picture=user_metadata.get("avatar_url") or user_metadata.get("picture"),
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    supabase = await create_supabase_admin_client()
    token = credentials.credentials

    try:
        claims_response = await supabase.auth.get_claims(token)
        claims = _claims_to_dict(getattr(claims_response, "claims", None))
        if claims.get("sub"):
            return AuthUser(
                id=str(claims["sub"]),
                email=claims.get("email"),
                name=claims.get("email"),
                provider="local",
            )
    except Exception:
        pass

    try:
        response = await supabase.auth.get_user(token)
    except Exception as exc:  # noqa: BLE001
        dev_user = _user_from_development_jwt(token)
        if dev_user:
            return dev_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired bearer token",
        ) from exc

    user = getattr(response, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired bearer token",
        )

    user_data = user.model_dump() if hasattr(user, "model_dump") else dict(user)

    return AuthUser(
        id=str(user_data["id"]),
        email=user_data.get("email"),
        name=_extract_name(user_data),
        provider=_extract_provider(user_data),
        profile_picture=_extract_picture(user_data),
    )
