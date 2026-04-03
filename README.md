# AI Agents Platform

Project foundation for a multi-tenant Next.js + Payload CMS application.

## Prerequisites

- Node.js 20.9+ (or 22 LTS)
- pnpm
- Neon PostgreSQL database
- Cloudflare R2 bucket and API credentials

## Local setup

1. Clone and install:

```bash
git clone <repo-url>
cd <project-root>
pnpm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Set required values in `.env`:

- `APP_URL`
- `PAYLOAD_SECRET`
- `DATABASE_URL`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Set local seeding values:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

3. Run migrations:

```bash
pnpm payload migrate
```

4. Start the app:

```bash
pnpm dev
```

5. Seed the first admin user (in a second terminal while the app is running):

```bash
pnpm seed:admin
```

6. Verify:

- `http://localhost:3000/` responds
- `http://localhost:3000/admin` shows Payload login
- `http://localhost:3000/login` loads owner login page

## Useful scripts

- `pnpm dev` - start development server
- `pnpm payload migrate` - run Payload migrations
- `pnpm seed:admin` - create first admin user
- `pnpm typecheck` - TypeScript checks
- `pnpm lint` - lint checks
