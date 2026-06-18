# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Start all services (postgres, redis, backend, frontend)
docker compose up -d --build

# Seed demo data (alice/bob/charlie@test.com, password123)
docker compose exec backend npm run seed

# Run a specific migration manually
docker compose exec -T postgres psql -U spliteasy < backend/src/db/migrations/<name>.sql
```

The app runs at http://localhost:5173 (frontend) and http://localhost:4000 (backend).

## Testing

```bash
# Frontend unit tests (Vitest)
cd frontend && npm test              # all tests
cd frontend && npx vitest run src/lib/__tests__/utils.test.ts  # single file

# Backend unit tests (Jest)
cd backend && npm test               # all tests
cd backend && npx jest src/services/__tests__/balance.test.ts  # single file

# Playwright e2e tests (requires running services)
# The e2e tests hit localhost:5173 (frontend) and localhost:4000 (backend).
# For e2e, run the frontend dev server locally (not Docker) so it proxies API calls correctly:
docker compose stop frontend
cd frontend && VITE_API_URL=http://localhost:4000 npx vite --port 5173 &
cd frontend && npx playwright test    # all e2e tests
cd frontend && npx playwright test e2e/auth.spec.ts  # single spec
```

E2e tests authenticate via `POST /api/auth/test-login` with header `x-test-auth: spliteasy-e2e-test-secret` (see `backend/src/routes/test-auth.ts`).

## Architecture

**Monorepo with two packages** — `backend/` (Express + TypeScript) and `frontend/` (React + Vite + Tailwind/shadcn). No shared packages or build orchestration; each has its own `package.json`.

**Backend request flow:** Express routes (`routes/`) → middleware (`middleware/auth.ts` for JWT, `middleware/validate.ts` for Zod) → raw SQL via `pg` pool (`db/pool.ts`). No ORM.

**Frontend data flow:** Pages (`pages/`) call `api/client.ts` (fetch wrapper with JWT from localStorage) → backend REST API. Auth state lives in a React context (`hooks/use-auth.tsx`). Real-time updates via WebSocket (`hooks/use-realtime.ts` → `backend/services/websocket.ts`).

**Key domain logic:**
- `backend/services/balance.ts` — greedy debt simplification algorithm that minimizes settlement transactions
- `backend/services/exchange-rate.ts` — FX rates from Frankfurter API, cached in `cached_rates` table (24h TTL). Rates are stored as base→target; the frontend inverts them to target→base for expense conversion
- Balance calculations in `routes/groups.ts` (GET /:id) use raw SQL aggregation across expenses, splits, and payments

**Multi-currency:** Groups have `base_currency` and `multi_currency` flag. When multi-currency is enabled, expenses store `currency`, `fx_rate`, and `amount_in_base`. The FX rate sent from frontend is target→base (inverted from the API's base→target format), so `amount_in_base = amount * fx_rate`.

**Migrations:** SQL files in `backend/src/db/migrations/`. `init.sql` runs on first DB creation via Docker entrypoint. Subsequent migrations (002–005) run idempotently on every backend startup via `db/migrate.ts`. New migrations need both a SQL file and a corresponding block in `migrate.ts`.

**Auth:** Google OAuth only (no email/password in production). JWT stored in localStorage, 7-day expiry. E2e tests use a separate test-login endpoint.

## Supported Currencies

13 currencies defined in `frontend/src/lib/currencies.ts` and `backend/src/routes/currencies.ts`. TWD and VND are not supported by the Frankfurter API and will return rate 0 — the frontend guards against this.
