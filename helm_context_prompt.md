# Helm — Personal Finance Dashboard
## Claude Code Session Context

You are helping me build **Helm**, a personal finance dashboard PWA for household use (2 users: me and my wife). Before writing any code, follow the setup checklist at the bottom of this prompt.

---

## The App

Helm is a self-hosted personal finance dashboard that aggregates all household bank, brokerage, investment, and crypto accounts into a single beautiful, interactive UI. It is a fully shared household app — all financial data is shared between both users, with no per-user data separation on financial records.

---

## Full Confirmed Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite (PWA) |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion + Recharts + react-countup + AutoAnimate |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL via Neon |
| ORM | Drizzle ORM |
| Auth | Neon Auth (Better Auth) |
| Plaid | `plaid-node` official SDK |
| Crypto | Coinbase API (direct — do NOT use Plaid for Coinbase) |
| Hosting | Self-hosted + Tailscale + Cloudflare Tunnel |
| V3 Future | React Three Fiber |

---

## Accounts to Link

| Institution | Type | Method | Notes |
|---|---|---|---|
| Wells Fargo | Bank | Plaid | ✅ Well supported |
| Chase | Credit card (Prime Visa) | Plaid | ✅ Well supported |
| USAA | Bank | Plaid | ⚠️ Test early — finicky with MFA |
| Raisin (NexBank) | High-yield savings | Plaid → fallback CSV | ⚠️ Verify Plaid coverage in sandbox first |
| Schwab | Brokerage + IRA | Plaid Investments | ✅ Good coverage |
| Ascensus | 401k | Plaid → fallback manual | ⚠️ Inconsistent — plan for manual entry fallback |
| Coinbase | Crypto | Coinbase API (direct) | Use official Coinbase API, not Plaid |

---

## V1 Features (Build First)
1. All accounts linked via Plaid + Coinbase API
2. Dashboard — net worth summary, account cards, balances
3. Transactions view — all transactions across all accounts, filterable/searchable
4. Investments view — holdings, performance (Schwab + Coinbase)
5. Activity log — tracks which user performed which action (linked account, created budget, etc.)

## V2 Features (Build After V1 is Solid)
1. Budgeting tools
2. Alpaca API — SPY / market data widget
3. Financial news API (Finnhub free tier or similar)
4. Recurring payment reminders (push notifications via PWA service worker)
5. Credit card payment reminders

## V3 Features (Future — Do Not Build Yet)
- React Three Fiber — 3D visuals, animated backgrounds, immersive data viz

---

## Data Architecture

### Ownership Model
- **Fully shared household data** — accounts, transactions, holdings, budgets all exist at the household level
- **No `user_id` foreign key on financial tables** — all users see all data
- **Per-user only:** identity (Neon Auth `neon_auth.users` table)

### Core Tables (Drizzle + Postgres)
```
accounts          — institution, name, type, mask, current_balance, plaid_item_id
transactions      — account_id, date, amount, merchant, category, pending
holdings          — account_id, ticker, quantity, cost_basis, market_value
investment_txns   — account_id, date, type (buy/sell/dividend), ticker, amount
plaid_items       — item_id, access_token (encrypted), institution_name, institution_id
recurring_items   — name, amount, due_day, category, account_id (V2)
budgets           — category, monthly_limit, period (V2)
activity_log      — user_id, action, metadata (jsonb), created_at
```

### Activity Log Details
The `activity_log` table records all meaningful user actions for household transparency. Log entries should be created for:
- Linking or unlinking a financial account
- Manually refreshing/syncing data
- Creating, editing, or deleting a budget
- Adding or removing a recurring item
- Any admin-level action

---

