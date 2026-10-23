# Trading Journal

[![CI](https://github.com/immodi/trading-journel/actions/workflows/ci.yml/badge.svg)](https://github.com/immodi/trading-journel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

A **local-first** trade journal for retail traders. Log every trade, let the app
derive profit/loss and commission, and review both a high-level performance
dashboard and a deeper analytics page — expectancy, drawdown, streaks, rolling
metrics, instrument and direction breakdowns, and day/week/month timing.

There is no backend, no account, and no sign-in. Everything lives in the
browser's **IndexedDB**, so the journal opens instantly and your trade data never
leaves the device.

> Status: markets, trade CRUD, JSON import, analytics, filtering, and theming
> are implemented and covered by tests. Notes, screenshots, and tags are on the
> [roadmap](#roadmap).

---

## Features

- **No accounts or server** — open the app and start journaling. There is no
  registration, login, API, or database to run.
- **Local persistence** — markets and trades are stored in IndexedDB. Reopening
  the tab or restarting the browser keeps the journal intact.
- **Markets** — create, edit, and delete markets. Each market carries a single
  currency that every trade in it inherits.
- **Trade journal** — create, edit, and delete trades with instrument,
  direction (Long/Short), quantity, point value, entry/exit prices, entry/exit
  times, and a market.
- **Derived P/L and commission** — the local data layer computes
  `(exit − entry) × quantity × pointValue − commission` (inverted for shorts) and
  `commissionPerUnit × quantity`. The UI never supplies derived values.
- **Trade import** — bulk-add trades from a `TradeReplay`-style JSON export
  under any market. The whole file is validated before a single row is written.
- **Dashboard** — net P/L, win rate, profit factor, average win, average loss,
  total trades, commission, an SVG equity curve, and recent trades.
- **Analytics** — expectancy, median trade, payoff ratio, breakeven win rate,
  max/current drawdown with an underwater curve, recovery factor, standard
  deviation, per-trade Sharpe/Sortino, win/loss streaks, profit concentration,
  outlier-excluded P/L, long/short and per-instrument breakdowns, commission
  drag, hold-time buckets, P/L distribution, rolling 20/50-trade metrics,
  green-day/week/month consistency, best/worst periods, weekday and entry-hour
  P/L, and a monthly P/L heatmap.
- **Search, filtering, and sorting** — search by instrument, filter by direction
  and exit-date range, and sort by instrument, exit time, or P/L.
- **Multi-tab consistency** — a `BroadcastChannel` refreshes other open tabs when
  the journal changes.
- **Light, dark, and system themes** — persisted in `localStorage` with no flash
  of the wrong theme on load.
- **Responsive, accessible UI** — shadcn-style components built on Base UI.

## Tech stack

| Technology | Purpose |
|---|---|
| React 19 | UI |
| TypeScript | Type safety |
| Vite | Dev server & build tool |
| React Router | Client-side routing |
| TanStack Query | Local async state cache |
| `idb` | Typed IndexedDB access |
| Tailwind CSS v4 + Base UI | Styling & accessible primitives |
| Vitest + `fake-indexeddb` | Unit and data-layer tests |

## Architecture

Everything runs in the browser:

```text
┌─────────────────────────────────────────────────────┐
│ Browser tab                                         │
│                                                     │
│  React SPA (pages · components · hooks)             │
│        │                                            │
│        ▼                                            │
│  TanStack Query cache                               │
│        │                                            │
│        ▼                                            │
│  src/db/ (markets · trades · validation · P/L)      │
│        │                                            │
│        ▼                                            │
│  IndexedDB database "trading-journal"               │
└─────────────────────────────────────────────────────┘
```

The frontend is split into clear seams:

```text
src/db/           IndexedDB schema, CRUD, transactions, change notifications
src/hooks/        query + mutation hooks over the data layer
src/lib/          pure helpers: analytics, breakdowns, time analytics, validation, trade math, formatting
src/components/   layout, dashboard, markets, trades, theme, UI primitives
src/pages/        route screens
src/types/        shared models
```

### Data model

| Store | Fields |
|---|---|
| `markets` | `id`, `name`, `currency`, `createdAt`, `updatedAt` |
| `trades` | `id`, `marketId`, `instrument`, `direction`, `entryPrice`, `exitPrice`, `quantity`, `pointValue`, `entryTime`, `exitTime`, `commissionPerUnit`, `commission`, `profitLoss`, `createdAt`, `updatedAt` |

- Market names are unique (case-insensitive) within the local journal.
- A market with trades cannot be deleted; its trades must be deleted or
  reassigned first.
- Trades join their market on read, so renaming a market or changing its
  currency is reflected everywhere immediately.
- A round trip is charged on both sides, so `commissionPerUnit` is the per-side
  rate × 2 and `commission = commissionPerUnit × quantity`.
- Monetary dashboard and analytics metrics are computed per market. Amounts in
  different currencies are never summed.
- The dashboard and analytics pages share the last opened market, so switching
  between them keeps the same market in focus.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ (or 22.12+) and [pnpm](https://pnpm.io/)
- A browser with IndexedDB support (all current browsers)

### Run locally

```bash
cd frontend
pnpm install
pnpm dev
```

Open <http://localhost:5173>. There is nothing else to start.

From the repository root you can also use:

```bash
make install
make dev
```

### Production build

```bash
cd frontend
pnpm build          # static files in frontend/dist
pnpm preview        # serve the build locally
```

Deploy `frontend/dist` to any static host. The host **must** fall back to
`index.html` for client-side routes such as `/trades`; otherwise a hard refresh
returns a 404. The included `frontend/nginx.conf` shows one way to do that.

## Docker

```bash
docker build -t trading-journal .
docker run --rm -p 8080:80 trading-journal
```

Open <http://localhost:8080>. Or use Compose:

```bash
docker compose up -d --build
```

No database volume is needed: journal data is stored in each visitor's browser,
not in the container. The nginx image only serves static files and never
receives trade data.

## Testing

```bash
cd frontend
pnpm test           # Vitest: pure logic, validation, and IndexedDB data layer
pnpm lint           # ESLint
pnpm build          # tsc type-check + production build
```

The data-layer tests run against [`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB),
so they exercise the real schema, transactions, validation, and derived values
without a browser. `make check` runs lint, tests, and the build together.

## Where the data lives

- Database name: **`trading-journal`** (IndexedDB)
- Theme preference: **`trading-journal-theme`** (`localStorage`)
- Last opened market: **`trading-journal-last-market`** (`localStorage`)

Important consequences:

- Data is scoped to the **browser profile and origin**. `localhost:5173`,
  `localhost:8080`, and a deployed HTTPS origin each have a separate journal.
- Clearing site data, using private/incognito mode, or changing browsers removes
  or hides the journal. There is no cloud backup.
- Anyone with access to that browser profile can read the journal. This app is
  intentionally single-user and has no authentication or access control.
- Browser storage quotas are finite; a journal of many thousands of trades is
  well within normal limits, but the browser ultimately controls persistence.
- There is no automatic sync between devices. Moving a journal requires a
  future export/import feature.

## Project structure

```text
frontend/
  src/
    db/           IndexedDB connection, schema, markets & trades repositories
    hooks/        query + mutation hooks and theme state
    lib/          analytics, breakdowns, time analytics, validation, trade math, formatting, JSON import
    components/   layout, dashboard, analytics, markets, trades, theme, UI primitives
    pages/        Dashboard, Analytics, Markets, Trades, Not Found
    router/       route configuration
    types/        shared models
  nginx.conf      static-host config with SPA fallback
docs/             business requirements, technical design, entity diagram
```

## Documentation

- [Business requirements](./docs/business_requirements.md)
- [Technical design](./docs/technical_document.md)
- [Entity diagram](./docs/entity_diagram.svg)

## Roadmap

- Journal export/import (backup and device migration)
- Import duplicate detection and additional export formats
- Trade notes, tags, and chart screenshots
- R-multiple analytics (requires optional risk/stop fields)
- MAE/MFE and slippage analytics (requires optional price fields)
- Optional encrypted local backup

## License

Released under the [MIT License](./LICENSE).

Built by [Ahmed Yasser (@immodi)](https://github.com/immodi).
