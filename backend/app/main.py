from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient

from .core.config import settings
from .routes.auth import router as auth_router
from .routes.favorites import router as favorites_router
from .routes.recommendations import router as recommendations_router
from .storage import AppStorage


BASE_DIR = Path(__file__).resolve().parents[2]

app = FastAPI(title="Cookit API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if settings.cors_origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(recommendations_router)
app.include_router(favorites_router)

app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/javascript", StaticFiles(directory=BASE_DIR / "javascript"), name="javascript")
app.mount("/image", StaticFiles(directory=BASE_DIR / "image"), name="image")
app.mount("/html", StaticFiles(directory=BASE_DIR / "html"), name="html")


@app.on_event("startup")
async def startup() -> None:
    mongo_db = None
    if settings.mongodb_uri:
        client = AsyncIOMotorClient(settings.mongodb_uri)
        mongo_db = client[settings.mongodb_db_name]

    app.state.storage = await AppStorage.create(mongo_db)


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(BASE_DIR / "html" / "home.html")


@app.get("/health")
async def health() -> dict[str, str]:
    storage = getattr(app.state, "storage", None)
    backend = getattr(storage, "backend", "unknown") if storage else "starting"
    return {"status": "ok", "backend": backend}
