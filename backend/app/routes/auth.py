from __future__ import annotations

from datetime import timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.config import settings
from ..core.security import create_access_token, hash_password, verify_password
from ..dependencies import get_current_user, get_storage
from ..schemas import (
    AuthProviderConfig,
    AuthProvidersResponse,
    AuthResponse,
    SocialAuthRequest,
    UserCreate,
    UserLogin,
    UserPublic,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
FACEBOOK_GRAPH_BASE_URL = "https://graph.facebook.com"


def _public_user(user: dict[str, Any]) -> UserPublic:
    return UserPublic(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user.get("role", "customer"),
        avatar_url=user.get("avatar_url"),
    )


def _issue_auth_response(user: dict[str, Any]) -> AuthResponse:
    token = create_access_token(
        {"sub": user["id"], "email": user["email"], "name": user["name"]},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return AuthResponse(access_token=token, user=_public_user(user))


def _provider_config() -> AuthProvidersResponse:
    google_enabled = bool(settings.google_client_id)
    facebook_enabled = bool(settings.facebook_app_id and settings.facebook_app_secret)
    return AuthProvidersResponse(
        google=AuthProviderConfig(
            enabled=google_enabled,
            client_id=settings.google_client_id if google_enabled else None,
        ),
        facebook=AuthProviderConfig(
            enabled=facebook_enabled,
            app_id=settings.facebook_app_id if facebook_enabled else None,
            sdk_version=settings.facebook_graph_version if facebook_enabled else None,
        ),
    )


def _normalize_display_name(name: str | None, email: str) -> str:
    cleaned = (name or "").strip()
    if cleaned:
        return cleaned

    local_part = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
    return local_part.title() or "Cookit User"


def _build_social_account(provider_user_id: str, email: str, name: str, avatar_url: str | None) -> dict[str, Any]:
    return {
        "id": provider_user_id,
        "email": email,
        "name": name,
        "avatar_url": avatar_url,
    }


async def _verify_google_token(token: str) -> dict[str, Any]:
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": token})

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google sign-in token")

    payload = response.json()
    if payload.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in token audience mismatch")

    issuer = payload.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token issuer")

    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account did not provide an email address")

    email_verified = str(payload.get("email_verified") or "").lower()
    if email_verified not in {"true", "1"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is not verified")

    provider_user_id = str(payload.get("sub") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in token is missing a user identifier")

    return {
        "provider_user_id": provider_user_id,
        "email": email,
        "name": _normalize_display_name(payload.get("name"), email),
        "avatar_url": str(payload.get("picture") or "").strip() or None,
    }


async def _verify_facebook_token(token: str) -> dict[str, Any]:
    if not settings.facebook_app_id or not settings.facebook_app_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Facebook sign-in is not configured")

    graph_version = settings.facebook_graph_version
    app_access_token = f"{settings.facebook_app_id}|{settings.facebook_app_secret}"

    async with httpx.AsyncClient(timeout=15) as client:
        debug_response = await client.get(
            f"{FACEBOOK_GRAPH_BASE_URL}/{graph_version}/debug_token",
            params={"input_token": token, "access_token": app_access_token},
        )
        profile_response = await client.get(
            f"{FACEBOOK_GRAPH_BASE_URL}/{graph_version}/me",
            params={"fields": "id,name,email,picture.type(large)", "access_token": token},
        )

    if debug_response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Facebook sign-in token")

    debug_payload = debug_response.json().get("data", {})
    if not debug_payload.get("is_valid"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Facebook sign-in token is not valid")
    if str(debug_payload.get("app_id") or "") != str(settings.facebook_app_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Facebook sign-in token app mismatch")

    if profile_response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to read Facebook profile")

    profile_payload = profile_response.json()
    email = str(profile_payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Facebook account did not provide an email address. Enable email permission for the app.",
        )

    picture = profile_payload.get("picture", {})
    picture_data = picture.get("data", {}) if isinstance(picture, dict) else {}
    avatar_url = str(picture_data.get("url") or "").strip() or None
    provider_user_id = str(profile_payload.get("id") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Facebook profile is missing a user identifier")

    if provider_user_id and str(debug_payload.get("user_id") or "") not in {"", provider_user_id}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Facebook account mismatch")

    return {
        "provider_user_id": provider_user_id,
        "email": email,
        "name": _normalize_display_name(profile_payload.get("name"), email),
        "avatar_url": avatar_url,
    }


async def _upsert_social_user(provider: str, social_profile: dict[str, Any], storage: Any) -> dict[str, Any]:
    provider_user_id = social_profile["provider_user_id"]
    email = social_profile["email"]
    name = social_profile["name"]
    avatar_url = social_profile.get("avatar_url")
    social_account = _build_social_account(provider_user_id, email, name, avatar_url)

    user = await storage.find_user_by_provider(provider, provider_user_id)
    if user:
        social_accounts = dict(user.get("social_accounts") or {})
        social_accounts[provider] = social_account
        updates: dict[str, Any] = {"social_accounts": social_accounts}
        if avatar_url and user.get("avatar_url") != avatar_url:
            updates["avatar_url"] = avatar_url
        if not user.get("name") and name:
            updates["name"] = name
        updated_user = await storage.update_user(user["id"], updates)
        return updated_user or user

    user = await storage.find_user_by_email(email)
    if user:
        social_accounts = dict(user.get("social_accounts") or {})
        linked_provider = social_accounts.get(provider, {})
        if linked_provider and linked_provider.get("id") not in {"", provider_user_id}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"This {provider.title()} account is linked elsewhere")

        social_accounts[provider] = social_account
        updates = {"social_accounts": social_accounts}
        if avatar_url and not user.get("avatar_url"):
            updates["avatar_url"] = avatar_url
        updated_user = await storage.update_user(user["id"], updates)
        return updated_user or user

    return await storage.create_user(
        {
            "name": name,
            "email": email,
            "role": "customer",
            "avatar_url": avatar_url,
            "social_accounts": {provider: social_account},
        }
    )


@router.get("/providers", response_model=AuthProvidersResponse)
async def auth_providers():
    return _provider_config()


@router.post("/register", response_model=AuthResponse)
async def register(payload: UserCreate, storage=Depends(get_storage)):
    existing = await storage.find_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user_doc = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "role": "customer",
        "social_accounts": {},
    }
    user = await storage.create_user(user_doc)
    return _issue_auth_response(user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin, storage=Depends(get_storage)):
    user = await storage.find_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    password_hash = user.get("password_hash")
    if not password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses social sign-in. Continue with Google or Facebook.",
        )

    if not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return _issue_auth_response(user)


@router.post("/social/google", response_model=AuthResponse)
async def social_google(payload: SocialAuthRequest, storage=Depends(get_storage)):
    social_profile = await _verify_google_token(payload.token)
    user = await _upsert_social_user("google", social_profile, storage)
    return _issue_auth_response(user)


@router.post("/social/facebook", response_model=AuthResponse)
async def social_facebook(payload: SocialAuthRequest, storage=Depends(get_storage)):
    social_profile = await _verify_facebook_token(payload.token)
    user = await _upsert_social_user("facebook", social_profile, storage)
    return _issue_auth_response(user)


@router.get("/me", response_model=UserPublic)
async def me(current_user=Depends(get_current_user)):
    return _public_user(current_user)
