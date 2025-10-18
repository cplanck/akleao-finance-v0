# Better Auth Integration Guide

## Overview

This guide explains how to integrate Better Auth (frontend authentication) with the FastAPI backend for Akleao Finance.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
│                                                             │
│  User → Login Page (Better Auth)                           │
│           ↓                                                 │
│  Better Auth validates credentials                          │
│           ↓                                                 │
│  JWT token generated and stored in browser                  │
│           ↓                                                 │
│  All API calls include: Authorization: Bearer <JWT>        │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP + JWT
                   ↓
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (FastAPI - Python)                 │
│                                                             │
│  1. Receives request with JWT token                         │
│  2. Validates JWT signature and expiration                  │
│  3. Extracts Better Auth user_id from JWT                   │
│  4. Looks up user preferences in backend database           │
│  5. Returns user-specific data                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Cloud SQL)                │
│                                                             │
│  Better Auth tables:                                        │
│  - user (email, password, sessions)                         │
│  - session (active sessions)                                │
│  - account (OAuth providers)                                │
│                                                             │
│  Backend tables:                                            │
│  - users (preferences, linked via better_auth_user_id)      │
│  - watchlist                                                │
│  - anomaly_alerts                                           │
│  - user_insights                                            │
└─────────────────────────────────────────────────────────────┘
```

## Why Better Auth?

### Advantages
1. **Production-ready**: Battle-tested, secure, actively maintained
2. **UI/UX included**: Login/register pages, email verification, password reset
3. **OAuth support**: Google, GitHub, Twitter login (future)
4. **Next.js native**: Built specifically for Next.js 15 App Router
5. **Type-safe**: Full TypeScript support
6. **Time savings**: Focus on unique features, not auth plumbing

### What Better Auth Handles
- User registration and login
- Password hashing (bcrypt)
- Email verification
- Password reset flows
- Session management
- OAuth integration
- Security (CSRF, rate limiting)

### What Backend Handles
- Investment preferences (risk tolerance, investment style)
- Watchlist management
- Anomaly alert settings
- User-specific thresholds for detection
- Historical user feedback on alerts
- Custom insights generation

## Step 1: Install Better Auth in Next.js Frontend

```bash
npm install better-auth
```

### Configure Better Auth

Create `lib/auth.ts`:

```typescript
import { BetterAuth } from "better-auth"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const auth = new BetterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
})

export type Session = typeof auth.api.getSession
```

### Environment Variables

Add to `.env.local`:

```bash
# Better Auth Configuration
BETTER_AUTH_SECRET=your-super-secret-key-here-change-in-production
BETTER_AUTH_URL=http://localhost:3000

# Database (shared with backend)
DATABASE_URL=postgresql://akleao:password@localhost:5432/akleao
```

### Create Auth API Routes

Create `app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth"

export const { GET, POST } = auth.handler
```

## Step 2: Create Login/Register Pages

### Register Page

Create `app/auth/register/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { auth } from "@/lib/auth"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState("")

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      await auth.api.signUpEmail({
        email,
        password,
        name: fullName,
      })

      // Redirect to dashboard
      router.push("/")
    } catch (err: any) {
      setError(err.message || "Registration failed")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleRegister} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Create Account</h1>

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded border p-2"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border p-2"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border p-2"
          required
        />

        <button
          type="submit"
          className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
        >
          Register
        </button>

        <p className="text-center text-sm">
          Already have an account?{" "}
          <a href="/auth/login" className="text-blue-600">
            Login
          </a>
        </p>
      </form>
    </div>
  )
}
```

### Login Page

Create `app/auth/login/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { auth } from "@/lib/auth"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      await auth.api.signInEmail({
        email,
        password,
      })

      router.push("/")
    } catch (err: any) {
      setError(err.message || "Login failed")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border p-2"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border p-2"
          required
        />

        <button
          type="submit"
          className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
        >
          Login
        </button>

        <p className="text-center text-sm">
          Don't have an account?{" "}
          <a href="/auth/register" className="text-blue-600">
            Register
          </a>
        </p>
      </form>
    </div>
  )
}
```

## Step 3: Protect Routes

### Create Auth Hook

Create `hooks/use-session.ts`:

```typescript
"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/auth"

