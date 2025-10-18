# Database Incident Report - October 18, 2025

## Executive Summary

**Severity**: CRITICAL
**Impact**: User authentication tables dropped, all sessions lost
**Status**: RESOLVED with safeguards implemented
**Root Cause**: Alembic autogenerate incorrectly flagged Better Auth tables for deletion

---

## Timeline

### 22:01:13 UTC - Incident Start
- Migration `82233f5589d3_add_research_report_streaming_fields.py` generated
- Alembic autogenerate included DROP commands for 11 critical tables

### 22:01-22:04 UTC - Migration Applied
- Migration executed via `alembic upgrade head`
- Following tables were DROPPED:
  - `session` - User sessions
  - `account` - OAuth provider accounts
  - `verification` - Email verification tokens
  - `sessions` - Alternative sessions table
  - `accounts` - Alternative accounts table
  - `verification_tokens` - Verification tokens
  - `user` - Better Auth user table
  - `pinned_stocks` - User pinned stocks
  - `user_api_keys` - User API keys
  - `openai_usage` - Usage tracking

### 22:04-22:10 UTC - Impact Discovered
- Frontend auth endpoint began returning 500 errors
- Error: `relation "session" does not exist`
- All user sessions invalidated
- OAuth login broken

### 22:10-22:13 UTC - Resolution
- Tables manually recreated with correct schemas
- `users` table updated with Better Auth columns
- Auth functionality restored

---

## Root Cause Analysis

### Why It Happened

1. **Architecture Issue**: Database shared by two systems
   - Backend: FastAPI with SQLAlchemy/Alembic migrations
   - Frontend: Next.js with Better Auth ORM

2. **Alembic Limitation**: Only knows about SQLAlchemy models
   - Better Auth tables created outside of Alembic
   - Alembic saw "orphaned" tables and assumed they should be removed

3. **Missing Safeguards**: No protection against dropping unmanaged tables

### Migration File Analysis

```python
def upgrade() -> None:
    # Lines 23-41: Dangerous DROP commands auto-generated
    op.drop_table('session')
    op.drop_table('account')
    op.drop_table('verification')
    # ... 8 more DROP commands

    # Lines 42-54: Intended changes (research_reports columns)
    op.add_column('research_reports', sa.Column('status', ...))
    # ... actual migration
```

**Critical Failure**: Migration review process not followed

---

## Data Loss Assessment

### Lost Data
- All active user sessions
- OAuth account linkages (can be recreated on next login)
- Email verification states
- Pinned stocks configurations
- User API keys
- OpenAI usage history

### Preserved Data
- User accounts (`users` table - different from Better Auth `user` table)
- All stock data
- Reddit posts and comments
- Research reports
- News articles

### Impact
- **Users**: Required to re-authenticate
- **Development**: No production data lost (dev environment)
- **Operations**: ~10 minutes of downtime for auth features

---

## Safeguards Implemented

### 1. SQLAlchemy Models for Better Auth Tables (FINAL SOLUTION)

**File**: `backend/shared/models/auth.py`

Created SQLAlchemy models that reflect Better Auth's existing schema:

```python
class BetterAuthUser(Base):
    """Better Auth user table - managed by Better Auth library."""
    __tablename__ = "user"
    __table_args__ = {'extend_existing': True}
    # ... full schema matching Better Auth

class BetterAuthSession(Base):
    """Better Auth session table - managed by Better Auth library."""
    __tablename__ = "session"
    __table_args__ = {'extend_existing': True}
    # ... full schema

# Plus: BetterAuthAccount, BetterAuthVerification,
#       PinnedStock, UserApiKey, OpenAIUsage
```

**File**: `backend/shared/models/__init__.py`

Imported all Better Auth models:
```python
from .auth import (
    BetterAuthUser,
    BetterAuthSession,
    BetterAuthAccount,
    BetterAuthVerification,
    PinnedStock,
    UserApiKey,
    OpenAIUsage,
)
```

**File**: `backend/api-gateway/alembic/env.py`

Updated imports to include Better Auth models:
```python
from shared.models import (
    User,
    Stock,
    RedditPost,
    # ... other models ...
)
# NOTE: Better Auth tables are now tracked in shared/models/auth.py
# This ensures Alembic knows about them and won't try to drop them.
```

**Protection Level**: Alembic now tracks these tables through SQLAlchemy models
**Key Feature**: `extend_existing=True` prevents recreation, only tracks schema

### 2. Migration Created

**File**: `backend/api-gateway/alembic/versions/67081baba4ef_add_pinned_stocks_user_api_keys_and_.py`

Created migration to add the three missing tables:
- `pinned_stocks` - User pinned stocks
- `user_api_keys` - Encrypted OpenAI API keys
- `openai_usage` - Usage tracking

This migration was applied successfully without any DROP commands.

