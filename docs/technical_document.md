# Trading Journal

# Technical Design Document (TDD)

**Version:** 3.0
**Status:** Living document — describes the implemented local-first system

> **How to read this document.** This document describes how the application is
> actually built. Where a design is not implemented yet it is tagged
> **[Planned]**. The companion [business requirements](./business_requirements.md)
> describe the product; the [entity diagram](./entity_diagram.svg) shows the
> schema.

---

# 1. Overview

## Purpose

Trading Journal is a single-page application for recording and analysing
completed trades. It runs entirely in the browser: there is no API, no server
database, no authentication, and no network request for journal data.

## Design goals

* **Local-first.** A trade is written to the browser's IndexedDB and is read
  directly from the device without a network request. Data never leaves the
  device.
* **No account, no backend.** Opening the app is the only onboarding step.
* **One source of truth for rules.** Validation and P/L derivation live in the
  data layer, not only in form components.
* **Typed end to end.** Shared model types, a typed IndexedDB schema, and
  TypeScript strictness across the SPA.
* **Static deployability.** The build output is plain HTML, CSS, JS, and fonts
  that any static host can serve.
* **Predictable derivation.** Stored trades carry derived commission and P/L so
  reads and analytics do not recompute them differently in each view.
* **No unnecessary infrastructure.** No server, container database, queue,
  cache, or external service.

## Non-goals

* Multi-user access or authorization.
* Cloud sync or multi-device sync.
* Trade execution, broker connectivity, or live market data.

---

# 2. Technology Stack

| Technology | Version | Purpose |
| --- | --- | --- |
| React | 19 | UI |
| TypeScript | 6 | Type safety |
| Vite | 8 | Dev server and production build |
| React Router | 7 | Client-side routing |
| TanStack Query | 5 | Cache for asynchronous local data |
| `idb` | 8 | Promise-based, typed IndexedDB wrapper |
| Tailwind CSS | 4 | Styling |
| Base UI | 1 | Accessible UI primitives (select, dialog, menu, tabs) |
| lucide-react | 1 | Icons |
| Vitest | 5 | Unit and data-layer tests |
| `fake-indexeddb` | 6 | IndexedDB implementation for tests |

## Deliberately not used

* **A backend or API.** There is no server-side business logic to keep in sync.
* **Axios / fetch for journal data.** The data layer reads IndexedDB directly.
* **localStorage for journal data.** It is synchronous, string-only, and small;
  IndexedDB is the appropriate store for structured records.
* **A cloud database.** Privacy and zero-setup operation are more important than
  sync for this release.
* **JWT, sessions, or password hashing.** There are no users to authenticate.

---

# 3. System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│                                                             │
│  React SPA                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ pages / components                                    │  │
│  │        │                                              │  │
│  │        ▼                                              │  │
│  │ hooks (useMarkets, useTrades, useTheme)               │  │
│  │        │                                              │  │
│  │        ▼                                              │  │
│  │ TanStack Query cache                                  │  │
│  │        │                                              │  │
│  │        ▼                                              │  │
│  │ src/db: markets · trades · validation · P/L           │  │
│  └───────────────────────────────────────────────────────┘  │
│                       │                                     │
│                       ▼                                     │
│  IndexedDB database "trading-journal"                       │
│    ├── markets                                              │
│    └── trades                                               │
│                                                             │
│  localStorage: theme preference only                        │
└─────────────────────────────────────────────────────────────┘
```

## Layer responsibilities

| Layer | Responsibility |
| --- | --- |
| `pages/` and `components/` | Presentation, forms, dialogs, tables, charts |
| `hooks/` | Query/mutation wiring, cache invalidation, theme state |
| `lib/` | Pure logic: analytics, breakdowns, time analytics, validation, trade math, formatting, import parsing |
| `db/` | IndexedDB connection, schema, CRUD, transactions, change notifications |
| `types/` | Shared model and input types |

Dependencies point downward only. Components do not open IndexedDB directly, and
the data layer does not import React.

## Browser storage scope

IndexedDB and `localStorage` are scoped to an **origin + browser profile**.
Consequences:

* `http://localhost:5173`, `http://localhost:8080`, and a deployed HTTPS origin
  are separate journals.
