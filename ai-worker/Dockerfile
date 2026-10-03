FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai_worker ./ai_worker

# Don't run as root
RUN useradd --create-home worker
USER worker

CMD ["python", "-m", "ai_worker.main"]
