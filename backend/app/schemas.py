from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class SocialAuthRequest(BaseModel):
    token: str = Field(min_length=1)


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str = "customer"
    avatar_url: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class AuthProviderConfig(BaseModel):
    enabled: bool
    client_id: str | None = None
    app_id: str | None = None
    sdk_version: str | None = None


class AuthProvidersResponse(BaseModel):
    google: AuthProviderConfig
    facebook: AuthProviderConfig


class RecommendationRequest(BaseModel):
    ingredients: list[str] = Field(default_factory=list)
    taste_preferences: list[str] = Field(default_factory=list)
    max_time_minutes: int | None = Field(default=None, ge=1, le=240)
    diet_goal: str | None = None
    nutrition_goal: str | None = None
    max_results: int = Field(default=6, ge=1, le=30)


class FavoriteCreate(BaseModel):
    recipe_id: str = Field(min_length=1)


class RecipeBase(BaseModel):
    id: str
    name: str
    description: str
    image: str | None = None
    ingredients: list[str]
    steps: list[str]
    taste_tags: list[str] = Field(default_factory=list)
    diet_tags: list[str] = Field(default_factory=list)
    time_minutes: int
    nutrition: dict[str, int]


class RecommendationItem(RecipeBase):
    match_score: float
    matched_ingredients: list[str] = Field(default_factory=list)
    missing_ingredients: list[str] = Field(default_factory=list)
    reason: str


class RecommendationResponse(BaseModel):
    query: RecommendationRequest
    results: list[RecommendationItem]


class FavoriteItem(BaseModel):
    id: str
    user_id: str
    recipe: RecipeBase
    created_at: str


class HistoryItem(BaseModel):
    id: str
    user_id: str
    query: RecommendationRequest
    result_ids: list[str]
    created_at: str


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_public: bool = Field(default=False)


class CollectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_public: bool | None = None


class CollectionItem(BaseModel):
    id: str
    collection_id: str
    recipe_id: str
    recipe: RecipeBase
    added_at: str


class Collection(BaseModel):
    id: str
    user_id: str
    name: str
    description: str | None = None
    is_public: bool = False
    item_count: int = 0
    created_at: str
    updated_at: str


class CollectionDetail(Collection):
    items: list[CollectionItem] = Field(default_factory=list)
