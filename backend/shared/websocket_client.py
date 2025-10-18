"""WebSocket client for emitting events from workers."""

import os
import redis
import json
from typing import Dict, Any

# Redis connection for pub/sub
redis_client = redis.from_url(
    os.getenv("REDIS_URL", "redis://redis:6379/0"),
    decode_responses=True
)

SCRAPER_STATUS_CHANNEL = "scraper_status"


def emit_scraper_status(data: Dict[str, Any]):
    """Emit scraper status update via Redis pub/sub."""
    try:
        redis_client.publish(SCRAPER_STATUS_CHANNEL, json.dumps(data))
        print(f"📡 Published scraper status: {data.get('status')}")
    except Exception as e:
        print(f"❌ Failed to publish scraper status: {e}")
