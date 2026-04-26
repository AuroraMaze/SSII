from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..dependencies import get_optional_current_user, get_storage
from ..schemas import RecommendationRequest, RecommendationResponse
from ..services.edamam import (
    EdamamServiceError,
    browse_diverse_recipes,
    get_recipe_by_id,
    list_recipes as list_edamam_recipes,
    search_recipes_by_diet,
    search_recipes_by_ingredients,
)
from ..services.recommendation import normalize_terms, rank_recipes


router = APIRouter(prefix="/api", tags=["recommendations"])


@router.post("/recommendations", response_model=RecommendationResponse)
async def recommend(payload: RecommendationRequest, storage=Depends(get_storage), current_user=Depends(get_optional_current_user)):
    ingredients = normalize_terms(payload.ingredients)

    try:
        recipes = await search_recipes_by_ingredients(ingredients, max_results=payload.max_results)
    except EdamamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not recipes:
        return RecommendationResponse(query=payload, results=[])

    results = rank_recipes(
        recipes=recipes,
        ingredients=ingredients,
        taste_preferences=normalize_terms(payload.taste_preferences),
        max_time_minutes=payload.max_time_minutes,
        diet_goal=payload.diet_goal,
        nutrition_goal=payload.nutrition_goal,
        limit=payload.max_results,
    )

    if current_user:
        try:
            await storage.add_history(current_user["id"], payload.model_dump(), [item["id"] for item in results])
        except Exception:
            pass

    return RecommendationResponse(query=payload, results=results)


@router.get("/recipes")
async def list_recipes():
    try:
        return await list_edamam_recipes()
    except EdamamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/recipes/browse")
async def browse_recipes(
    category: str | None = Query(None, description="Filter by meal category"),
    diet: str | None = Query(None, description="Filter by diet (vegan, vegetarian, gluten-free, etc.)"),
    limit: int = Query(12, ge=1, le=50, description="Maximum results to return"),
):
    """Browse diverse recipes with optional filters."""
    diet_labels = []
    if diet:
        diet_labels = [d.strip() for d in diet.split(",") if d.strip()]
    
    try:
        if diet_labels:
            recipes = await search_recipes_by_diet(diet_labels, max_results=limit)
        else:
            recipes = await browse_diverse_recipes(category=category, max_results=limit)
        return recipes
    except EdamamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/recipes/{recipe_id}")
async def recipe_detail(recipe_id: str):
    try:
        recipe = await get_recipe_by_id(recipe_id)
    except EdamamServiceError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe
