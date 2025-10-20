"""Application configuration."""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql://akleao:password@localhost:5432/akleao"
    REDIS_URL: str = "redis://localhost:6379"

    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://akleao-finance-v0.vercel.app"
    ]

    # JWT Authentication
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # AWS
    AWS_REGION: str = "us-east-1"
    SQS_QUEUE_URL: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
