# Trading Journal

## Product Requirements Document (PRD)

**Version:** 3.0
**Status:** Living document — reflects the local-first release

> **How to read this document.** Every requirement is tagged **[Implemented]**,
> **[Planned]**, or **[Out of scope]**. The data model and implementation are
> described in the [technical design document](./technical_document.md) and the
> [entity diagram](./entity_diagram.svg).

---

# 1. Introduction

## Purpose

Trading Journal is a web application that enables traders to document, organize,
and analyze their trading activity.

The application replaces spreadsheets and scattered notes with a journal where
traders record completed trades and review performance analytics. It provides
performance statistics, trade organization, and historical insight to help
traders improve their decision-making over time.

Trading Journal **does not execute trades or connect to live financial markets**.
Its purpose is to support post-trade review and continuous improvement.

## Local-first model

**[Implemented]** The application is entirely client-side. There is no backend,
no account, and no authentication. Every market and trade is stored in the
browser's IndexedDB database and never transmitted over the network.

Consequences, accepted by design:

* The journal belongs to one browser profile and one origin.
* Data does not sync across devices or browsers automatically.
* Clearing site data deletes the journal.
* Anyone with access to the browser profile can read the journal.

---

# 2. Objectives

The application aims to help traders:

* **[Implemented]** Maintain an organized history of all completed trades.
* **[Implemented]** Record trades manually without creating an account.
* **[Implemented]** Measure trading performance through meaningful statistics.
* **[Implemented]** Review historical trades through search and filtering.
* **[Implemented]** Import trades from JSON exports to reduce repetitive data
  entry.
* **[Implemented]** Keep all data private and on-device.
* **[Planned]** Back up and restore the journal as a file.
* **[Planned]** Attach notes, screenshots, and tags to trades.

---

# 3. Target Users

The application is designed for individual retail traders who trade:

* Futures
* Forex
* Stocks
* Options
* Cryptocurrency

Users may trade through any broker or prop firm. Manual entry is always
available, and JSON import can accept a trade-history export from another
journal.

---

# 4. Project Scope

## Implemented

* Local market management (create, view, edit, and delete markets)
* Manual trade entry and full trade CRUD
* Bulk trade import from a JSON export
* A single local journal where every trade belongs to a market and inherits its
  currency
* Client-computed profit/loss and commission
* Performance dashboard with statistics and an equity curve
* Search, filtering, and sorting of trades
* Light / dark / system theme
* Cross-tab change notification
* Static deployment

## Out of scope

* User accounts, authentication, and per-user access control
* A server, API, or remote database
* Cloud sync or multi-device sync
* Trade execution
* Live market data
* Broker integrations (API)
* Portfolio management
* Copy trading
* Order management

---

# 5. Functional Requirements

## 5.1 Local Data & Privacy (Implemented)

* The system shall store all journal data in the browser's IndexedDB database.
* The system shall not require registration, login, or any personal information.
* The system shall not send market or trade data to a server.
* The system shall scope data to the current browser profile and origin.
* The system shall keep the journal available after a page reload or browser
  restart, subject to browser storage policies.
* The system shall show a clear indication in the UI that data is stored
  locally.
* The system shall document that clearing browser data deletes the journal.
* The system shall reflect changes made in another open tab by invalidating
  cached data through `BroadcastChannel`.
* The system shall support current browsers that implement IndexedDB.
* The system shall display a helpful error when IndexedDB is unavailable.

> **Planned:** encrypted local backup and restore.

---

## 5.2 Markets & Trade Journal (Implemented)

### Markets

A **market** groups the journal's trades and defines the currency they are
recorded in. The system shall allow users to:

* Create a market with a name and a currency.
* View all markets and the number of trades in each.
* Edit a market's name or currency.
* Delete a market, but only when it has no associated trades.

Rules:

* A market name shall be required, trimmed, and at most 100 characters.
* A market name shall be unique within the local journal, case-insensitively.
* A currency shall be a 3-letter ISO 4217 code (for example `USD`) and is stored
  uppercase.
