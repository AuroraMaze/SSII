from __future__ import annotations

import json
from typing import Any

import httpx

from ..core.config import settings


class GeminiServiceError(Exception):
    pass


async def generate_gemini_recipes(ingredients: list[str], max_results: int = 5) -> list[dict[str, Any]]:
    if not settings.gemini_api_key:
        raise GeminiServiceError("Gemini API key is not configured. Set GEMINI_API_KEY environment variable.")

    if not ingredients:
        return []

    model = settings.gemini_model
    normalized_model = model if model.startswith("models/") else f"models/{model}"
    api_url = f"https://gemini.googleapis.com/v1/{normalized_model}:generate"

    prompt_text = (
        "You are a smart recipe assistant. "
        "Given a list of available ingredients, return up to {max_results} dishes that can be prepared. "
        "For each dish provide name, description, ingredients, steps, time_minutes, nutrition (calories, protein, carbs, fat), "
        "taste_tags and diet_tags. "
        "Return JSON with top-level key 'recipes'."
    ).format(max_results=max_results)

    request_payload = {
        "input": {
            "prompt": {
                "text": f"Ingredients: {', '.join(ingredients)}\n\n{prompt_text}"
            }
        },
        "temperature": 0.6,
        "max_output_tokens": 1024,
        "structured_output": {
            "type": "json_schema",
            "json_schema": {
                "type": "object",
                "properties": {
                    "recipes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                                "ingredients": {"type": "array", "items": {"type": "string"}},
                                "steps": {"type": "array", "items": {"type": "string"}},
                                "time_minutes": {"type": "integer"},
                                "nutrition": {
                                    "type": "object",
                                    "properties": {
                                        "calories": {"type": "integer"},
                                        "protein": {"type": "integer"},
                                        "carbs": {"type": "integer"},
                                        "fat": {"type": "integer"},
                                    },
                                    "required": ["calories", "protein", "carbs", "fat"],
                                },
                                "taste_tags": {"type": "array", "items": {"type": "string"}},
                                "diet_tags": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["name", "description", "ingredients", "steps", "time_minutes", "nutrition"],
                        },
                    }
                },
                "required": ["recipes"],
            },
        },
    }

    headers = {
        "Authorization": f"Bearer {settings.gemini_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(api_url, headers=headers, json=request_payload)

    if response.status_code != 200:
        # include full body to ease diagnosis of 405/401, and return fallback path
        raise GeminiServiceError(
            f"Gemini API error {response.status_code} {response.reason_phrase}: {response.text}"
        )

    data = response.json()

    # Gemini structured output usually appears in data['candidates'][0]['content'] or data['output']
    text_content = None
    if "candidates" in data and data["candidates"]:
        first = data["candidates"][0]
        text_content = first.get("content") or first.get("output")
    if text_content is None and "output" in data:
        text_content = data["output"]

    if not text_content:
        raise GeminiServiceError("No structured output from Gemini API")

    try:
        parsed = json.loads(text_content)
    except Exception as exc:
        raise GeminiServiceError(f"Failed to decode Gemini JSON: {exc}") from exc

    recipes = parsed.get("recipes")
    if not isinstance(recipes, list):
        raise GeminiServiceError("Gemini output missing recipes array")

    # normalize to expected shape
    result: list[dict[str, Any]] = []
    for item in recipes[:max_results]:
        if not isinstance(item, dict):
            continue
        result.append(
            {
                "id": f"gemini-{hash(item.get('name', 'recipe'))}",
                "name": item.get("name", "Untitled Recipe"),
                "description": item.get("description", ""),
                "image": item.get("image"),
                "ingredients": [str(i) for i in item.get("ingredients", [])],
                "steps": [str(s) for s in item.get("steps", [])],
                "time_minutes": int(item.get("time_minutes", 0) or 0),
                "nutrition": {
                    "calories": int(item.get("nutrition", {}).get("calories", 0) or 0),
                    "protein": int(item.get("nutrition", {}).get("protein", 0) or 0),
                    "carbs": int(item.get("nutrition", {}).get("carbs", 0) or 0),
                    "fat": int(item.get("nutrition", {}).get("fat", 0) or 0),
                },
                "taste_tags": [str(x) for x in item.get("taste_tags", [])],
                "diet_tags": [str(x) for x in item.get("diet_tags", [])],
                "match_score": 0.0,
                "matched_ingredients": [ing for ing in item.get("ingredients", []) if str(ing).lower() in [i.lower() for i in ingredients]],
                "missing_ingredients": [ing for ing in item.get("ingredients", []) if str(ing).lower() not in [i.lower() for i in ingredients]],
                "reason": "Generated by Gemini AI",
            }
        )

    return result