* Two tabs on the same origin share one journal.
* Two browser profiles, browsers, or devices do not share data.
* Clearing site data deletes the journal.

## Multi-tab consistency

Every mutation calls `notifyDataChanged()` in `src/db/changeNotifications.ts`.
It:

1. notifies same-tab subscribers immediately, and
2. posts a message on a `BroadcastChannel` named `trading-journal`.

`main.tsx` subscribes once and invalidates the TanStack Query cache when a change
arrives, so another tab's write refreshes the current tab's views. The channel is
skipped when `window` or `BroadcastChannel` is unavailable (for example in
Node-based tests).

---

# 4. Project Structure

```text
TradingJournal/
├── frontend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── changeNotifications.ts
│   │   │   ├── connection.ts
│   │   │   ├── markets.ts
│   │   │   ├── schema.ts
│   │   │   ├── trades.ts
│   │   │   └── journal.test.ts
│   │   ├── hooks/
│   │   │   ├── useMarkets.ts
│   │   │   ├── useTheme.ts
│   │   │   └── useTrades.ts
│   │   ├── lib/
│   │   │   ├── analytics.ts(+test)
│   │   │   ├── analyticsMetrics.test.ts
│   │   │   ├── breakdowns.ts(+test)
│   │   │   ├── timeAnalytics.ts(+test)
│   │   │   ├── datetime.ts
│   │   │   ├── errors.ts
│   │   │   ├── format.ts
│   │   │   ├── tradeImport.ts(+test)
│   │   │   ├── tradeMath.ts(+test)
│   │   │   └── validation.ts(+test)
│   │   ├── components/   layout, dashboard, analytics, markets, trades, theme, ui
│   │   ├── pages/        Dashboard, Analytics, Markets, Trades, NotFound
│   │   ├── router/       createBrowserRouter route table
│   │   ├── types/        shared models
│   │   ├── main.tsx
│   │   └── style.css
│   ├── nginx.conf        static hosting with SPA fallback
│   └── package.json
├── docs/
├── Dockerfile            build static SPA + serve with nginx
├── docker-compose.yml
├── Makefile
└── .github/workflows/ci.yml
```

---

# 5. Data Model

## Stores

IndexedDB database **`trading-journal`**, schema version **1**.

### `markets`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | Primary key, auto-increment |
| `name` | string | Trimmed; unique case-insensitively; max 100 |
| `currency` | string | Uppercase ISO 4217, exactly 3 letters |
| `createdAt` | string | UTC ISO timestamp |
| `updatedAt` | string | UTC ISO timestamp |

### `trades`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number | Primary key, auto-increment |
| `marketId` | number | References `markets.id` |
| `instrument` | string | Trimmed, uppercased, max 20 |
| `direction` | number | `0` = Long, `1` = Short |
| `entryPrice` | number | Non-negative; stored to 4 decimals |
| `exitPrice` | number | Non-negative; stored to 4 decimals |
| `quantity` | number | Positive integer |
| `pointValue` | number | Positive; stored to 4 decimals |
| `entryTime` | string | UTC ISO timestamp |
| `exitTime` | string | UTC ISO timestamp; `>= entryTime` |
| `commissionPerUnit` | number | Per-side rate × 2; non-negative |
| `commission` | number | Derived, stored |
| `profitLoss` | number | Derived, stored |
| `createdAt` | string | UTC ISO timestamp |
| `updatedAt` | string | UTC ISO timestamp |

Indexes: `trades.by-market` (`marketId`) and `trades.by-exit-time` (`exitTime`).
The UI-facing `Trade` type additionally contains `marketName` and `currency`,
which are **joined at read time** rather than stored on the trade.

Full diagram: [entity_diagram.svg](./entity_diagram.svg).