export function useSession() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.api.getSession().then((session) => {
      setSession(session)
      setLoading(false)
    })
  }, [])

  return { session, loading }
}
```

### Protect Pages

Wrap protected pages:

```typescript
"use client"

import { useSession } from "@/hooks/use-session"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DashboardPage() {
  const { session, loading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.push("/auth/login")
    }
  }, [session, loading, router])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return null
  }

  return <div>Protected Dashboard Content</div>
}
```

## Step 4: Backend JWT Validation (FastAPI)

### Install Dependencies

```bash
cd backend/api-gateway
pip install python-jose[cryptography] passlib[bcrypt]
```

### JWT Validation Utility

Update `backend/api-gateway/auth.py`:

```python
from jose import jwt, JWTError
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
import os

# Better Auth uses HS256 by default
SECRET_KEY = os.getenv("BETTER_AUTH_SECRET")
ALGORITHM = "HS256"

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify Better Auth JWT token and extract user info.

    Returns:
        dict: Decoded token payload with user_id, email, etc.
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
            raise HTTPException(status_code=401, detail="Token expired")

        return payload

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def get_current_user_id(token_payload: dict = Security(verify_token)) -> str:
    """
    Extract Better Auth user_id from token payload.
    """
    user_id = token_payload.get("sub")  # Better Auth stores user_id in 'sub' claim
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user_id")

    return user_id
```

### Update Backend User Model

Update `backend/shared/models/user.py`:

```python
from sqlalchemy import Column, String, JSON, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.sql import func
from .base import Base
import enum

class InvestmentStyle(enum.Enum):
    VALUE = "value"
    GROWTH = "growth"
    DIVIDEND = "dividend"
    MOMENTUM = "momentum"

