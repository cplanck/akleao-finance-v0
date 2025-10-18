# Migration Safety Guidelines

## ⚠️ CRITICAL: Always Review Migrations Before Running

Alembic autogenerate can make dangerous assumptions. **NEVER** run a migration without reviewing it first.

## The Problem

Alembic only knows about tables defined in SQLAlchemy models. If you have tables created by:
- Better Auth (session, account, verification, user)
- Other ORMs or tools
- Manual SQL scripts

Alembic will think these are "orphaned" and try to DROP them!

## Incident Log

### October 18, 2025 - Auth Tables Dropped
- **What happened**: Migration `82233f5589d3` auto-generated DROP commands for Better Auth tables
- **Impact**: All user sessions, accounts, and verification tokens were deleted
- **Root cause**: Better Auth tables not tracked in Alembic models
- **Resolution**: Manually recreated tables, added to ignore list

## Mandatory Safety Checklist

Before running ANY migration:

### 1. Review the Migration File
```bash
# After generating migration
cat api-gateway/alembic/versions/{migration_file}.py
```

Look for ANY `op.drop_table()` or `op.drop_column()` commands. Question every one.

### 2. Check for Ignored Tables
See `env.py` for the list of tables that Alembic should NEVER touch.

### 3. Test on Development Data First
```bash
# Backup first!
docker-compose exec postgres pg_dump -U akleao akleao > backup.sql

# Then run migration
docker-compose exec api-gateway alembic upgrade head
```

### 4. Never Auto-Apply in Production
Migrations should be reviewed by a human before being applied to production databases.

## Tables That Must NEVER Be Dropped

These are managed outside of Alembic:

### Better Auth Tables (Frontend)
- `user` - Better Auth user table (different from backend `users`)
- `session` - User sessions
- `account` - OAuth provider accounts
- `verification` - Email verification tokens
- `sessions` - Alternative session table name
- `accounts` - Alternative accounts table name
- `verification_tokens` - Alternative verification table name

### User-Specific Tables (Frontend)
- `pinned_stocks` - User's pinned stocks
- `user_api_keys` - Encrypted API keys per user
- `openai_usage` - Usage tracking

## How to Prevent This

### Option 1: Add to Alembic Ignore List
Edit `alembic/env.py` and add tables to `include_object` filter.

### Option 2: Create SQLAlchemy Models
Create read-only models for these tables so Alembic knows about them.

### Option 3: Manual Migration Review
Always review and edit auto-generated migrations before running them.

## Recovery from Data Loss

If tables were dropped:

```bash
# Restore from backup
docker-compose exec postgres psql -U akleao akleao < backup.sql

# Or recreate tables manually
docker-compose exec postgres psql -U akleao akleao -c "CREATE TABLE session (...)"
```

## Best Practices

1. **Always backup before migrations**
2. **Review every migration file manually**
3. **Never run `alembic upgrade head` without reading the migration first**
4. **Test migrations on a copy of production data**
5. **Keep a separate backup strategy independent of migrations**