## Relationships and integrity

* `markets` 1 → many `trades`.
* A trade cannot be created or moved to a market that does not exist.
* Deleting a market counts its trades through the `by-market` index and refuses
  when the count is greater than zero.
* Renaming a market or changing its currency needs no trade migration because
  trades join their market when read.
* There are no `users` and no ownership columns.

## Schema evolution

`src/db/connection.ts` opens the database with `openDB(name, version, { upgrade })`.
The `upgrade` callback creates the two object stores and indexes when missing.
Future schema changes increment `DB_VERSION` and add versioned migration steps in
the same callback. Deleting the database (`deleteJournalDatabase`) exists for
tests; no automatic destructive migrations are performed.

---

# 6. Data Layer

## Connection

`getDatabase()` lazily opens the database, caches the promise for the lifetime of
the tab, and returns a typed `IDBPDatabase<TradingJournalDB>`. Concurrent
callers share one connection. If IndexedDB is unavailable or the open fails, the
promise rejects with an `AppError` containing a user-facing explanation.

## Market operations (`src/db/markets.ts`)

| Function | Behaviour |
| --- | --- |
| `listMarkets()` | Reads markets and trades, counts trades per market in memory, returns markets sorted by name |
| `createMarket(input)` | Trims/uppercases, validates, checks case-insensitive uniqueness, inserts, returns the new market |
| `updateMarket(id, input)` | Loads the record, merges partial input, re-validates, re-checks uniqueness, updates `updatedAt` |
| `deleteMarket(id)` | Loads the record, counts its trades, refuses when non-empty, otherwise deletes |

Uniqueness checks load the (small) market list and compare lower-cased names.
This avoids case-insensitive index limitations and keeps the rule explicit.

## Trade operations (`src/db/trades.ts`)

| Function | Behaviour |
| --- | --- |
| `listTrades()` | Reads trades and markets, joins `marketName`/`currency`, sorts by exit time descending |
| `createTrade(input)` | Resolves the market, validates, derives commission/P&L, inserts, returns the joined trade |
| `updateTrade(id, input)` | Loads the record, merges partial input, resolves the (possibly new) market, validates, re-derives commission/P&L, updates `updatedAt` |
| `deleteTrade(id)` | Ensures the record exists, then deletes it |
| `importTrades(input)` | Resolves the market, validates batch metadata and every row, then adds all rows in one transaction |

### Validation before writing

`prepareTradeValues()` in `trades.ts`:

1. trims the instrument,
2. runs the shared `validateTrade()` rules,
3. canonicalizes the instrument to uppercase,
4. rounds money/price fields to four decimals, and
5. converts entry/exit times to UTC ISO strings.

Because validation runs before canonicalization, invalid dates cannot reach
`toISOString()` and throw an unexpected error.

### Import atomicity

`importTrades()` builds and validates the complete array of records **before**
opening the IndexedDB transaction. If any row fails, nothing is written. A valid
batch is added with `Promise.all(records.map(tx.store.add))` followed by
`tx.done`, so the transaction commits as a unit.

## Errors

`src/lib/errors.ts` defines `AppError` for messages that are safe to show in the
UI, plus `getErrorMessage(error)`:

* `AppError` → its message,
* any other `Error` → its message,
* unknown values → a generic fallback.

Forms catch mutation errors and render the message in an `Alert`. Query errors
(database open failures) render on the page.

## Timestamps

* UI: `<input type="datetime-local">` in the browser's timezone
  (`src/lib/datetime.ts`).
* Storage: UTC ISO string (`new Date(value).toISOString()`).
* Display: formatted back into the browser's local timezone.

---

# 7. Derived Values

## Profit/loss

```text
priceMove = direction == Long
              ? (exitPrice − entryPrice) × quantity
              : (entryPrice − exitPrice) × quantity

profitLoss = round4(priceMove × pointValue − commission)
```

## Commission

A round trip is charged on both sides:

```text
commissionPerUnit = round4(commissionPerSide × 2)
commission        = round4(commissionPerUnit × quantity)
```

