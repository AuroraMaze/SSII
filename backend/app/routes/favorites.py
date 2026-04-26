from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_current_user, get_storage
from ..schemas import FavoriteCreate
from ..services.edamam import EdamamServiceError, get_recipe_by_id


router = APIRouter(prefix="/api/favorites", tags=["favorites"])


@router.get("")
async def list_favorites(current_user=Depends(get_current_user), storage=Depends(get_storage)):
    favorites = await storage.list_favorites(current_user["id"])
    refreshed_favorites = []

    for favorite in favorites:
        recipe_id = favorite.get("recipe_id")
        if not recipe_id:
            refreshed_favorites.append(favorite)
            continue

        try:
            latest_recipe = await get_recipe_by_id(recipe_id)
        except EdamamServiceError:
            latest_recipe = None

        if latest_recipe:
            refreshed_favorites.append({**favorite, "recipe": latest_recipe})
        else:
            refreshed_favorites.append(favorite)

    return refreshed_favorites


@router.post("")
async def add_favorite(payload: FavoriteCreate, current_user=Depends(get_current_user), storage=Depends(get_storage)):
    try:
        recipe = await get_recipe_by_id(payload.recipe_id)
    except EdamamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    favorite = await storage.add_favorite(current_user["id"], recipe)
    return {"message": "Recipe saved", "favorite": favorite}


@router.delete("/{recipe_id}")
async def delete_favorite(recipe_id: str, current_user=Depends(get_current_user), storage=Depends(get_storage)):
    removed = await storage.remove_favorite(current_user["id"], recipe_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
    return {"message": "Recipe removed from favorites"}


@router.get("/history")
async def list_history(current_user=Depends(get_current_user), storage=Depends(get_storage)):
    return await storage.list_history(current_user["id"])
