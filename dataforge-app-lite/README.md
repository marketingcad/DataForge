# DataForge — application

This is the **active** DataForge application. (`../dataforge-app/` is a frozen backup and
must not be edited.)

Documentation lives at the repository root:

* [`../README.md`](../README.md) — start here
* [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — system design
* [`../docs/DATA_MODEL.md`](../docs/DATA_MODEL.md) — ERD and schema
* [`../docs/SCRAPING_PIPELINE.md`](../docs/SCRAPING_PIPELINE.md) — scraper and dedup
* [`../docs/API_REFERENCE.md`](../docs/API_REFERENCE.md) — routes and server actions
* [`../docs/CODEBASE_GUIDE.md`](../docs/CODEBASE_GUIDE.md) — file-by-file tour
* [`../docs/OPERATIONS.md`](../docs/OPERATIONS.md) — env, deploy, backup, troubleshooting
* [`../CLAUDE.md`](../CLAUDE.md) — ⚠️ the rules that must not be broken silently

## Run it

```bash
npm install
npx playwright install chromium     # only if running scrapes locally
npx prisma generate
npm run dev                          # tsx server.ts -> http://localhost:3000
```

Requires `.env.local` with at least `DATABASE_URL` (Supabase transaction pooler, port
6543) and `AUTH_SECRET`. See [`../docs/OPERATIONS.md`](../docs/OPERATIONS.md#1-environment-variables).

> Quit the DataForge desktop app before running the dev server — both bind port 3000, and
> the desktop app serves a pre-built bundle.