class RiskTolerance(enum.Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"

class User(Base):
    """
    Backend user preferences and settings.
    Links to Better Auth user via better_auth_user_id.
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True)  # Generate with UUID
    better_auth_user_id = Column(String, unique=True, nullable=False, index=True)

    # Investment preferences
    investment_style = Column(SQLEnum(InvestmentStyle), default=InvestmentStyle.VALUE)
    risk_tolerance = Column(SQLEnum(RiskTolerance), default=RiskTolerance.MODERATE)
    sectors_of_interest = Column(JSON, default=list)  # ["technology", "healthcare"]

    # Watchlist
    watchlist = Column(JSON, default=list)  # ["AAPL", "TSLA", "NVDA"]

    # Anomaly detection settings (tunable thresholds)
    detection_config = Column(JSON, default=dict)  # {"volume_multiplier": 3.0, ...}

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### Protected Endpoint Example

Update `backend/api-gateway/routers/watchlist.py`:

```python
from fastapi import APIRouter, Depends
from ..auth import get_current_user_id
from ..database import get_db
from sqlalchemy.orm import Session
from shared.models.user import User

router = APIRouter()

@router.get("/api/watchlist")
async def get_watchlist(
    better_auth_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get user's watchlist.
    Requires valid Better Auth JWT token.
    """
    # Find or create backend user record
    user = db.query(User).filter(
        User.better_auth_user_id == better_auth_user_id
    ).first()

    if not user:
        # First time user - create preferences record
        user = User(
            better_auth_user_id=better_auth_user_id,
            watchlist=[]
        )
        db.add(user)
        db.commit()

    return {
        "watchlist": user.watchlist,
        "investment_style": user.investment_style.value,
        "risk_tolerance": user.risk_tolerance.value,
    }

@router.post("/api/watchlist/{symbol}")
async def add_to_watchlist(
    symbol: str,
    better_auth_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Add stock to watchlist."""
    user = db.query(User).filter(
        User.better_auth_user_id == better_auth_user_id
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if symbol not in user.watchlist:
        user.watchlist.append(symbol)
        db.commit()

    return {"message": f"{symbol} added to watchlist"}
```

## Step 5: Frontend API Calls

### Create API Client

Create `lib/api.ts`:

```typescript
import { auth } from "./auth"

async function getAuthHeaders() {
  const session = await auth.api.getSession()

  if (!session?.token) {
    throw new Error("Not authenticated")
  }

  return {
    "Authorization": `Bearer ${session.token}`,
    "Content-Type": "application/json",
  }
}

export async function getWatchlist() {
  const headers = await getAuthHeaders()

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/watchlist`,
    { headers }
  )

  if (!response.ok) {
    throw new Error("Failed to fetch watchlist")
  }

  return response.json()
}

export async function addToWatchlist(symbol: string) {
  const headers = await getAuthHeaders()

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/watchlist/${symbol}`,
    { method: "POST", headers }
  )

  if (!response.ok) {
    throw new Error("Failed to add to watchlist")
  }

  return response.json()
}
```

### Use in Components

```typescript
"use client"

import { useEffect, useState } from "react"
import { getWatchlist, addToWatchlist } from "@/lib/api"

export default function WatchlistComponent() {
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWatchlist()
  }, [])

  const loadWatchlist = async () => {
    try {
      const data = await getWatchlist()
      setWatchlist(data.watchlist)
    } catch (error) {
      console.error("Failed to load watchlist:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddStock = async (symbol: string) => {
    try {
      await addToWatchlist(symbol)
      await loadWatchlist()  // Refresh
    } catch (error) {
      console.error("Failed to add stock:", error)
    }
  }

  if (loading) return <div>Loading watchlist...</div>

  return (
    <div>
      <h2>Your Watchlist</h2>
      <ul>
        {watchlist.map((symbol) => (
          <li key={symbol}>{symbol}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Step 6: Database Migrations

Better Auth automatically creates its tables on first run. For backend tables:

```sql
-- Run this migration after Better Auth tables are created

CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  better_auth_user_id VARCHAR UNIQUE NOT NULL,
  investment_style VARCHAR,
  risk_tolerance VARCHAR,
  sectors_of_interest JSONB DEFAULT '[]'::jsonb,
  watchlist JSONB DEFAULT '[]'::jsonb,
  detection_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_better_auth_id ON users(better_auth_user_id);
```

## Environment Variables Summary

### Frontend (`.env.local`)

```bash
BETTER_AUTH_SECRET=your-super-secret-key-change-in-production
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://akleao:password@localhost:5432/akleao
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`.env`)

```bash
BETTER_AUTH_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=postgresql://akleao:password@localhost:5432/akleao
```

**IMPORTANT**: The `BETTER_AUTH_SECRET` must be the same in both frontend and backend!

## Testing the Integration

### 1. Register a New User

```bash
# Via Better Auth UI
# Navigate to http://localhost:3000/auth/register
# Fill out form and submit
```

### 2. Verify JWT Token

```bash
# In browser console after login
const session = await auth.api.getSession()
console.log(session.token)
```

### 3. Test Protected API

```bash
# Copy JWT token from step 2
curl http://localhost:8000/api/watchlist \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### 4. Add to Watchlist

```bash
curl -X POST http://localhost:8000/api/watchlist/AAPL \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Security Considerations

1. **HTTPS Only in Production**: Always use HTTPS for auth endpoints
2. **Secure Secrets**: Use environment variables, never commit secrets
3. **Token Expiration**: Better Auth handles this automatically
4. **CORS**: Configure allowed origins in FastAPI
5. **Rate Limiting**: Implement in FastAPI for auth endpoints
6. **SQL Injection**: Use SQLAlchemy ORM (already protected)
7. **XSS**: Better Auth handles secure cookie storage

## Troubleshooting

### "Invalid token" errors
- Verify `BETTER_AUTH_SECRET` matches in frontend and backend
- Check token hasn't expired (7 day default)
- Ensure JWT is being sent in `Authorization` header

### User not found in backend
- Check `better_auth_user_id` is being extracted correctly
- Verify user creation happens on first API call
- Check database connection

### CORS errors
- Add frontend URL to FastAPI CORS allowed origins
- Ensure credentials are included in fetch requests

## Next Steps

1. Add email verification (set `requireEmailVerification: true`)
2. Implement OAuth (Google, GitHub)
3. Add password reset flow
4. Implement refresh tokens for long sessions
5. Add user profile page with preference management

See [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) for development practices.
