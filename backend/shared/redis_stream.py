"""Redis streaming utility for real-time updates."""

import redis
import json
import os
from typing import Dict, Any

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

def get_redis_client():
    """Get Redis client instance."""
    return redis.from_url(REDIS_URL, decode_responses=True)


def publish_research_update(report_id: int, update_data: Dict[str, Any]):
    """
    Publish a research report update to Redis.

    Args:
        report_id: The research report ID
        update_data: Dictionary containing update information:
            - type: "progress", "section", "complete", "error"
            - section: Current section name
            - content: Section content (if applicable)
            - percentage: Progress percentage (0-100)
            - message: Status message
    """
    client = get_redis_client()
    channel = f"research:report:{report_id}"

    # Add timestamp
    import datetime
    update_data["timestamp"] = datetime.datetime.utcnow().isoformat()

    # Publish to channel
    client.publish(channel, json.dumps(update_data))

    # Also store in a list for history (keep last 100 updates)
    history_key = f"research:history:{report_id}"
    client.lpush(history_key, json.dumps(update_data))
    client.ltrim(history_key, 0, 99)  # Keep only last 100
    client.expire(history_key, 3600)  # Expire after 1 hour


def get_research_history(report_id: int, limit: int = 50):
    """Get historical updates for a research report."""
    client = get_redis_client()
    history_key = f"research:history:{report_id}"
    updates = client.lrange(history_key, 0, limit - 1)
    return [json.loads(update) for update in updates]


def subscribe_to_research(report_id: int):
    """
    Subscribe to research report updates.
    Returns a pubsub object that can be iterated.

    Usage:
        pubsub = subscribe_to_research(123)
        for message in pubsub.listen():
            if message['type'] == 'message':
                data = json.loads(message['data'])
                print(data)
    """
    client = get_redis_client()
    pubsub = client.pubsub()
    channel = f"research:report:{report_id}"
    pubsub.subscribe(channel)
    return pubsub
