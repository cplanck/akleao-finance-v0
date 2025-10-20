FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY workers/reddit-scraper/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared models
COPY shared ./shared

# Copy application code
COPY workers/reddit-scraper .

# Run the worker (unbuffered output for real-time logs)
CMD ["python", "-u", "main.py"]
