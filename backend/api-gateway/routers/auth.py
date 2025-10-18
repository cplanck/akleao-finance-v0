"""Authentication API router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid

from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user
import sys
sys.path.insert(0, "../../shared")
from shared.models.user import User

router = APIRouter()


class UserRegister(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    """User login request."""
    email: EmailStr
    password: str


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str
    user: dict


class UserProfile(BaseModel):
    """User profile update."""
    full_name: str | None = None
    investment_style: str | None = None
    risk_tolerance: str | None = None


@router.post("/register", response_model=Token)
async def register(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    # Check if user already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    new_user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        is_active=True,
        is_verified=False,
        tier="free"
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create access token
    access_token = create_access_token(data={"sub": new_user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "tier": new_user.tier
        }
    }


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login a user."""
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

    # Create access token
    access_token = create_access_token(data={"sub": user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "tier": user.tier,
            "investment_style": user.investment_style,
            "risk_tolerance": user.risk_tolerance
        }
    }


@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "tier": current_user.tier,
        "investment_style": current_user.investment_style,
        "risk_tolerance": current_user.risk_tolerance,
        "preferred_sectors": current_user.preferred_sectors,
        "watchlist_symbols": current_user.watchlist_symbols,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at.isoformat()
    }


@router.put("/me")
async def update_profile(
    profile_data: UserProfile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile."""
    if profile_data.full_name is not None:
        current_user.full_name = profile_data.full_name

    if profile_data.investment_style is not None:
        current_user.investment_style = profile_data.investment_style

    if profile_data.risk_tolerance is not None:
        current_user.risk_tolerance = profile_data.risk_tolerance

    await db.commit()

    return {"status": "success", "message": "Profile updated"}


@router.post("/watchlist/{symbol}")
async def add_to_watchlist(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a stock to user's watchlist."""
    import json

    watchlist = json.loads(current_user.watchlist_symbols or "[]")

    if symbol not in watchlist:
        watchlist.append(symbol)
        current_user.watchlist_symbols = json.dumps(watchlist)
        await db.commit()

    return {"status": "success", "watchlist": watchlist}


@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a stock from user's watchlist."""
    import json

    watchlist = json.loads(current_user.watchlist_symbols or "[]")

    if symbol in watchlist:
        watchlist.remove(symbol)
        current_user.watchlist_symbols = json.dumps(watchlist)
        await db.commit()

    return {"status": "success", "watchlist": watchlist}
