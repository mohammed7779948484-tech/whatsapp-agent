# Quickstart: Project Foundation

**Branch**: `001-project-foundation`
**Date**: 2026-04-02

## Prerequisites

- Node.js 20.9+ or 22 LTS installed
- pnpm (recommended) or npm
- A Neon PostgreSQL database provisioned with connection string available
- A Cloudflare R2 bucket created with S3-compatible API credentials available
- Git

## Setup Steps

### 1. Clone and install

```bash
git clone <repo-url>
cd <project-root>
pnpm install
```

### 2. Configure environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Required variables for Phase 1:

| Variable | What to set |
|----------|-------------|
| `APP_URL` | `http://localhost:3000` |
| `PAYLOAD_SECRET` | A random string, minimum 32 characters |
| `DATABASE_URL` | Your Neon pooled connection string |
| `R2_ENDPOINT` | Your R2 S3-compatible endpoint URL |
| `R2_ACCESS_KEY_ID` | Your R2 API token ID |
| `R2_SECRET_ACCESS_KEY` | Your R2 API token secret |
| `R2_BUCKET` | Your R2 bucket name |

### 3. Run database migrations

```bash
pnpm payload migrate
```

This will:
- Create all Payload collection tables
- Enable the `pgvector` extension

### 4. Start the development server

```bash
pnpm dev
```

The application should start within 30 seconds.

### 5. Create the first admin user

```bash
pnpm seed:admin
```

Run this in a second terminal while the app is running. If the admin bootstrap already happened, the script exits successfully and tells you to use the existing account.

Or use the Payload Admin panel's first-user registration flow on first boot.

### 6. Verify the setup

| Check | How | Expected |
|-------|-----|----------|
| App is running | Visit `http://localhost:3000/api/health` | `{ "status": "ok" }` |
| Database is connected | Visit `http://localhost:3000/api/health/ready` | `{ "status": "ready" }` |
| Admin panel works | Visit `http://localhost:3000/admin` | Payload Admin login screen |
| Login as admin | Enter admin credentials | Admin dashboard loads |
| Create owner account | Admin panel → Users → Create → role: owner | User created |
| Owner can log in | Visit `http://localhost:3000/login` → enter owner credentials | Dashboard placeholder loads |

### 7. Run tests

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Baseline test suite
pnpm test
```

All should pass with zero errors on a clean setup.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App fails to start with "Missing required environment variable" | Check `.env` — the error message names the specific missing variable |
| Database connection refused | Verify `DATABASE_URL` is correct and Neon instance is running |
| R2 storage error | Verify R2 credentials and endpoint URL in `.env` |
| Admin panel returns 404 | Ensure `src/app/(payload)/admin/[[...segments]]/page.tsx` exists |
| pgvector not available | Run `pnpm payload migrate` to enable the extension |

## Next Steps

After confirming all checks pass, the project is ready for Phase 2 (Database Setup) where the full domain collections (workspaces, agents, knowledge_files, etc.) will be created.
