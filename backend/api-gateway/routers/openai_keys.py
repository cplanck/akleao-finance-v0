"""OpenAI API keys management router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from database import get_db
from auth import get_current_user
import sys
sys.path.insert(0, "../../shared")
from shared.models.user import User

router = APIRouter()


class KeyStatusResponse(BaseModel):
    """Response for key status check."""
    has_api_key: bool
    has_admin_key: bool


class SaveKeyRequest(BaseModel):
    """Request to save API key."""
    api_key: Optional[str] = None
    admin_key: Optional[str] = None
    key_type: str = "user"  # "user" or "admin"


class UsageResponse(BaseModel):
    """Response for usage statistics."""
    has_api_key: bool
    has_admin_key: bool
    total_requests: int
    total_tokens: int
    estimated_cost: float
    last_used: Optional[str]
    requests_30d: int
    tokens_30d: int
    cost_30d: float
    openai_actual_spend: Optional[float]
    openai_current_month_spend: Optional[float]
    openai_total_tokens_30d: Optional[int]
    needs_admin_key: bool


@router.get("/openai/keys/status", response_model=KeyStatusResponse)
async def get_key_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if user has API keys configured."""
    query_sql = text("""
        SELECT encrypted_key, encrypted_admin_key
        FROM user_api_keys
        WHERE user_id = :user_id
    """)

    result = await db.execute(query_sql, {"user_id": current_user.id})
    row = result.fetchone()

    has_api_key = row is not None and row.encrypted_key is not None
    has_admin_key = row is not None and row.encrypted_admin_key is not None

    return KeyStatusResponse(
        has_api_key=has_api_key,
        has_admin_key=has_admin_key
    )


@router.post("/openai/key")
async def save_api_key(
    request: SaveKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save encrypted OpenAI API key."""
    # TODO: Implement encryption using ENCRYPTION_KEY from config
    # For now, return placeholder response
    return {
        "success": True,
        "message": "API key management not yet implemented in FastAPI"
    }


@router.delete("/openai/key")
async def delete_api_key(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete OpenAI API key."""
    query_sql = text("DELETE FROM user_api_keys WHERE user_id = :user_id")
    await db.execute(query_sql, {"user_id": current_user.id})
    await db.commit()

    return {
        "success": True,
        "message": "API key removed successfully"
    }


@router.get("/openai/usage", response_model=UsageResponse)
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get OpenAI usage statistics."""
    # Check if user has API keys
    key_query = text("""
        SELECT encrypted_key, encrypted_admin_key
        FROM user_api_keys
        WHERE user_id = :user_id
    """)

    key_result = await db.execute(key_query, {"user_id": current_user.id})
    key_row = key_result.fetchone()

    has_api_key = key_row is not None and key_row.encrypted_key is not None
    has_admin_key = key_row is not None and key_row.encrypted_admin_key is not None

    # Get usage statistics from local DB
    usage_query = text("""
        SELECT
            COALESCE(SUM(request_count), 0)::int as total_requests,
            COALESCE(SUM(tokens_used), 0)::int as total_tokens,
            COALESCE(SUM(estimated_cost), 0)::numeric as estimated_cost,
            MAX(last_request_at) as last_used
        FROM openai_usage
        WHERE user_id = :user_id
    """)

    usage_result = await db.execute(usage_query, {"user_id": current_user.id})
    usage_row = usage_result.fetchone()

    # Get last 30 days statistics
    usage_30d_query = text("""
        SELECT
            COALESCE(SUM(request_count), 0)::int as requests_30d,
            COALESCE(SUM(tokens_used), 0)::int as tokens_30d,
            COALESCE(SUM(estimated_cost), 0)::numeric as cost_30d
        FROM openai_usage
        WHERE user_id = :user_id
            AND last_request_at >= NOW() - INTERVAL '30 days'
    """)

    usage_30d_result = await db.execute(usage_30d_query, {"user_id": current_user.id})
    usage_30d_row = usage_30d_result.fetchone()

    return UsageResponse(
        has_api_key=has_api_key,
        has_admin_key=has_admin_key,
        total_requests=usage_row.total_requests if usage_row else 0,
        total_tokens=usage_row.total_tokens if usage_row else 0,
        estimated_cost=float(usage_row.estimated_cost) if usage_row and usage_row.estimated_cost else 0.0,
        last_used=usage_row.last_used.isoformat() if usage_row and usage_row.last_used else None,
        requests_30d=usage_30d_row.requests_30d if usage_30d_row else 0,
        tokens_30d=usage_30d_row.tokens_30d if usage_30d_row else 0,
        cost_30d=float(usage_30d_row.cost_30d) if usage_30d_row and usage_30d_row.cost_30d else 0.0,
        openai_actual_spend=None,  # TODO: Fetch from OpenAI API
        openai_current_month_spend=None,  # TODO: Fetch from OpenAI API
        openai_total_tokens_30d=None,  # TODO: Fetch from OpenAI API
        needs_admin_key=not has_admin_key
    )