* Every trade belongs to exactly one market and inherits the market's currency.
* Renaming a market or changing its currency shall be reflected on its trades
  immediately.
* Deleting a market that still has trades shall be refused with a message
  explaining that the trades must be deleted or reassigned first; the trade
  history shall never be silently discarded.

### Trade Journal

The Trade Journal is the core feature of the application.

The system shall allow users to:

* Create trades manually
* View all recorded trades
* Edit existing trades
* Delete trades

Each trade shall support the following information:

| Field | Entered or derived | Notes |
|---|---|---|
| Market | Entered | Every trade belongs to a market (required) |
| Instrument | Entered | Free text, trimmed, uppercased, max 20 characters |
| Direction | Entered | Long or Short |
| Quantity | Entered | Whole number greater than zero |
| Point value | Entered | Value of one price point per unit (for example 2 for MNQ, 1 for shares); greater than zero |
| Entry price | Entered | Non-negative decimal |
| Exit price | Entered | Non-negative decimal |
| Entry date and time | Entered | Stored as a UTC ISO timestamp |
| Exit date and time | Entered | Stored as a UTC ISO timestamp; cannot precede entry |
| Commission per side | Entered | Non-negative flat rate charged on each side of the round trip |
| Currency | **Derived** | Inherited from the trade's market |
| Commission per unit | **Derived** | `CommissionPerSide × 2` |
| Commission | **Derived** | `CommissionPerUnit × Quantity` |
| Profit / Loss | **Derived** | Computed from the stored values (see below) |
| Trade duration | **Derived** | Exit time − entry time, rendered by the UI |

Rules:

* A trade always belongs to exactly one market.
* A trade inherits its currency from its market.
* Profit/loss shall be computed as
  `(exit − entry) × quantity × pointValue − commission` for a Long trade,
  inverted for a Short trade. The UI never supplies profit/loss.
* The client supplies a **per-side commission**; the data layer derives the
  total commission as `CommissionPerSide × 2 × Quantity`.
* Derived monetary values are stored rounded to four decimal places.
* Editing a trade shall re-derive its commission and profit/loss from the merged
  stored values.
* Invalid input shall be rejected before anything is written.

### Trade Import (Implemented)

Traders who already keep a journal elsewhere shall be able to bulk-add their
trades from a JSON export without re-entering them by hand. The system shall
allow users to:

* Choose an existing market and upload a `.json` trade export.
* See a preview of the parsed file (instrument, point value, trade count, and
  total commission) before confirming.
* Import every row under the chosen market, in a single batch, at which point
  the imported trades behave identically to manually created ones.

Rules:

* Every imported trade is filed under the selected market and inherits its
  currency.
* The export's `meta` supplies a **point value** (default `1`) and a **per-side
  commission** (default `0`) that apply to every row.
* Each row's total commission and profit/loss are derived exactly as for manual
  entry.
* Instruments fall back to `meta.instrument` when a row omits one; both are
  uppercased.
* Times may be ISO strings or Unix seconds (`entryTimeUnix` / `exitTimeUnix`).
* A file that is not valid JSON, is missing its `trades` array, is empty,
  exceeds 5,000 rows, or contains an invalid row (unknown direction, non-whole
  quantity, negative price, unparseable or reversed times) shall be rejected
  with a clear message and **no partial import**.
* Imported and manually created trades behave identically once stored.

---

## 5.3 Dashboard (Implemented)

The dashboard provides a high-level overview of trading performance. It shall
display:

* Total trades
* Net profit/loss
* Win rate
* Gross profit and gross loss
* Total commission paid
* Average winning trade
* Average losing trade
* Profit factor
* Best trade and worst trade
* An equity curve
* A recent-trades table

Metrics shall be derived from the local trade history and update automatically
whenever trades are created, edited, deleted, or imported.

Because each market carries a single currency and every trade inherits its
market's currency, all monetary metrics are computed per market — net P/L,
average win/loss, best/worst trade, total commission, and the equity curve are
never summed across currencies. A compact market selector switches the dashboard
between an **All markets** view, which shows only currency-independent metrics
(total trades, overall win rate, and market/currency counts), and a single
market's performance panel, which shows its monetary metrics, commission, and
equity curve in that market's own currency. The recent-trades table and the
selection are independent, and it formats each trade in its own market currency.
The application never converts or combines amounts across currencies.