The import path receives `commissionPerSide` from the export's `meta`; manual
entry receives a per-side value in the form and converts it to a per-unit rate
before saving. There is no hard-coded default rate (the form defaults to zero).

## Rounding

`roundToFour()` in `src/lib/tradeMath.ts` rounds with
`Math.round((value + Number.EPSILON) * 10000) / 10000`. Derived values are stored
rounded, matching the journal's four-decimal display precision and avoiding
floating-point noise in comparisons (`profitLoss > 0`, sorting, equity curves).

## Currency separation

Markets carry one currency and every trade inherits it. Analytics aggregate
monetary metrics **per market** (`calculateStatsForMarket`). The dashboard's
"All markets" view uses `calculateOverallStats`, which returns only counts and
ratios (total trades, wins/losses/break-even, win rate) and has no monetary
fields, so values in different currencies can never be added together.

---

# 8. Frontend Architecture

## Routing

`createBrowserRouter` with:

| Path | Screen |
| --- | --- |
| `/` | Dashboard |
| `/analytics` | Analytics |
| `/markets` | Markets |
| `/trades` | Trades |
| `*` | Not found |

All routes render inside `AppLayout` (sidebar navigation, local-only indicator,
theme toggle). There is no login route, auth provider, or route guard.

## State

* **TanStack Query** caches the asynchronous IndexedDB reads. Query keys:
  `["markets"]` and `["trades"]`.
* Mutations invalidate `["trades"]` and `["markets"]` as appropriate. Market
  mutations also invalidate trades because trades join market name/currency.
* `subscribeToDataChanges()` in `main.tsx` invalidates all queries when another
  tab writes.
* `staleTime` is 30 seconds, `refetchOnWindowFocus` is disabled, and queries
  retry once. Mutations always read/write IndexedDB directly; the cache is only a
  rendering optimization.
* **ThemeProvider / useTheme** store the theme in React state and localStorage.

## Pages

* **Dashboard** — derives market summaries from loaded trades, shows an "All
  markets" or single-market panel, stat cards, equity curve, and the five most
  recent trades.
* **Analytics** — selects one currency (or uses the only currency), then shows
  performance/risk cards, equity and underwater curves, profit concentration,
  direction/instrument/commission/hold-time breakdowns, P/L distribution,
  rolling 20/50-trade metrics, consistency and best/worst periods, weekday and
  entry-hour P/L bars, and a monthly P/L heatmap.
* **Markets** — table with trade counts, create/edit dialogs, and guarded delete.
* **Trades** — filters, sortable table, create/edit dialog, import dialog, and
  guarded delete.
* **Not Found** — static fallback.

## Analytics

Pure functions over the loaded trade array. Monetary functions assume every
trade passed in shares one currency; the page filters by currency before calling
them.

### Core metrics (`src/lib/analytics.ts`)

* `calculateStats(trades)` — totals, wins/losses/break-even, gross profit/loss,
  commission, win rate, averages, profit factor, best/worst, equity curve,
  expectancy, median trade, standard deviation, per-trade Sharpe/Sortino,
  payoff ratio, breakeven win rate, max/current drawdown, underwater curve,
  recovery factor, win/loss streaks, top 1/5/10 profit concentration,
  outlier-excluded P/L, and commission drag.
* `calculateOverallStats(trades)` — currency-independent counts/ratios.
* `calculateStatsForMarket(trades, marketId)` — one market's monetary metrics.
* `getMarketSummaries(trades)` — market selector data from loaded trades.
* `getCurrencySummaries(trades)` — currency selector data with trade/market
  counts.
* `normalizeCurrency()` and `calculateStatsByCurrency()` — currency grouping
  helpers retained for tests and future reports.

### Breakdowns (`src/lib/breakdowns.ts`)

* `calculateDirectionStats(trades)` — long versus short performance.
* `calculateInstrumentStats(trades)` — grouped by market and instrument so the
  same ticker in two currencies is never merged.
