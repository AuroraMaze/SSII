from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_optional_current_user, get_storage
from ..sample_data import SAMPLE_RECIPES
from ..schemas import RecommendationRequest, RecommendationResponse
from ..services.gemini import GeminiServiceError, generate_gemini_recipes
from ..services.recommendation import normalize_terms, rank_recipes


router = APIRouter(prefix="/api", tags=["recommendations"])


@router.post("/recommendations", response_model=RecommendationResponse)
async def recommend(payload: RecommendationRequest, storage=Depends(get_storage), current_user=Depends(get_optional_current_user)):
    ingredients = normalize_terms(payload.ingredients)
    recipes = await storage.list_recipes()
    if not recipes:
        recipes = SAMPLE_RECIPES

    results = rank_recipes(
        recipes=recipes,
        ingredients=ingredients,
        taste_preferences=normalize_terms(payload.taste_preferences),
        max_time_minutes=payload.max_time_minutes,
        diet_goal=payload.diet_goal,
        nutrition_goal=payload.nutrition_goal,
    )

    if current_user:
        await storage.add_history(current_user["id"], payload.model_dump(), [item["id"] for item in results])

    return RecommendationResponse(query=payload, results=results)


@router.options("/recommendations/gemini")
async def recommend_gemini_options():
    return {}

@router.get("/recommendations/gemini")
async def recommend_gemini_wrong_method():
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Use POST /api/recommendations/gemini with JSON payload",
    )

@router.post("/recommendations/gemini", response_model=RecommendationResponse)
async def recommend_gemini(payload: RecommendationRequest, storage=Depends(get_storage), current_user=Depends(get_optional_current_user)):
    """Generate recipe suggestions using Gemini Structured Output API."""
    try:
        gemini_results = await generate_gemini_recipes(payload.ingredients, max_results=6)
    except Exception as exc:
        # fallback to local matching when Gemini is unavailable (GeminiServiceError or others)
        local_recipes = await storage.list_recipes()
        if not local_recipes:
            local_recipes = SAMPLE_RECIPES

        local_results = rank_recipes(
            recipes=local_recipes,
            ingredients=normalize_terms(payload.ingredients),
            taste_preferences=normalize_terms(payload.taste_preferences),
            max_time_minutes=payload.max_time_minutes,
            diet_goal=payload.diet_goal,
            nutrition_goal=payload.nutrition_goal,
        )

        if current_user:
            await storage.add_history(current_user["id"], payload.model_dump(), [item["id"] for item in local_results])

        return RecommendationResponse(query=payload, results=local_results)

    # Save history for user path
    if current_user:
        await storage.add_history(current_user["id"], payload.model_dump(), [item["id"] for item in gemini_results])

    return RecommendationResponse(query=payload, results=gemini_results)


@router.get("/recipes")
async def list_recipes(storage=Depends(get_storage)):
    return await storage.list_recipes()


@router.get("/recipes/{recipe_id}")
async def recipe_detail(recipe_id: str, storage=Depends(get_storage)):
    recipe = await storage.get_recipe_by_id(recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe
