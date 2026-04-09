from __future__ import annotations

from collections import Counter
from typing import Any


def normalize_terms(values: list[str] | None) -> list[str]:
    if not values:
        return []
    result: list[str] = []
    for value in values:
        cleaned = value.strip().lower()
        if cleaned:
            result.append(cleaned)
    return result


def parse_ingredient_input(raw_text: str | None) -> list[str]:
    if not raw_text:
        return []
    separators = [",", "\n", ";", "|"]
    text = raw_text
    for separator in separators:
        text = text.replace(separator, ",")
    return normalize_terms(text.split(","))


def _nutrition_bonus(recipe: dict[str, Any], nutrition_goal: str | None) -> float:
    if not nutrition_goal:
        return 0.0
    nutrition_goal = nutrition_goal.lower()
    calories = recipe.get("nutrition", {}).get("calories", 0)
    protein = recipe.get("nutrition", {}).get("protein", 0)
    fat = recipe.get("nutrition", {}).get("fat", 0)

    if nutrition_goal in {"healthy", "weight_loss", "reduction"}:
        return 2.0 if calories <= 350 and fat <= 15 else 0.0
    if nutrition_goal in {"high-protein", "muscle"}:
        return 2.0 if protein >= 20 else 0.0
    if nutrition_goal in {"balanced", "balance"}:
        return 1.5
    return 0.0


def score_recipe(recipe: dict[str, Any], ingredients: list[str], taste_preferences: list[str], max_time_minutes: int | None, diet_goal: str | None, nutrition_goal: str | None) -> dict[str, Any]:
    recipe_ingredients = normalize_terms(recipe.get("ingredients", []))
    recipe_tastes = normalize_terms(recipe.get("taste_tags", []))
    recipe_diets = normalize_terms(recipe.get("diet_tags", []))

    matched_ingredients = sorted(set(recipe_ingredients).intersection(ingredients))
    missing_ingredients = sorted(set(recipe_ingredients).difference(matched_ingredients))

    ingredient_score = len(matched_ingredients) * 4.0
    taste_score = 0.0
    if taste_preferences and recipe_tastes:
        taste_score = 2.5 if set(taste_preferences).intersection(recipe_tastes) else 0.0

    time_score = 0.0
    if max_time_minutes is not None:
        time_score = 2.0 if recipe.get("time_minutes", 9999) <= max_time_minutes else -1.5

    diet_score = 0.0
    if diet_goal:
        diet_score = 2.0 if diet_goal.lower() in recipe_diets else 0.0

    nutrition_score = _nutrition_bonus(recipe, nutrition_goal)

    completeness_penalty = max(0.0, len(recipe_ingredients) - len(matched_ingredients)) * 0.25
    score = ingredient_score + taste_score + time_score + diet_score + nutrition_score - completeness_penalty

    reasons: list[str] = []
    if matched_ingredients:
        reasons.append(f"matches {len(matched_ingredients)} available ingredient(s)")
    if taste_score:
        reasons.append("fits your taste preference")
    if time_score > 0:
        reasons.append("fits your time limit")
    if diet_score:
        reasons.append("matches your diet goal")
    if nutrition_score:
        reasons.append("supports your nutrition goal")
    if not reasons:
        reasons.append("good general fallback recipe")

    return {
        **recipe,
        "match_score": round(score, 2),
        "matched_ingredients": matched_ingredients,
        "missing_ingredients": missing_ingredients,
        "reason": ", ".join(reasons),
    }


def rank_recipes(recipes: list[dict[str, Any]], ingredients: list[str], taste_preferences: list[str], max_time_minutes: int | None, diet_goal: str | None, nutrition_goal: str | None, limit: int = 5) -> list[dict[str, Any]]:
    scored = [score_recipe(recipe, ingredients, taste_preferences, max_time_minutes, diet_goal, nutrition_goal) for recipe in recipes]
    filtered = [recipe for recipe in scored if recipe.get("matched_ingredients")]
    filtered.sort(key=lambda item: (item["match_score"], len(item.get("matched_ingredients", []))), reverse=True)
    return filtered[:limit]
