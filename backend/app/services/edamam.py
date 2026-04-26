from __future__ import annotations

import base64
import re
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
    return re.sub(r"\s+", " ", (value or "")).strip()


def _normalize_label(value: str) -> str:
    return _sanitize_text(value).lower().replace(" ", "-")


def _display_term(value: str | None) -> str:
    cleaned = _sanitize_text(value)
    if not cleaned:
        return ""
    cleaned = cleaned.replace("/", " or ").replace("-", " ")
    return cleaned.lower()


def _format_terms(values: list[str] | None, limit: int = 2) -> str:
    items: list[str] = []
    for value in values or []:
        display = _display_term(value)
        if display and display not in items:
            items.append(display)
        if len(items) >= limit:
            break

    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return f"{items[0]} and {items[1]}"


def _remove_source_mentions(text: str | None, source: str | None) -> str:
    cleaned_text = _sanitize_text(text)
    cleaned_source = _sanitize_text(source)
    if not cleaned_text or not cleaned_source:
        return cleaned_text

    pattern = rf"(?i)\b{re.escape(cleaned_source)}(?:'s)?\b"
    trimmed = re.sub(pattern, "", cleaned_text)
    trimmed = re.sub(r"\(\s*\)", "", trimmed)
    trimmed = re.sub(r"\[\s*\]", "", trimmed)
    trimmed = re.sub(r"\s*[-|:;,/]+\s*", " ", trimmed)
    trimmed = re.sub(r"\s{2,}", " ", trimmed)
    trimmed = trimmed.strip(" -|:;,/")
    return _sanitize_text(trimmed) or cleaned_text


def _clean_recipe_name(recipe: dict[str, Any]) -> str:
    label = _remove_source_mentions(recipe.get("label"), recipe.get("source"))
    return label or "Unknown Recipe"


def _with_article(text: str) -> str:
    if not text:
        return "A recipe"
    article = "An" if text[0].lower() in {"a", "e", "i", "o", "u"} else "A"
    return f"{article} {text}"


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
    recipe_name = _normalize_label(recipe.get("label", ""))

    # Check for desserts first (including dessert keywords in name)
    if "desserts" in dish_types or "dessert" in dish_types or "sweets" in dish_types:
        return "dessert"
    if any(keyword in recipe_name for keyword in ["dessert", "cake", "cookie", "cream", "pudding", "mousse", "brownie", "pie", "tart", "candy", "chocolate"]):
        return "dessert"
    
    # Check for breakfast
    if "breakfast" in meal_types:
        return "breakfast"
    
    # Check for lunch (including lunch/dinner to avoid losing data)
    if "lunch" in meal_types or "lunch/dinner" in meal_types:
        return "lunch"
    
    # Check for snacks/appetizers
    if "snack" in meal_types or "teatime" in meal_types or "appetizer" in dish_types:
        return "quick"
    
    # For main courses and dinner, check if it could be lunch too
    if "main-course" in dish_types or "dinner" in meal_types:
        # If it has lunch/dinner label, categorize as lunch to balance dataset
        if "lunch/dinner" in meal_types:
            return "lunch"
        return "dinner"
    
    # Default to dinner for ambiguous items (better to include in dinner than lose them)
    return "dinner"


def _extract_ingredients(recipe: dict[str, Any]) -> list[str]:
    ingredients = []
    source = _sanitize_text(recipe.get("source"))
    for item in recipe.get("ingredients", []):
        food = _remove_source_mentions(item.get("food"), source)
        if food:
            ingredients.append(food.lower())
    if ingredients:
        return ingredients
    return [
        cleaned.lower()
        for item in recipe.get("ingredientLines", [])
        if (cleaned := _remove_source_mentions(item, source))
    ]


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
    cuisine = _format_terms(recipe.get("cuisineType"), limit=2)
    meal_type = _format_terms(recipe.get("mealType"), limit=1)
    dish_type = _format_terms(recipe.get("dishType"), limit=1)
    label = _clean_recipe_name(recipe)
    time_minutes = int(recipe.get("totalTime") or 0)

    descriptor_parts = [part for part in (cuisine, dish_type or meal_type) if part]
    if descriptor_parts:
        description = f"{_with_article(' '.join(descriptor_parts))} recipe"
    elif label:
        description = f"A recipe for {label}"
    else:
        description = "A recipe"

    if time_minutes > 0:
        description = f"{description} ready in about {time_minutes} minutes"

    return f"{description}."


