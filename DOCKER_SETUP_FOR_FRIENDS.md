# Docker Setup Guide for AI Cookit

Follow these steps to run the latest version of AI Cookit with live editing support.

## Prerequisites
- Docker Desktop installed
- Git installed (optional, for cloning the repo)

## Quick Start

### Step 1: Get the Latest Code
**Option A - Clone from Git (if available):**
```bash
git clone <your-repo-url>
cd AI_Cookit-main
```

**Option B - Update Existing Project:**
```bash
cd E:\AI_Cookit-main
git pull origin main
```

### Step 2: Remove Old Images & Containers
Clean up old versions to ensure you're using the latest:
```bash
docker compose down
docker rmi ai_cookit-main-web:latest
```

### Step 3: Build & Start Fresh
```bash
docker compose build --no-cache
docker compose up -d
```

### Step 4: Access the Application
Open your browser and go to:
```
http://localhost:8001
```

You should see:
- **Home page** → http://localhost:8001/
- **Food** → http://localhost:8001/html/food.html
- **Recommend** → http://localhost:8001/html/recommend.html
- **History** → http://localhost:8001/html/history.html
- **Profile** → http://localhost:8001/html/profile.html

---

## Live Editing (Edit Files & See Changes)

The Docker setup watches your local files and reloads automatically.

### Edit HTML Files
1. Open `html/` folder in your editor (VS Code recommended)
2. Edit any `.html` file (home.html, food.html, etc.)
3. Save the file
4. Refresh browser → Changes appear instantly

### Edit CSS Files
1. Edit files in `css/` folder
2. Save
3. Refresh browser → Styles update

### Edit JavaScript Files
1. Edit files in `javascript/` folder
2. Save
3. Refresh browser → Scripts reload

### Edit Backend (Python/FastAPI)
1. Edit files in `backend/` folder
2. The server auto-reloads (check container logs)
3. Refresh browser → API changes take effect

---

## Check Container Logs

To see what's happening in the containers:

```bash
# View web server logs
docker logs ai_cookit-main-web-1

# View MongoDB logs
docker logs ai_cookit-main-mongo-1

# Follow logs in real-time
docker logs ai_cookit-main-web-1 -f
```

---

## Common Issues

### "Port 8001 already in use"
Stop other containers:
```bash
docker compose down
```

### "Changes not showing up"
Hard refresh in browser:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Clear Docker cache completely
```bash
docker compose down -v
docker system prune -a
docker compose build --no-cache
docker compose up -d
```

---

## File Structure Reference

```
AI_Cookit-main/
├── html/              ← Edit HTML files here
├── css/               ← Edit styles here
├── javascript/        ← Edit JS files here
├── backend/           ← Edit Python/FastAPI here
├── image/             ← Images & assets
├── docker-compose.yml ← Container orchestration config
├── Dockerfile         ← How the image is built
└── requirements.txt   ← Python dependencies
```

---

## Stop & Start

**Stop containers:**
```bash
docker compose down
```

**Start containers:**
```bash
docker compose up -d
```

**Restart containers:**
```bash
docker compose restart
```

---

## Need Help?

If something breaks:
1. Check logs: `docker logs ai_cookit-main-web-1`
2. Rebuild fresh: `docker compose build --no-cache && docker compose up -d`
3. Check if MongoDB is healthy: `docker ps` (should show mongo running)

Enjoy developing! 🚀
