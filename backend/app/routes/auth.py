from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from ..core.config import settings
from ..core.security import create_access_token, hash_password, verify_password
from ..dependencies import get_current_user, get_storage
from ..schemas import AuthResponse, UserCreate, UserLogin, UserPublic


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public_user(user: dict) -> UserPublic:
    return UserPublic(id=user["id"], name=user["name"], email=user["email"], role=user.get("role", "customer"))


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
    }
    user = await storage.create_user(user_doc)
    token = create_access_token(
        {"sub": user["id"], "email": user["email"], "name": user["name"]},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return AuthResponse(access_token=token, user=_public_user(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin, storage=Depends(get_storage)):
    user = await storage.find_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(
        {"sub": user["id"], "email": user["email"], "name": user["name"]},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return AuthResponse(access_token=token, user=_public_user(user))


@router.get("/me", response_model=UserPublic)
async def me(current_user=Depends(get_current_user)):
    return _public_user(current_user)
