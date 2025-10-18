# Better Auth Setup Guide

## Overview

I've integrated Better Auth with Google OAuth for authentication. Here's what's been set up and what you need to do to complete the configuration.

## What's Been Configured

### 1. Dependencies Installed
- `better-auth` - Authentication library
- `pg` - PostgreSQL client for Better Auth

### 2. Files Created/Modified

#### Auth Configuration (`lib/auth.ts`)
- Better Auth server configuration
- PostgreSQL database connection
- Google OAuth provider setup

#### Auth Client (`lib/auth-client.ts`)
- Client-side auth helpers
- Exports `useSession`, `signIn`, `signOut` hooks

#### Auth API Route (`app/api/auth/[...all]/route.ts`)
- Handles all auth requests (sign in, sign out, callbacks, etc.)

#### Sign-In Page (`app/sign-in/page.tsx`)
- Beautiful sign-in page with Google OAuth button

#### Updated Components
- `components/nav-user.tsx` - Now shows authenticated user or "Sign In" button
- `components/app-sidebar.tsx` - Updated to use new NavUser component

## Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if prompted:
   - User Type: External (for testing) or Internal (for organization)
   - App name: "Akleao Finance"
   - User support email: Your email
   - Developer contact: Your email
6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: "Akleao Finance Web"
   - Authorized JavaScript origins:
     - `http://localhost:3000`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
7. Click **Create**
8. Copy your **Client ID** and **Client Secret**

### Step 2: Update Environment Variables

Add these to your `.env.local` file:

```bash
# Database (connect to your running PostgreSQL)
DATABASE_URL=postgresql://akleao:akleao_dev_password@localhost:5432/akleao

# Google OAuth Credentials (from Step 1)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### Step 3: Create Auth Database Tables

Better Auth needs specific tables in your PostgreSQL database. Run these SQL commands:

```sql
-- Connect to your database
psql postgresql://akleao:akleao_dev_password@localhost:5432/akleao

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create accounts table (for OAuth providers)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, account_id)
);

-- Create verification tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
```

Or you can run from command line:

```bash
cd backend
docker-compose exec postgres psql -U akleao -d akleao -f - <<'EOF'
-- Paste the SQL commands above
EOF
```

## How Authentication Works

### User Flow:

1. **Unauthenticated User**:
   - Sees "Sign In" button in the sidebar
   - Clicking it navigates to `/sign-in`

2. **Sign In Page**:
   - User clicks "Continue with Google"
   - Redirected to Google OAuth consent screen
   - After approval, redirected back to app with auth token

3. **Authenticated User**:
   - Sidebar shows user's name, email, and avatar
   - Can access all features
   - Click "Log out" to sign out

### For Developers:

#### Check if user is authenticated:
```tsx
import { useSession } from "@/lib/auth-client";

function MyComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Please sign in</div>;

  return <div>Welcome {session.user.name}!</div>;
}
```

#### Protect a page:
```tsx
"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  if (isPending) return <div>Loading...</div>;
  if (!session) return null;

  return <div>Protected content</div>;
}
```

## Next Steps

### Optional: Protect Admin Routes

You can add authentication requirements to admin pages by checking the session:

```tsx
// app/admin/page.tsx
"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  if (isPending) return <div>Loading...</div>;
  if (!session) return null;

  // Rest of your admin page code
}
```

## Testing

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Click "Sign In" in the sidebar
4. Click "Continue with Google"
5. Sign in with your Google account
6. You should be redirected back to the homepage, now authenticated!

## Troubleshooting

### "redirect_uri_mismatch" error
- Make sure your Google OAuth redirect URI exactly matches: `http://localhost:3000/api/auth/callback/google`
- No trailing slash
- Must use `http://` for localhost (not `https://`)

### Database connection errors
- Ensure PostgreSQL is running: `cd backend && docker-compose ps`
- Check DATABASE_URL in `.env.local` matches your database credentials

### Session not persisting
- Clear your browser cookies
- Check that DATABASE_URL is correctly set
- Verify auth tables were created successfully

## Security Notes

- Never commit `.env.local` to git (it's in `.gitignore`)
- Google Client Secret should be kept secret
- For production, use environment variables in your hosting platform
- Enable HTTPS in production and update redirect URIs accordingly
