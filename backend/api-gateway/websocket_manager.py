"""WebSocket manager for real-time updates."""

import socketio
import asyncio
import json
import os
from typing import Dict, Any
import redis.asyncio as redis

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Configure this properly for production
    logger=True,
    engineio_logger=True
)

# Wrap with ASGI app (for standalone use if needed)
socket_app = socketio.ASGIApp(sio)

# Export sio for integration with FastAPI
__all__ = ['sio', 'socket_app']

# Redis client for pub/sub
redis_client = None
pubsub = None


async def init_redis():
    """Initialize Redis connection and start listening for events."""
    global redis_client, pubsub

    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    redis_client = await redis.from_url(redis_url, decode_responses=True)
    pubsub = redis_client.pubsub()

    # Subscribe to scraper status channel
    await pubsub.subscribe("scraper_status")
    print("✅ Subscribed to Redis scraper_status channel")

    # Start listening task
    asyncio.create_task(listen_to_redis())


async def listen_to_redis():
    """Listen for Redis pub/sub messages and forward to Socket.IO clients."""
    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                data = json.loads(message["data"])
                await sio.emit('scraper_status', data)
                print(f"📡 Forwarded scraper status to clients: {data.get('status')}")
            except Exception as e:
                print(f"❌ Error processing Redis message: {e}")


@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    print(f"✅ Client connected: {sid}")

    # Initialize Redis on first connection
    global redis_client
    if redis_client is None:
        await init_redis()


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    print(f"👋 Client disconnected: {sid}")


async def emit_scraper_status(data: Dict[str, Any]):
    """Emit scraper status update to all connected clients."""
    await sio.emit('scraper_status', data)
    print(f"Emitted scraper status: {data.get('status')}")
