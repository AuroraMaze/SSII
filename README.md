# Cookit - Intelligent Food Recommendation System

This project is a customer-focused web app for suggesting meals based on available ingredients, taste preferences, cooking time, and simple nutrition goals.

## What is implemented

- FastAPI backend with customer authentication
- MongoDB-compatible storage layer
- Recommendation engine based on available ingredients
- Favorites and recommendation history
- Static frontend served directly by FastAPI

## Run with Docker

1. Copy `.env.example` to `.env` and update values as needed.
2. Build and start the services:

```powershell
docker compose up --build
```

3. Open the app in your browser:

- `http://127.0.0.1:8001/html/home.html`
- `http://127.0.0.1:8001/html/Login.html`
- `http://127.0.0.1:8001/html/recommend.html`
- `http://127.0.0.1:8001/html/history.html`

> The Docker Compose setup includes a local MongoDB instance. If you want to use an external MongoDB, set `MONGODB_URI` in `.env`.

## API highlights

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/recommendations`
- `POST /api/favorites`
- `GET /api/favorites`
- `GET /api/favorites/history`

## Notes

- If `MONGODB_URI` is not set, the app runs in memory mode so you can still test the full flow.
- Password hashing uses `pbkdf2_sha256` to avoid the bcrypt backend issue in this environment.