def _transform_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    uri = _sanitize_text(recipe.get("uri"))
    if not uri:
        raise EdamamServiceError("Edamam recipe payload is missing uri")
    recipe_key = _extract_recipe_key(uri)

    taste_tags, diet_tags = _derive_tags(recipe)
    return {
        "id": recipe_key,
        "name": _clean_recipe_name(recipe),
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


async def browse_diverse_recipes(
    category: str | None = None,
    diet_labels: list[str] | None = None,
    max_results: int = 12,
) -> list[dict[str, Any]]:
    """Fetch diverse recipes with optional category and diet filtering."""
    recipes_set = {}
    
    # Define search queries for diversity
    search_queries = []
    
    if category and category.lower() != "all":
        # If specific category requested, fetch from that
        search_queries.append(category)
    else:
        # Always fetch diverse meal types on default (ensures lunch is included)
        search_queries.extend(["breakfast", "lunch", "lunch recipes", "dinner", "snack", "dessert", "appetizer", "salad", "main course"])
    
    # Fetch from each query type to ensure diversity
    for query in search_queries:
        try:
            params = {"q": query}
            
            # Add diet labels if specified
            if diet_labels:
                for diet in diet_labels:
                    normalized_diet = diet.lower().strip()
                    if normalized_diet in ["vegan", "vegetarian", "paleo", "dairy-free", "gluten-free", "wheat-free"]:
                        params["diet"] = normalized_diet
                        break  # Edamam accepts one diet per query
            
            payload = await _request_recipes(params)
            hits = payload.get("hits", [])
            
            for hit in hits:
                recipe_data = hit.get("recipe", {})
                if recipe_data:
                    try:
                        transformed = _transform_recipe(recipe_data)
                        # Use ID as key to avoid duplicates
                        if transformed["id"] not in recipes_set:
                            recipes_set[transformed["id"]] = transformed
                            # Once we have enough, we can return early
                            if len(recipes_set) >= max_results:
                                return list(recipes_set.values())[:max_results]
                    except EdamamServiceError:
                        continue
        except EdamamServiceError:
            continue
    
    # Return what we have, up to max_results
    result = list(recipes_set.values())[:max_results]
    return result if result else []


async def search_recipes_by_diet(
    diet_labels: list[str],
    max_results: int = 12,
) -> list[dict[str, Any]]:
    """Search recipes by diet labels with high carb/protein/fat diversity."""
    params: dict[str, Any] = {"q": "recipe"}
    
    # Map diet labels to Edamam format
    edamam_diets = []
    for diet in diet_labels:
        diet_lower = diet.lower().strip()
        if diet_lower == "vegan":
            edamam_diets.append("vegan")
        elif diet_lower == "vegetarian":
            edamam_diets.append("vegetarian")
        elif diet_lower == "gluten-free" or diet_lower == "gluten_free":
            edamam_diets.append("gluten-free")
        elif diet_lower == "high-protein" or diet_lower == "high_protein":
            edamam_diets.append("high-protein")
        elif diet_lower == "low-carb" or diet_lower == "low_carb":
            edamam_diets.append("low-carb")
        elif diet_lower == "paleo":
            edamam_diets.append("paleo")
    
    if edamam_diets:
        params["diet"] = edamam_diets[0]  # Edamam accepts one diet per query
    
    try:
        payload = await _request_recipes(params)
        hits = payload.get("hits", [])
        recipes = [_transform_recipe(hit.get("recipe", {})) for hit in hits if hit.get("recipe")]
        return recipes[:max_results]
    except EdamamServiceError:
        return []
