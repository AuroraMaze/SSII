from __future__ import annotations

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    mongodb_uri: str | None = os.getenv("MONGODB_URI")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME", "cookit")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    cors_origins: list[str] = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]

    # Gemini API configuration
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

    # Edamam recipe API configuration
    edamam_app_id: str | None = os.getenv("EDAMAM_APP_ID")
    edamam_app_key: str | None = os.getenv("EDAMAM_APP_KEY")
    edamam_base_url: str = os.getenv("EDAMAM_BASE_URL", "https://api.edamam.com")
    edamam_account_user: str = os.getenv("EDAMAM_ACCOUNT_USER", "cookit-web")

    # Social auth configuration
    google_client_id: str | None = os.getenv("GOOGLE_CLIENT_ID")
    facebook_app_id: str | None = os.getenv("FACEBOOK_APP_ID")
    facebook_app_secret: str | None = os.getenv("FACEBOOK_APP_SECRET")
    facebook_graph_version: str = os.getenv("FACEBOOK_GRAPH_VERSION", "v24.0")


settings = Settings()