---

## 5.4 Analytics (Implemented)

The analytics page provides a deeper review of a selected market. It shall
display:

* **Performance** — expectancy (average P/L per trade), median trade, payoff
  ratio, breakeven win rate, max and current drawdown, an underwater curve,
  recovery factor, per-trade standard deviation, and per-trade Sharpe/Sortino
  ratios (not annualized).
* **Risk and concentration** — longest win/loss streaks, current streak, P/L
  from the top 1/5/10 winning trades and their share of net P/L, and net P/L
  excluding the best trade and the top five winners.
* **Breakdowns** — long versus short performance, per-instrument performance
  (grouped within each market), commission drag, hold-time buckets, and a P/L
  distribution histogram.
* **Rolling metrics** — 20- and 50-trade rolling win rate, profit factor, and
  expectancy.
* **Timing** — green-day/week/month rates, average P/L and trade pace per
  period, best/worst day, week, and month, P/L by entry weekday, P/L by entry
  hour, and a monthly P/L heatmap.

When the journal contains more than one market, the page exposes a market
selector. Every monetary metric is calculated within the selected market;
amounts are never converted or summed across currencies. The dashboard and
analytics pages remember the last market opened (stored locally) so switching
between them keeps the same market in focus. Day/week/month grouping uses the
local exit date, while weekday and entry-hour grouping uses the local entry
time.

> **Planned:** R-multiple analytics (requires optional risk/stop fields),
> MAE/MFE and slippage (requires optional price fields), and return metrics
> based on an account starting balance.

---

## 5.5 Data Backup and Restore (Implemented)

The system shall let users safeguard the whole local journal and move it between
browsers:

* **Backup** downloads every market and trade, including identifiers and
  timestamps, as one pretty-printed JSON file named
  `trading-journal-backup-YYYY-MM-DD.json`.
* **Restore** reads a backup file, shows its export date, market count, and
  trade count, and then replaces the current journal after confirmation.
* Backups are distinct from broker trade imports: each trade export adds rows to
  one market, while a backup restores the entire journal. A file in the wrong
  format shall be rejected with a message pointing to the appropriate import.

Rules:

* A backup file declares its format and version. Files from an unsupported or
  newer version shall be rejected.
* Every market and trade shall be validated before any write, including unique
  identifiers, case-insensitive unique market names, valid currencies and trade
  values, and trade references to markets present in the backup.
* Restoring is a single transaction that clears and repopulates markets and
  trades together; a failure shall leave the existing journal untouched.
* Derived commission and profit/loss are recomputed from each trade's inputs on
  restore.
* Backup files contain journal data only, not browser preferences such as the
  theme or last opened market.

---

## 5.5 Search, Filtering & Sorting (Implemented)

Users shall be able to:

* Search trades by instrument (case-insensitive substring match).
* Filter trades by direction (Long / Short).
* Filter trades by exit-date range.
* Filter with multiple criteria simultaneously.
* Sort the trade table by instrument, exit time, or profit/loss.

> **Planned:** search and filter by notes, tags, and profit/loss.

---

## 5.6 Trade Notes (Planned)

Users shall be able to attach personal notes to every trade, including rationale,
mistakes, emotional state, lessons learned, and market observations. Notes shall
remain editable at any time.

---

## 5.7 Screenshot Management (Planned)

Users shall be able to attach one or more screenshots to each trade (entry chart,
exit chart, setup, higher-timeframe analysis). Screenshots will be stored locally
(for example as blobs in IndexedDB), never uploaded to a server.

---

## 5.8 Trade Tags (Planned)

Users shall be able to assign custom tags to trades (for example `Breakout`,
`Reversal`, `News`, `A+`, `FOMO`, `Revenge Trade`, `Scalping`). Tags shall be
searchable and filterable.

---

# 6. User Workflows

## Manual Trade Entry (Implemented)

