from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from .sample_data import SAMPLE_RECIPES


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AppStorage:
    def __init__(self, backend: str, db: AsyncIOMotorDatabase | None = None):
        self.backend = backend
        self.db = db
        self.users: dict[str, dict[str, Any]] = {}
        self.users_by_email: dict[str, str] = {}
        self.recipes: dict[str, dict[str, Any]] = {}
        self.favorites: list[dict[str, Any]] = []
        self.history: list[dict[str, Any]] = []

    @classmethod
    async def create(cls, db: AsyncIOMotorDatabase | None = None) -> "AppStorage":
        backend = "mongo" if db is not None else "memory"
        storage = cls(backend=backend, db=db)
        await storage.initialize()
        return storage

    async def initialize(self) -> None:
        if self.backend == "mongo" and self.db is not None:
            await self.db.users.create_index("id", unique=True)
            await self.db.users.create_index("email", unique=True)
            await self.db.recipes.create_index("id", unique=True)
            await self.db.favorites.create_index([("user_id", 1), ("recipe_id", 1)], unique=True)
            count = await self.db.recipes.count_documents({})
            if count == 0:
                await self.db.recipes.insert_many(SAMPLE_RECIPES)
        else:
            for recipe in SAMPLE_RECIPES:
                self.recipes[recipe["id"]] = recipe.copy()

    async def list_recipes(self) -> list[dict[str, Any]]:
        if self.backend == "mongo" and self.db is not None:
            cursor = self.db.recipes.find({}, {"_id": 0})
            return await cursor.to_list(length=None)
        return list(self.recipes.values())

    async def get_recipe_by_id(self, recipe_id: str) -> dict[str, Any] | None:
        if self.backend == "mongo" and self.db is not None:
            return await self.db.recipes.find_one({"id": recipe_id}, {"_id": 0})
        return self.recipes.get(recipe_id)

    async def find_user_by_email(self, email: str) -> dict[str, Any] | None:
        email = email.lower()
        if self.backend == "mongo" and self.db is not None:
            return await self.db.users.find_one({"email": email}, {"_id": 0})
        user_id = self.users_by_email.get(email)
        return self.users.get(user_id) if user_id else None

    async def find_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        if self.backend == "mongo" and self.db is not None:
            return await self.db.users.find_one({"id": user_id}, {"_id": 0})
        return self.users.get(user_id)

    async def create_user(self, user_data: dict[str, Any]) -> dict[str, Any]:
        record = user_data.copy()
        record["id"] = record.get("id") or str(uuid4())
        record["email"] = record["email"].lower()
        record.setdefault("role", "customer")
        if self.backend == "mongo" and self.db is not None:
            await self.db.users.insert_one(record)
            return {key: value for key, value in record.items() if key != "password_hash"}

        self.users[record["id"]] = record
        self.users_by_email[record["email"]] = record["id"]
        return {key: value for key, value in record.items() if key != "password_hash"}

    async def add_favorite(self, user_id: str, recipe: dict[str, Any]) -> dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "user_id": user_id,
            "recipe_id": recipe["id"],
            "recipe": recipe,
            "created_at": _now_iso(),
        }
        if self.backend == "mongo" and self.db is not None:
            await self.db.favorites.update_one(
                {"user_id": user_id, "recipe_id": recipe["id"]},
                {"$setOnInsert": record},
                upsert=True,
            )
            existing = await self.db.favorites.find_one({"user_id": user_id, "recipe_id": recipe["id"]}, {"_id": 0})
            return existing or record

        existing = next((item for item in self.favorites if item["user_id"] == user_id and item["recipe_id"] == recipe["id"]), None)
        if existing:
            return existing
        self.favorites.append(record)
        return record

    async def list_favorites(self, user_id: str) -> list[dict[str, Any]]:
        if self.backend == "mongo" and self.db is not None:
            cursor = self.db.favorites.find({"user_id": user_id}, {"_id": 0})
            return await cursor.to_list(length=None)
        return [item for item in self.favorites if item["user_id"] == user_id]

    async def remove_favorite(self, user_id: str, recipe_id: str) -> bool:
        if self.backend == "mongo" and self.db is not None:
            result = await self.db.favorites.delete_one({"user_id": user_id, "recipe_id": recipe_id})
            return result.deleted_count > 0

        before = len(self.favorites)
        self.favorites = [item for item in self.favorites if not (item["user_id"] == user_id and item["recipe_id"] == recipe_id)]
        return len(self.favorites) != before

    async def add_history(self, user_id: str, query: dict[str, Any], result_ids: list[str]) -> dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "user_id": user_id,
            "query": query,
            "result_ids": result_ids,
            "created_at": _now_iso(),
        }
        if self.backend == "mongo" and self.db is not None:
            await self.db.history.insert_one(record)
            return {key: value for key, value in record.items() if key != "_id"}

        self.history.append(record)
        return record

    async def list_history(self, user_id: str) -> list[dict[str, Any]]:
        if self.backend == "mongo" and self.db is not None:
            cursor = self.db.history.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
            return await cursor.to_list(length=None)
        return [item for item in self.history if item["user_id"] == user_id]