### 3. Automated Backup Script

**File**: `backend/scripts/backup-db.sh`

```bash
./scripts/backup-db.sh [backup_name]
```

- Creates compressed SQL dumps
- Auto-rotates (keeps last 10)
- Required before migrations

### 4. Safe Migration Script

**File**: `backend/scripts/safe-migrate.sh`

```bash
./scripts/safe-migrate.sh <migration_id>
```

Enforces:
- ✅ Migration file review displayed
- ✅ Automatic backup before migration
- ✅ Detection of DROP operations
- ✅ Explicit confirmation required
- ✅ Recovery instructions provided

### 5. Restore Script

**File**: `backend/scripts/restore-db.sh`

```bash
./scripts/restore-db.sh backups/backup_file.sql.gz
```

Quick recovery from backups

### 6. Documentation

Created:
- `MIGRATION_SAFETY.md` - Comprehensive safety guidelines
- `DATABASE_INCIDENT_REPORT.md` - This document
- Inline comments in migration files

---

## Prevention Checklist

Before running ANY future migration:

- [ ] Review migration file manually
- [ ] Check for any `op.drop_table()` or `op.drop_column()` commands
- [ ] Verify protected tables list is current
- [ ] Create backup: `./scripts/backup-db.sh`
- [ ] Use safe migration script: `./scripts/safe-migrate.sh <id>`
- [ ] Test on development data first
- [ ] Never auto-run migrations in CI/CD

---

## Lessons Learned

### What Went Wrong
1. ❌ Trusted Alembic autogenerate without review
2. ❌ No backup before migration
3. ❌ Mixed ORM systems sharing same database
4. ❌ No safeguards against dropping unmanaged tables

### What Went Right
1. ✅ Caught in development environment
2. ✅ Quick identification of root cause
3. ✅ Complete recovery within 10 minutes
4. ✅ Comprehensive safeguards implemented

### Future Improvements
1. ~~Add Better Auth tables to SQLAlchemy models (read-only)~~ ✅ COMPLETED
2. Set up automated daily backups
3. Add pre-commit hooks to review migrations
4. Create staging environment for migration testing
5. Consider database replication for disaster recovery

---

## Testing Verification

Post-incident verification:

```bash
# Test 1: Create SQLAlchemy models for Better Auth tables
# Created /backend/shared/models/auth.py with models for:
# - BetterAuthUser, BetterAuthSession, BetterAuthAccount, BetterAuthVerification
# - PinnedStock, UserApiKey, OpenAIUsage
# Result: Models created with extend_existing=True ✅

# Test 2: Import models in Alembic env.py
# Updated /backend/api-gateway/alembic/env.py
# Result: Alembic now tracks Better Auth tables ✅

# Test 3: Verify autogenerate doesn't drop Better Auth tables
docker-compose exec api-gateway alembic revision --autogenerate -m "Test protection"
# Result: NO DROP commands for Better Auth tables ✅
# Autogenerate correctly detected missing tables (pinned_stocks, user_api_keys, openai_usage)

# Test 4: Create and run migration for missing tables
docker-compose exec api-gateway alembic upgrade head
# Result: Successfully created missing tables ✅

# Test 5: Final verification - no unwanted drops
docker-compose exec api-gateway alembic revision --autogenerate -m "Final test"
# Result: ZERO DROP commands for any Better Auth tables ✅
# Only detected differences in legacy 'users' table (expected)

# Test 6: Verify all tables exist
docker-compose exec postgres psql -U akleao -d akleao -c "\dt"
# Result: All tables present ✅
#   - user, session, account, verification (Better Auth core)
#   - pinned_stocks, user_api_keys, openai_usage (Better Auth extensions)

# Test backup/restore
./scripts/backup-db.sh test_backup
./scripts/restore-db.sh backups/test_backup.sql.gz
# Result: Successful ✅

# Test safe migration
./scripts/safe-migrate.sh 67081baba4ef
# Result: Shows warnings, requires confirmation ✅

# Test auth endpoints
curl http://localhost:3000/api/auth/sign-in/social
# Result: 200 OK ✅
```

---

## Sign-off

**Incident Handled By**: Claude (AI Assistant)
**Reported By**: User (discovered auth failure)
**Date**: October 18, 2025
**Status**: RESOLVED

**Confidence Level**: High - Multiple safeguards prevent recurrence
**Risk Assessment**: Low - Protected tables + backup strategy + safe migration workflow

---

## Appendix: Recovery Commands Used

```sql
-- Recreate session table
CREATE TABLE session (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    token TEXT NOT NULL UNIQUE,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate verification table
CREATE TABLE verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate account table
CREATE TABLE account (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP,
    password TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update users table
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN image TEXT;
ALTER TABLE users ADD COLUMN "emailVerified" BOOLEAN DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
```
