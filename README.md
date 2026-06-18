# SplitEasy 🍕

A full-stack **Splitwise clone** for splitting expenses with friends. Built with Docker Compose, Express.js, React, PostgreSQL, Redis, and shadcn/ui.

> **Live demo:** [splitwise.johnathanwwh.com](https://splitwise.johnathanwwh.com)
> **Author:** [@wong-johnathan](https://github.com/wong-johnathan)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Docker Compose                    │
│                                                      │
│  Browser ──► frontend:5173 ──► backend:4000         │
│                                  │        │         │
│                                  ├──► postgres:5432 │
│                                  └──► redis:6379    │
└─────────────────────────────────────────────────────┘
```

| Service | Tech | Port |
|---------|------|------|
| **Frontend** | React 19 + Vite + Tailwind CSS + shadcn/ui | `:5173` |
| **Backend** | Express.js + TypeScript | `:4000` |
| **Database** | PostgreSQL 16 | `:5432` |
| **Cache** | Redis 7 (optional — non-fatal if unavailable) | `:6379` |

**Key design decisions:**
- **No Next.js.** Simple SPA + REST API keeps the stack clean and easy to extend.
- **JWT auth** (bcrypt + jsonwebtoken) — no external OAuth dependency.
- **Raw SQL** migrations via `docker-entrypoint-initdb.d` — zero ORM overhead.
- **Debt simplification** algorithm minimises the number of transactions needed to settle a group.

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with Compose v2+)
- Git

### 1. Clone & start

```bash
git clone https://github.com/wong-johnathan/splitwise.git
cd splitwise
docker compose up -d --build
```

On first run this builds the backend and frontend images, pulls PostgreSQL and Redis, runs the migration, and starts everything. Wait ~30 seconds for the database health check to pass.

### 2. Seed demo data (optional)

```bash
docker compose exec backend npm run seed
```

This creates three users and a shared group with expenses:

| User | Email | Password |
|------|-------|----------|
| Alice | `alice@test.com` | `password123` |
| Bob | `bob@test.com` | `password123` |
| Charlie | `charlie@test.com` | `password123` |

### 3. Open the app

Visit **[http://localhost:5173](http://localhost:5173)**

---

## Quick Tour

### 1. Register an account

Open the app and toggle to **Register**. Sign up with any email, name, and password (min 6 chars).

### 2. Create a group

Click **New Group** → name it "Trip to Bali" → create. You're automatically added as the first member.

### 3. Add expenses

Click into a group → **Add Expense**.

- **Equal split** (default): enter an amount and it's split evenly among all members.
- **Custom split**: manually assign how much each person owes.

### 4. View balances

The group detail page shows:
- Each member's net balance (green = owed money, red = owes money)
- Simplified "who owes whom" debts
- Full expense list with per-person splits

### 5. Settle up

Click **Settle Up** → select a debt → record the payment. Payment history is tracked for transparency.

---

## API Reference

All endpoints return JSON. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create account — `{ email, name, password }` |
| `POST` | `/api/auth/login` | Sign in — `{ email, password }` |
| `GET` | `/api/auth/me` | Get current user profile (protected) |

### Groups

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/groups` | List user's groups (with balances) |
| `POST` | `/api/groups` | Create group — `{ name, description?, memberIds? }` |
| `GET` | `/api/groups/:id` | Group detail with members, balances, and debts |

### Expenses

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/expenses?groupId=X` | List expenses in a group |
| `POST` | `/api/expenses` | Create expense — `{ groupId, description, amount, splitMethod?, paidBy?, splits? }` |
| `DELETE` | `/api/expenses/:id` | Delete expense (only the payer) |

### Payments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/payments?groupId=X` | List payment history |
| `POST` | `/api/payments` | Record payment — `{ groupId, toUser, amount, note? }` |

### Health

```bash
curl http://localhost:4000/api/health
# → { "status": "ok", "database": "connected" }
```

---

## Project Structure

```
backend/src/
├── index.ts                  # Express app entry point
├── config.ts                 # Environment variable validation (Zod)
├── db/
│   ├── pool.ts               # pg Pool singleton
│   ├── seed.ts               # Demo data seeder
│   └── migrations/init.sql   # Auto-run on postgres init
├── middleware/
│   ├── auth.ts               # JWT verification (requireAuth / optionalAuth)
│   └── validate.ts           # Zod request body validation
├── routes/
│   ├── auth.ts               # /api/auth routes
│   ├── groups.ts             # /api/groups routes
│   ├── expenses.ts           # /api/expenses routes
│   └── payments.ts           # /api/payments routes
└── services/
    ├── auth.ts               # bcrypt hashing + JWT signing
    ├── balance.ts            # Debt simplification algorithm
    └── redis.ts              # Redis caching layer

frontend/src/
├── App.tsx                   # Router config (6 routes)
├── main.tsx                  # React entry point
├── index.css                 # Tailwind + shadcn CSS variables
├── api/client.ts             # Fetch wrapper with JWT injection
├── hooks/use-auth.ts         # Auth context + provider
├── components/
│   ├── ui/                   # shadcn components (Button, Card, Input, etc.)
│   ├── auth/ProtectedRoute.tsx
│   └── layout/Navbar.tsx
└── pages/
    ├── Login.tsx              # Register/Login form with toggle
    ├── Dashboard.tsx          # Groups overview + total balance
    ├── NewGroup.tsx           # Create group form
    ├── GroupDetail.tsx        # Group expenses, balances, debts
    ├── NewExpense.tsx         # Expense creation with split selector
    └── SettleUp.tsx           # Record payments + history
```

---

## Development

### Hot reload

Both backend and frontend use file-watching in development:

- **Backend:** `tsx watch` restarts Express on file changes (mounted via volume)
- **Frontend:** Vite's HMR updates the browser instantly

Edit files in `backend/src/` or `frontend/src/` — changes take effect automatically.

### Running without Docker

```bash
# Backend
cd backend
npm install
# Start postgres and redis manually, then:
DATABASE_URL=postgres://... REDIS_URL=redis://... JWT_SECRET=dev npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Adding a migration

1. Add a new SQL file in `backend/src/db/migrations/`
2. The `init.sql` only runs on first DB creation. For subsequent migrations, run manually:

```bash
docker compose exec -T postgres psql -U spliteasy < backend/src/db/migrations/<your-migration>.sql
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://spliteasy:spliteasy_dev@postgres:5432/spliteasy` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `JWT_SECRET` | `dev-secret-do-not-use-in-production` | JWT signing key (change in production!) |
| `PORT` | `4000` | Backend listen port |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Orchestration** | Docker Compose |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Backend** | Express.js + TypeScript + pg + Zod |
| **Frontend** | React 19 + Vite + TypeScript |
| **UI** | Tailwind CSS + shadcn/ui |
| **Auth** | JWT (jsonwebtoken + bcrypt) |
| **API** | REST (JSON) |

---

## Database Schema

```
users ──┬── groups (created_by)
         ├── group_members
         ├── expenses (paid_by)
         ├── expense_splits
         └── payments (from_user / to_user)
```

Key tables:
- **users** — email/password JWT auth
- **groups** — expense-sharing groups
- **group_members** — many-to-many user↔group
- **expenses** — transactions with split method (equal/custom)
- **expense_splits** — per-person share of each expense
- **payments** — settle-up records

---

## Future Ideas

- [x] Google OAuth
- [x] Real-time updates via WebSockets
- [ ] Receipt photo uploads
- [ ] Recurring expenses (rent, subscriptions)
- [x] Spending breakdown charts
- [x] Multi-currency with FX rates
- [ ] Email invite system
- [ ] Dark mode
- [ ] Export to CSV

---

## License

MIT
