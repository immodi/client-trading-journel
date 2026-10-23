# Trading Journal — Frontend

The React + TypeScript single-page app for the Trading Journal. For the full
project overview, architecture, and setup, see the [root README](../README.md).

The app is **local-first**: there is no API and no authentication. Markets and
trades are stored in the browser's IndexedDB database (`trading-journal`).

## Quick start

```bash
pnpm install
pnpm dev                 # http://localhost:5173
```

No backend, server-side database, or environment variables are required.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the Vite dev server with HMR |
| `pnpm build` | Type-check (`tsc -b`) and build for production |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run the Vitest unit and data-layer tests |
| `pnpm preview` | Preview the production build locally |

## Structure

```
src/
  db/           IndexedDB connection, schema, market & trade repositories,
                change notifications, and data-layer tests
  hooks/        TanStack Query hooks for markets/trades, plus theming
  lib/          analytics, breakdowns, time analytics, validation, trade math,
                formatting, datetime, JSON import parsing, and error helpers
  components/   layout, dashboard, analytics, markets, trades, theme, UI primitives
  pages/        route screens
  router/       route configuration
  types/        shared models
```

## Conventions

- **All persistence goes through `src/db/`.** Components never open IndexedDB
  directly.
- **Derived values are computed once, in the data layer.** Forms preview
  commission but never send `commission` or `profitLoss`.
- **Validation lives in `src/lib/validation.ts`** and runs again in the data
  layer, so rules do not depend on the form being used.
- **TanStack Query is a rendering cache over local data.** Mutations invalidate
  `["trades"]` and `["markets"]`; `BroadcastChannel` invalidates across tabs.
- **Timestamps** are stored as UTC ISO strings and rendered in the browser's
  local timezone (`src/lib/datetime.ts`).
- **Monetary dashboard metrics** are computed per market
  (`calculateStatsForMarket`); values in different currencies are never summed.
  The dashboard's market selector is derived from the loaded trades
  (`getMarketSummaries`), so no extra markets query is needed.
- **Analytics** selects one currency at a time (`getCurrencySummaries`) and
  computes monetary metrics only within that currency. Direction, instrument,
  duration, rolling, and time breakdowns live in `breakdowns.ts` and
  `timeAnalytics.ts`.
- **Tests** live next to the logic as `*.test.ts` and run with `pnpm test`.
  `src/db/journal.test.ts` uses `fake-indexeddb` to exercise the real schema and
  transactions.

## Static hosting

`pnpm build` emits `frontend/dist`. The host must serve `index.html` for unknown
paths so client-side routes survive a refresh. See `nginx.conf` for an example.