1. Open the app. No sign-in is required.
2. Open the **Markets** page and create a market (name + currency) if one does
   not already exist.
3. Open the **Trades** page and choose **Add trade**.
4. Select the market and enter the instrument, direction, quantity, point value,
   entry/exit prices, and entry/exit times.
5. Enter the per-side commission; the total is derived locally.
6. Save the trade.
7. Review the updated dashboard and analytics statistics.

## Reviewing Performance (Implemented)

1. Open the dashboard. It opens on the last market viewed (stored locally) or on
   **All markets** when none was selected, showing currency-independent metrics
   (total trades, overall win rate, and market/currency counts).
2. Use the market selector to pick a market and see its net profit/loss, win
   rate, profit factor, average win/loss, total commission, and equity curve in
   that market's own currency.
3. Open **Analytics** to review risk, streak, breakdown, rolling, and timing
   metrics for the same market.
4. Open the **Trades** page to search, filter, and sort the underlying trades.
5. Edit or delete a trade and watch the metrics update.

## JSON Trade Import (Implemented)

1. Open the **Trades** page and choose **Import**.
2. Select the market the trades should be filed under.
3. Upload a `.json` trade export.
4. Review the preview (instrument, point value, trade count, and total
   commission).
5. Confirm the import and review the updated dashboard and analytics
   statistics.

## Whole-Journal Backup and Restore (Implemented)

1. Open the **Data** page.
2. Choose **Export backup** to download every market and trade as one `.json`
   file.
3. To restore, choose **Restore from backup**, select a backup file, and review
   its export date, market count, and trade count.
4. Confirm the replacement. The current journal is replaced atomically with the
   backup's contents.

---

# 7. Non-Functional Requirements

The application shall:

* **[Implemented]** Work without a backend, account, or network connection after
  the assets have loaded.
* **[Implemented]** Persist data reliably in IndexedDB, with no database server
  to install or operate.
* **[Implemented]** Keep all trade data on the user's device.
* **[Implemented]** Survive page reloads and browser restarts, subject to the
  browser's storage policy.
* **[Implemented]** Be responsive on desktop and tablet devices.
* **[Implemented]** Be deployable as static files behind any web server.
* **[Implemented]** Import JSON exports of up to 5,000 trades per batch.
* **[Implemented]** Export and restore the entire journal as one versioned JSON
  backup file, validated before any data is replaced.
* **[Implemented]** Validate all input at the data layer, not only in forms.
* **[Implemented]** Keep tabs consistent when the journal changes elsewhere.
* **[Implemented]** Provide light, dark, and system themes.
* **[Implemented]** Expose no authentication surface and require no personal
  data.

### Browser storage limits

The browser controls the storage quota and may evict data under extreme storage
pressure or when the user clears site data. The application shall document this
behavior rather than implying a server-side backup exists.

---

# 8. Release Status (MVP)

| Area | Status |
|---|---|
| Local-first IndexedDB persistence | Implemented |
| Authentication / user accounts | Removed (out of scope) |
| Market management (CRUD) | Implemented |
| Manual trade entry | Implemented |
| Trade journal (CRUD) | Implemented |
| JSON trade import | Implemented |
| Whole-journal backup & restore | Implemented |
| Client-side profit/loss & commission | Implemented |
| Dashboard & performance statistics | Implemented |
| Equity curve | Implemented |
| Analytics page (risk, streaks, breakdowns, rolling, timing) | Implemented |
| Daily/weekly/monthly P/L & best/worst periods | Implemented |
| Search, filtering & sorting | Implemented |
| Multi-tab change notification | Implemented |
| Light / dark theme | Implemented |
| Journal backup / restore | Planned |
| Trade notes | Planned |
| Screenshot uploads | Planned |
| Custom tags | Planned |
| R-multiple / MAE / MFE analytics | Planned |

---

# 9. Future Enhancements

Potential future features include:

* Journal export/import for backup and moving between devices
* Optional encryption at rest for local data
* AI-generated trade reviews
* Strategy performance tracking
* Monthly performance reports
* R-multiple, MAE/MFE, and account-return metrics
* Mobile companion application
* Goal and habit tracking