* `calculateDurationStats(trades)` — average/median hold time and fixed
  duration buckets.
* `calculatePnlHistogram(trades)` — evenly spaced per-trade P/L bins.
* `calculateRollingMetrics(trades, window)` — rolling win rate, profit factor,
  and expectancy.

### Time analytics (`src/lib/timeAnalytics.ts`)

* `calculateTimeStats(trades)` — daily, weekly, and monthly realized P/L;
  green-period rates; average P/L and trade pace; best/worst periods; P/L by
  local entry weekday and entry hour.
* Local date/week/month/weekday/hour helpers are exported for tests. Realized
  P/L groups by exit date; weekday/hour groups by entry time.

### Analytics UI

`AnalyticsPage` derives one `analytics` object per selected currency, then
renders `PerformanceSection`, `RiskSection`, `BreakdownSection`,
`RollingSection`, and `TimingSection`. Chart components are dependency-free SVG
or CSS (`EquityCurve`, `UnderwaterCurve`, `PnlBarChart`,
`DistributionHistogram`, `MonthlyHeatmap`, `RollingMetricsChart`).

## JSON import (`src/lib/tradeImport.ts`)

`parseTradeExport(unknown)` parses a `TradeReplay`-style object:

* required `trades` array (non-empty), optional `meta`;
* per-row direction (`"long"`/`"short"` or `0`/`1`), positive integer quantity,
  non-negative prices, ordered times;
* ISO strings or Unix seconds for times;
* meta-level `instrument`, `pointValue` (default 1, must be > 0), and
  `commissionPerSide` (default 0, non-negative).

It throws `TradeImportError` with a row-specific message. The import dialog shows
a preview and calls `importTrades()` only after parsing succeeds.

## Theming

Three modes — `light`, `dark`, `system` — are persisted under
`trading-journal-theme`. The resolved theme toggles the `dark` class and
`colorScheme` on `<html>`. An inline script in `index.html` applies the stored
theme before first paint to avoid a flash of the wrong theme; `system` follows
live OS changes through `matchMedia`.

---

# 9. Testing & CI

## Test suite

`pnpm test` runs Vitest:

| File | Coverage |
| --- | --- |
| `src/lib/analytics.test.ts` | Per-currency aggregation, overall counts, market summaries, equity curves |
| `src/lib/analyticsMetrics.test.ts` | Expectancy, deviation, Sharpe/Sortino, drawdown, streaks, concentration, commission drag, currency summaries |
| `src/lib/breakdowns.test.ts` | Direction/instrument/duration breakdowns, histograms, rolling metrics |
| `src/lib/timeAnalytics.test.ts` | Local date keys, daily/weekly/monthly grouping, consistency, best/worst periods, weekday/hour breakdowns |
| `src/lib/tradeImport.test.ts` | Export parsing, fallbacks, invalid files/rows |
| `src/lib/tradeMath.test.ts` | Long/short P/L, commission, rounding |
| `src/lib/validation.test.ts` | Market, trade, and import rules |
| `src/db/journal.test.ts` | Real IndexedDB schema via `fake-indexeddb`: market CRUD, duplicate names, guarded deletion, trade derivation, updates, joins, import atomicity |

The data-layer tests exercise actual transactions and auto-increment keys against
a fresh database per test (`deleteJournalDatabase()` in `beforeEach`).

Other checks:

```text
pnpm lint    ESLint (React hooks + refresh rules)
pnpm build   tsc -b type-check, then Vite production build
```

## Continuous integration

[`ci.yml`](../.github/workflows/ci.yml) runs one job on pushes and pull requests:

1. install pnpm and Node 22,
2. `pnpm install --frozen-lockfile`,
3. `pnpm lint`,
4. `pnpm test`,
5. `pnpm build`,
6. upload `frontend/dist` as a build artifact.

---

# 10. Build & Deployment

## Development

```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:5173
```

No API process or environment variables are required. There is no
`VITE_API_URL` and no `.env` file.

