from __future__ import annotations

import base64
from typing import Any

import httpx

from .recommendation import normalize_terms
from ..core.config import settings


class EdamamServiceError(Exception):
    pass


def _decode_legacy_recipe_id(recipe_id: str) -> str:
    padding = "=" * (-len(recipe_id) % 4)
    try:
        return base64.urlsafe_b64decode(f"{recipe_id}{padding}").decode("utf-8")
    except Exception as exc:
        raise EdamamServiceError("Invalid recipe id") from exc


def _sanitize_text(value: str | None) -> str:
    return (value or "").strip()


def _normalize_label(value: str) -> str:
    return _sanitize_text(value).lower().replace(" ", "-")


def _extract_recipe_key(value: str) -> str:
    cleaned = _sanitize_text(value)
    if not cleaned:
        raise EdamamServiceError("Edamam recipe payload is missing recipe identifier")

    if "#recipe_" in cleaned:
        return cleaned.rsplit("#recipe_", 1)[1]
    if "/api/recipes/v2/" in cleaned:
        return cleaned.rsplit("/api/recipes/v2/", 1)[1].split("?", 1)[0]
    return cleaned


def _normalize_recipe_id(recipe_id: str) -> str:
    cleaned = _sanitize_text(recipe_id)
    if not cleaned:
        raise EdamamServiceError("Invalid recipe id")

    # Backward compatibility for older base64 ids that encoded uri/self href.
    if cleaned.startswith("aHR0"):
        decoded = _decode_legacy_recipe_id(cleaned)
        return _extract_recipe_key(decoded)

    return _extract_recipe_key(cleaned)


def _derive_category(recipe: dict[str, Any]) -> str:
    meal_types = [_normalize_label(item) for item in recipe.get("mealType", [])]
    dish_types = [_normalize_label(item) for item in recipe.get("dishType", [])]

    if "breakfast" in meal_types:
        return "breakfast"
    if "lunch/dinner" in meal_types or "main-course" in dish_types:
        return "dinner"
    if "desserts" in dish_types or "dessert" in dish_types or "sweets" in dish_types:
        return "dessert"
    if "snack" in meal_types or "teatime" in meal_types:
        return "quick"
    return "dinner"


def _extract_ingredients(recipe: dict[str, Any]) -> list[str]:
    ingredients = []
    for item in recipe.get("ingredients", []):
        food = _sanitize_text(item.get("food"))
        if food:
            ingredients.append(food.lower())
    if ingredients:
        return ingredients
    return [_sanitize_text(item).lower() for item in recipe.get("ingredientLines", []) if _sanitize_text(item)]


def _per_serving(quantity: float | int | None, servings: float | int | None) -> int:
    total = float(quantity or 0)
    divisor = float(servings or 1)
    if divisor <= 0:
        divisor = 1
    return int(round(total / divisor))


def _extract_nutrition(recipe: dict[str, Any]) -> dict[str, int]:
    nutrients = recipe.get("totalNutrients", {})
    servings = recipe.get("yield", 1)
    return {
        "calories": _per_serving(recipe.get("calories"), servings),
        "protein": _per_serving(nutrients.get("PROCNT", {}).get("quantity"), servings),
        "carbs": _per_serving(nutrients.get("CHOCDF", {}).get("quantity"), servings),
        "fat": _per_serving(nutrients.get("FAT", {}).get("quantity"), servings),
    }


def _extract_steps(recipe: dict[str, Any]) -> list[str]:
    source_url = _sanitize_text(recipe.get("url"))
    if source_url:
        return [
            "Full cooking instructions are hosted on the original recipe page.",
            f"Open the source recipe: {source_url}",
        ]
    return ["Full cooking instructions are not available in the current Edamam response."]


def _derive_tags(recipe: dict[str, Any]) -> tuple[list[str], list[str]]:
    taste_tags = []
    for group in ("mealType", "dishType", "cuisineType"):
        for item in recipe.get(group, []):
            normalized = _normalize_label(item)
            if normalized:
                taste_tags.append(normalized)

    diet_tags = []
    for group in ("dietLabels", "healthLabels"):
        for item in recipe.get(group, []):
            normalized = _normalize_label(item)
            if normalized:
                diet_tags.append(normalized)

    return sorted(set(taste_tags)), sorted(set(diet_tags))


