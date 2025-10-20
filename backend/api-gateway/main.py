"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import init_db
from routers import auth, stocks, insights, sentiment, research, admin, reddit, positions, pinned_stocks, openai_keys
from websocket_manager import sio, socket_app
import socketio


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("🚀 Starting Akleao Finance API Gateway...")
    # Note: Database tables are managed by Alembic migrations
    # No need to initialize on startup
    print("✅ API Gateway initialized")

    yield

    # Shutdown
    print("👋 Shutting down Akleao Finance API Gateway...")


app = FastAPI(
    title="Akleao Finance API",
    description="Backend API for financial data aggregation and insights",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["Stocks"])
app.include_router(insights.router, prefix="/api/insights", tags=["Insights"])
app.include_router(sentiment.router, prefix="/api/sentiment", tags=["Sentiment"])
app.include_router(research.router, tags=["Research"])  # prefix already defined in router
app.include_router(admin.router, tags=["Admin"])
app.include_router(reddit.router, tags=["Reddit"])  # prefix already defined in router
app.include_router(positions.router, tags=["Positions"])  # prefix already defined in router
app.include_router(pinned_stocks.router, prefix="/api", tags=["Pinned Stocks"])
app.include_router(openai_keys.router, prefix="/api", tags=["OpenAI Keys"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Akleao Finance API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# Combine FastAPI and Socket.IO into a single ASGI application
app = socketio.ASGIApp(sio, app)