## Production build

```bash
cd frontend
pnpm build
```

Output: `frontend/dist` (HTML, hashed CSS/JS, fonts). Deploy it to any static
host.

**SPA fallback is required.** The host must serve `index.html` for unknown paths
so `/trades` and `/markets` survive a hard refresh. `frontend/nginx.conf`
contains a minimal configuration:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## Docker

The multi-stage `Dockerfile`:

1. builds the SPA in `node:22-slim` with pnpm, and
2. copies `dist` and `nginx.conf` into `nginx:alpine`.

```bash
docker build -t trading-journal .
docker run --rm -p 8080:80 trading-journal
```

`docker-compose.yml` maps `8080:80`. There is **no data volume** because the
container stores no journal data; the browser does.

## Make targets

```text
make install   pnpm install
make dev       Vite dev server
make build     production build
make preview   preview the build
make test      Vitest
make lint      ESLint
make check     lint + test + build
make clean     remove dist and node_modules
```

---

# 11. Privacy, Persistence & Limits

## Privacy model

* No journal data is transmitted to a server; the app has no API client for it.
* There are no accounts, cookies for authentication, or analytics/telemetry.
* Anyone with access to the browser profile can read the journal. The app is
  single-user and intentionally has no access control.
* The theme preference is the only value written to localStorage.

## Persistence

IndexedDB is durable across page reloads and browser restarts under normal
conditions. At startup the app asks for persistent storage via
`navigator.storage.persist()` where supported (best effort; the browser decides).
Browsers may still evict data when storage pressure is extreme, and users can
clear site data at any time. There is no cloud copy in this release.

## Quotas

Browser quotas are large (typically a substantial fraction of free disk), and a
personal trade journal of thousands of records is small. The app does not
currently display quota usage; a failed write surfaces as an error.

## Private browsing

Private/incognito sessions may provide temporary storage that is discarded when
the session ends. The app does not attempt to detect or special-case this mode.

> **[Planned]** Journal export/import (backup and device migration) and optional
> encryption at rest.

---

# 12. Key Decisions & Trade-offs

| Decision | Rationale | Trade-off |
| --- | --- | --- |
| IndexedDB instead of a server database | Private, offline, zero-setup, no hosting cost | No sync, no central backup, tied to a browser profile |
| No authentication | Nothing to protect server-side; app opens instantly | Anyone with the browser profile can read data |
| TanStack Query over IndexedDB | Reuses familiar async cache/invalidation semantics; keeps components unchanged | A cache layer on top of already-local data |
| Store derived commission/P&L | Reads and analytics are simple and consistent | Must re-derive on every update (done in one place) |
| Numeric auto-increment IDs | Simple, compact, adequate for a single journal | IDs are local to the browser; not globally unique |
| Join market name/currency at read | Market edits propagate automatically | Reads touch both stores |
| Validate in the data layer | Rules hold even if a component bypasses form checks | Some validation also exists in forms for immediate feedback |
| `AppError` messages in the UI | Clear, actionable failures without error-code mapping | Messages are not localized |
| BroadcastChannel notifications | Multi-tab edits stay consistent | Ignored in browsers without BroadcastChannel |

---

# 13. Future Technical Improvements

* **Backup/restore** — export the two stores to a versioned JSON file and import
  it with validation and conflict handling.
* **Schema migration tooling** — explicit versioned upgrade helpers and tests for
  future stores (notes, screenshots, tags).
* **Attachments** — store screenshot blobs in IndexedDB with size limits and
  object-URL lifecycle management.
* **Duplicate detection on import** — hash/compare instrument, direction,
  quantity, prices, and times.
* **Virtualized trade table** — for journals with tens of thousands of rows.
* **Web Worker analytics** — if aggregation grows beyond what the main thread
  handles comfortably.
* **Optional encryption** — derive a key from a user passphrase with Web Crypto
  and encrypt records at rest.
* **PWA/offline install** — a service worker and manifest for installability
  (the app already needs no network for data).