def _build_description(recipe: dict[str, Any]) -> str:
    source = _sanitize_text(recipe.get("source"))
    cuisine = ", ".join(recipe.get("cuisineType", [])[:2]).strip()
    if source and cuisine:
        return f"{source} recipe with {cuisine.lower()} flavors."
    if source:
        return f"Recipe from {source}."
    return _sanitize_text(recipe.get("label")) or "Recipe"


def _transform_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    uri = _sanitize_text(recipe.get("uri"))
    if not uri:
        raise EdamamServiceError("Edamam recipe payload is missing uri")
    recipe_key = _extract_recipe_key(uri)

    taste_tags, diet_tags = _derive_tags(recipe)
    return {
        "id": recipe_key,
        "name": _sanitize_text(recipe.get("label")) or "Unknown Recipe",
        "description": _build_description(recipe),
        "image": recipe.get("image"),
        "ingredients": _extract_ingredients(recipe),
        "steps": _extract_steps(recipe),
        "taste_tags": taste_tags,
        "diet_tags": diet_tags,
        "time_minutes": int(recipe.get("totalTime") or 30),
        "nutrition": _extract_nutrition(recipe),
        "category": _derive_category(recipe),
        "area": (recipe.get("cuisineType") or [""])[0],
        "source_url": _sanitize_text(recipe.get("url")),
        "source_name": _sanitize_text(recipe.get("source")),
    }


def _request_params(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    if not settings.edamam_app_id or not settings.edamam_app_key:
        raise EdamamServiceError("EDAMAM_APP_ID and EDAMAM_APP_KEY must be configured")

    params: dict[str, Any] = {
        "type": "public",
        "app_id": settings.edamam_app_id,
        "app_key": settings.edamam_app_key,
    }
    if extra:
        params.update(extra)
    return params


async def _request_recipes(params: dict[str, Any]) -> dict[str, Any]:
    url = f"{settings.edamam_base_url}/api/recipes/v2"
    headers = {"Edamam-Account-User": settings.edamam_account_user}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(url, params=_request_params(params), headers=headers)
    if response.status_code != 200:
        detail = response.text.strip()
        if len(detail) > 200:
            detail = detail[:200]
        raise EdamamServiceError(
            f"Edamam recipe request failed with status {response.status_code}: {detail or 'no response body'}"
        )
    return response.json()


async def get_recipe_by_id(recipe_id: str) -> dict[str, Any] | None:
    recipe_key = _normalize_recipe_id(recipe_id)
    url = f"{settings.edamam_base_url}/api/recipes/v2/{recipe_key}"
    headers = {"Edamam-Account-User": settings.edamam_account_user}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(url, params=_request_params(), headers=headers)
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        detail = response.text.strip()
        if len(detail) > 200:
            detail = detail[:200]
        raise EdamamServiceError(
            f"Edamam recipe detail request failed with status {response.status_code}: {detail or 'no response body'}"
        )
    payload = response.json()
    recipe = payload.get("recipe")
    if not recipe:
        return None
    return _transform_recipe(recipe)


async def list_recipes(limit: int = 12) -> list[dict[str, Any]]:
    payload = await _request_recipes({"q": "dinner"})
    hits = payload.get("hits", [])
    return [_transform_recipe(hit.get("recipe", {})) for hit in hits[:limit] if hit.get("recipe")]


async def search_recipes_by_ingredients(ingredients: list[str], max_results: int = 10) -> list[dict[str, Any]]:
    ingredients = normalize_terms(ingredients)
    if not ingredients:
        return await list_recipes(max_results)

    query = " ".join(ingredients[:5])
    payload = await _request_recipes({"q": query})
    hits = payload.get("hits", [])
    recipes = [_transform_recipe(hit.get("recipe", {})) for hit in hits if hit.get("recipe")]
    recipes.sort(
        key=lambda recipe: len(set(recipe.get("ingredients", [])).intersection(ingredients)),
        reverse=True,
    )
    return recipes[:max_results]
