FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY backend ./backend
COPY html ./html
COPY css ./css
COPY javascript ./javascript
COPY image ./image
COPY .env.example ./.env.example
RUN mkdir -p /app/image && ls -la /app/

EXPOSE 8001
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
