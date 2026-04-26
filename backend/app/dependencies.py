from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status
from jose import ExpiredSignatureError, JWTError

from .core.security import decode_token


async def get_storage(request: Request):
    return request.app.state.storage


async def get_current_user(
    storage=Depends(get_storage),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token expired") from exc
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = await storage.find_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_optional_current_user(
    storage=Depends(get_storage),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except ExpiredSignatureError:
        return None
    except JWTError:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    return await storage.find_user_by_id(user_id)