## Project Structure
```
helm/
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── plaid.ts
│   │   │   ├── accounts.ts
│   │   │   ├── transactions.ts
│   │   │   ├── investments.ts
│   │   │   └── activity.ts
│   │   ├── services/
│   │   │   ├── plaid.service.ts
│   │   │   ├── sync.service.ts
│   │   │   └── coinbase.service.ts
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   └── middleware/
│   │       └── auth.ts
│   ├── .env
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Transactions.tsx
│   │   │   ├── Accounts.tsx
│   │   │   └── Investments.tsx
│   │   ├── components/
│   │   │   ├── NetWorthChart.tsx
│   │   │   ├── SpendingByCategory.tsx
│   │   │   └── AccountCard.tsx
│   │   ├── auth.ts
│   │   └── main.tsx
│   ├── .env
│   └── package.json
│
└── docker-compose.yml
```

---

## Environment Variables

### Backend `.env`
```
# Neon Postgres
DATABASE_URL=

# Neon Auth (Better Auth)
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=

# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

# Coinbase
COINBASE_API_KEY=
COINBASE_API_SECRET=

# App
PORT=3001
JWT_SECRET=
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:3001
VITE_NEON_AUTH_URL=
```

---

## Agent Setup Checklist
**Before writing any application code, work through this checklist with me interactively:**

1. **Confirm env variables**
   - Ask me if I have the following ready. For any I don't have, tell me exactly where to get them before continuing:
     - [ ] `DATABASE_URL` — from Neon Console → Project → Connection Details
     - [ ] `NEON_AUTH_BASE_URL` — from Neon Console → Project → Branch → Auth → Configuration
     - [ ] `NEON_AUTH_COOKIE_SECRET` — generate by running `openssl rand -base64 32`
     - [ ] `PLAID_CLIENT_ID` and `PLAID_SECRET` — from Plaid Dashboard → Team Settings → Keys
     - [ ] `PLAID_ENV` — start with `sandbox`
     - [ ] `JWT_SECRET` — generate by running `openssl rand -base64 64`
     - [ ] `COINBASE_API_KEY` and `COINBASE_API_SECRET` — can be deferred to later

2. **Confirm Neon Auth is enabled**
   - Ask me to confirm that the Auth tab is visible and enabled in my Neon project console
   - Remind me that Neon Auth is currently in Beta and has open signups by default — I should enable email verification to restrict access

3. **Confirm Plaid is in sandbox mode**
   - Remind me that all development should use `PLAID_ENV=sandbox` until all accounts are verified working
   - Plaid sandbox has test credentials I can use to simulate bank logins

4. **Scaffold the project**
   - Only after the above is confirmed, begin scaffolding the monorepo structure
   - Start with: monorepo root, backend scaffold (Express + TypeScript), frontend scaffold (React + Vite + Tailwind), shared `package.json` configs
   - Do NOT write application logic yet — just the skeleton

---

## Key Decisions Already Made
- **Auth:** Neon Auth (Better Auth) — NOT custom JWT, NOT Clerk
- **Crypto:** Coinbase API direct — NOT Plaid for Coinbase
- **Database:** Drizzle ORM — NOT Prisma (intentional — I want to learn Drizzle)
- **Hosting:** Self-hosted with Tailscale + Cloudflare Tunnel for remote access and Plaid webhooks
- **Data model:** Fully shared household — no per-user financial data filtering
- **Activity log:** Yes — include from V1

---

## Notes & Gotchas
- USAA is finicky with third-party aggregators — test it early in sandbox, have a fallback plan
- Raisin connects through NexBank — verify Plaid coverage before committing
- Ascensus (401k) has inconsistent Plaid coverage — plan for manual entry or CSV import fallback
- Neon Auth open signup issue — enable email verification as a short-term access restriction until Neon ships built-in signup restrictions
- Neon free tier: projects pause after 1 week of inactivity — unpause from Neon Console if needed (resumes in ~30 seconds)
- Cloudflare Tunnel (free) is needed to give Plaid webhooks a public URL without exposing home network ports
- All Plaid access tokens must be stored encrypted in the database — never in plaintext
