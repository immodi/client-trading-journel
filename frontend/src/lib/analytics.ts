import type { Trade } from "@/types/models";

export interface EquityPoint {
    index: number;
    equity: number;
    date: string;
}

export interface DrawdownPoint {
    index: number;
    equity: number;
    peak: number;
    /** Peak minus equity; always zero or positive. */
    drawdown: number;
    date: string;
}

export interface StreakInfo {
    type: "win" | "loss" | "none";
    count: number;
}

export interface ConcentrationEntry {
    count: number;
    pnl: number;
    /** Share of net P/L, or null when net P/L is not positive. */
    shareOfNetPnl: number | null;
}

export interface TradeStats {
    totalTrades: number;
    wins: number;
    losses: number;
    breakEven: number;
    netPnl: number;
    grossProfit: number;
    grossLoss: number;
    totalCommission: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    /** null when there are no losing trades (division by zero). */
    profitFactor: number | null;
    bestTrade: Trade | null;
    worstTrade: Trade | null;
    equityCurve: EquityPoint[];
    drawdownCurve: DrawdownPoint[];

    /** Average P/L per trade. */
    averageTrade: number;
    medianTrade: number;
    /** Sample standard deviation of per-trade P/L. */
    standardDeviation: number | null;
    /** Mean per-trade P/L divided by its standard deviation (not annualized). */
    sharpeRatio: number | null;
    /** Mean per-trade P/L divided by downside deviation (not annualized). */
    sortinoRatio: number | null;
    /** Average win divided by average loss. */
    payoffRatio: number | null;
    /** Win rate needed to break even at the current payoff ratio. */
    breakEvenWinRate: number | null;

    maxDrawdown: number;
    currentDrawdown: number;
    /** Net P/L divided by max drawdown. */
    recoveryFactor: number | null;
    maxWinStreak: number;
    maxLossStreak: number;
    currentStreak: StreakInfo;

    /** Top 1, 5, and 10 winning trades and their share of net P/L. */
    profitConcentration: ConcentrationEntry[];
    netPnlWithoutBest: number;
    netPnlWithoutTop5: number;

    averageCommission: number;
    /** Total commission as a share of gross profit; null without gross profit. */
    commissionToGrossProfitRatio: number | null;
}

/**
 * Trade statistics for a single market currency. Monetary figures are only
 * ever aggregated within one currency, so they can be compared and displayed
 * together safely.
 */
export interface CurrencyStats {
    /** Normalized ISO 4217 currency code all trades in this group share. */
    currency: string;
    stats: TradeStats;
}

/**
 * Currency-independent metrics. These count trades rather than summing money,
 * so they remain meaningful when the journal spans several currencies.
 */
export interface OverallStats {
    totalTrades: number;
    wins: number;
    losses: number;
    breakEven: number;
    winRate: number;
}

/**
 * A market present in the loaded trade history. Derived from the trades, which
 * already carry their market's name and currency, so the dashboard needs no
 * extra markets request to build its selector.
 */
export interface MarketSummary {
    id: number;
    name: string;
    /** Normalized ISO 4217 currency inherited by every trade in the market. */
    currency: string;
    tradeCount: number;
}

export interface CurrencySummary {
    currency: string;
    tradeCount: number;
    marketCount: number;
}

const EMPTY_STATS: TradeStats = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    breakEven: 0,
    netPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    totalCommission: 0,
    winRate: 0,
    averageWin: 0,
    averageLoss: 0,
    profitFactor: null,
    bestTrade: null,
    worstTrade: null,
    equityCurve: [],
    drawdownCurve: [],
    averageTrade: 0,
    medianTrade: 0,
    standardDeviation: null,
    sharpeRatio: null,
    sortinoRatio: null,
    payoffRatio: null,
    breakEvenWinRate: null,
    maxDrawdown: 0,
    currentDrawdown: 0,
    recoveryFactor: null,
    maxWinStreak: 0,
    maxLossStreak: 0,
    currentStreak: { type: "none", count: 0 },
    profitConcentration: [],
    netPnlWithoutBest: 0,
    netPnlWithoutTop5: 0,
    averageCommission: 0,
    commissionToGrossProfitRatio: null,
};

function median(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

function sampleStandardDeviation(values: number[], mean: number): number | null {
    if (values.length < 2) return null;

    const sum = values.reduce((total, value) => total + (value - mean) ** 2, 0);
    return Math.sqrt(sum / (values.length - 1));
}

function downsideDeviation(values: number[]): number | null {
    if (values.length === 0) return null;

    const sum = values.reduce(
        (total, value) => total + (value < 0 ? value ** 2 : 0),
        0
    );

    return Math.sqrt(sum / values.length);
}

/**
 * Normalizes a market currency code so groups are consistent regardless of
 * casing or surrounding whitespace. Missing codes fall back to USD, matching
 * the default used when formatting money.
 */
export function normalizeCurrency(currency: string | null | undefined): string {
    return currency?.trim().toUpperCase() || "USD";
}

/**
 * Computes the performance metrics shown on the dashboard from the full trade
 * history. Trades are ordered chronologically by exit time for the equity curve
 * and drawdown curve.
 *
 * Monetary metrics are summed directly, so every trade passed in must share the
 * same currency. Use {@link calculateStatsByCurrency} when the history may span
 * several currencies.
 */
export function calculateStats(trades: Trade[]): TradeStats {
    if (trades.length === 0) {
        return {
            ...EMPTY_STATS,
            equityCurve: [],
            drawdownCurve: [],
            profitConcentration: [],
        };
    }

    const chronological = [...trades].sort(
        (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()
    );

    let wins = 0;
    let losses = 0;
    let breakEven = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalCommission = 0;

    let bestTrade: Trade | null = null;
    let worstTrade: Trade | null = null;
    let bestPnl = 0;

    const values: number[] = [];
    const equityCurve: EquityPoint[] = [];
    const drawdownCurve: DrawdownPoint[] = [];

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;

    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    chronological.forEach((trade, index) => {
        const pnl = trade.profitLoss;
        values.push(pnl);

        if (pnl > 0) {
            wins += 1;
            grossProfit += pnl;
            currentWinStreak += 1;
            currentLossStreak = 0;
            maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else if (pnl < 0) {
            losses += 1;
            grossLoss += Math.abs(pnl);
            currentLossStreak += 1;
            currentWinStreak = 0;
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        } else {
            breakEven += 1;
            currentWinStreak = 0;
            currentLossStreak = 0;
        }

        totalCommission += trade.commission;

        if (bestTrade === null || pnl > bestTrade.profitLoss) {
            bestTrade = trade;
            bestPnl = pnl;
        }
        if (worstTrade === null || pnl < worstTrade.profitLoss) worstTrade = trade;

        equity += pnl;
        peak = Math.max(peak, equity);
        const drawdown = peak - equity;
        maxDrawdown = Math.max(maxDrawdown, drawdown);

        equityCurve.push({ index, equity, date: trade.exitTime });
        drawdownCurve.push({
            index,
            equity,
            peak,
            drawdown,
            date: trade.exitTime,
        });
    });

    const totalTrades = trades.length;
    const netPnl = equity;
    const decisiveTrades = wins + losses;
    const averageTrade = netPnl / totalTrades;
    const standardDeviation = sampleStandardDeviation(values, averageTrade);
    const downside = downsideDeviation(values);

    const payoffRatio =
        wins > 0 && losses > 0
            ? grossProfit / wins / (grossLoss / losses)
            : null;

    const winningPnl = values
        .filter((value) => value > 0)
        .sort((a, b) => b - a);
    const profitConcentration = [1, 5, 10].map((count) => {
        const pnl = winningPnl
            .slice(0, count)
            .reduce((sum, value) => sum + value, 0);

        return {
            count,
            pnl,
            shareOfNetPnl: netPnl > 0 ? pnl / netPnl : null,
        };
    });

    const currentStreak: StreakInfo =
        currentWinStreak > 0
            ? { type: "win", count: currentWinStreak }
            : currentLossStreak > 0
              ? { type: "loss", count: currentLossStreak }
              : { type: "none", count: 0 };

    return {
        totalTrades,
        wins,
        losses,
        breakEven,
        netPnl,
        grossProfit,
        grossLoss,
        totalCommission,
        winRate: decisiveTrades === 0 ? 0 : wins / decisiveTrades,
        averageWin: wins === 0 ? 0 : grossProfit / wins,
        averageLoss: losses === 0 ? 0 : grossLoss / losses,
        profitFactor: grossLoss === 0 ? null : grossProfit / grossLoss,
        bestTrade,
        worstTrade,
        equityCurve,
        drawdownCurve,
        averageTrade,
        medianTrade: median(values),
        standardDeviation,
        sharpeRatio:
            standardDeviation !== null && standardDeviation > 0
                ? averageTrade / standardDeviation
                : null,
        sortinoRatio:
            downside !== null && downside > 0 ? averageTrade / downside : null,
        payoffRatio,
        breakEvenWinRate: payoffRatio === null ? null : 1 / (1 + payoffRatio),
        maxDrawdown,
        currentDrawdown: drawdownCurve.at(-1)?.drawdown ?? 0,
        recoveryFactor: maxDrawdown > 0 ? netPnl / maxDrawdown : null,
        maxWinStreak,
        maxLossStreak,
        currentStreak,
        profitConcentration,
        netPnlWithoutBest: netPnl - bestPnl,
        netPnlWithoutTop5: netPnl - profitConcentration[1].pnl,
        averageCommission: totalCommission / totalTrades,
        commissionToGrossProfitRatio:
            grossProfit > 0 ? totalCommission / grossProfit : null,
    };
}

/**
 * Computes currency-independent metrics across the whole journal. Only counts
 * and ratios are produced, so trades in different currencies can be combined
 * without producing a misleading monetary total.
 */
export function calculateOverallStats(trades: Trade[]): OverallStats {
    let wins = 0;
    let losses = 0;
    let breakEven = 0;

    for (const trade of trades) {
        const pnl = trade.profitLoss;

        if (pnl > 0) wins += 1;
        else if (pnl < 0) losses += 1;
        else breakEven += 1;
    }

    const decisiveTrades = wins + losses;

    return {
        totalTrades: trades.length,
        wins,
        losses,
        breakEven,
        winRate: decisiveTrades === 0 ? 0 : wins / decisiveTrades,
    };
}

/**
 * Groups the journal by market currency and computes {@link calculateStats}
 * independently for each group. Each returned entry contains its own monetary
 * totals and equity curve, so trades in different currencies are never summed
 * together.
 */
export function calculateStatsByCurrency(trades: Trade[]): CurrencyStats[] {
    const groups = new Map<string, Trade[]>();

    for (const trade of trades) {
        const currency = normalizeCurrency(trade.currency);
        const group = groups.get(currency);

        if (group) group.push(trade);
        else groups.set(currency, [trade]);
    }

    return Array.from(groups, ([currency, group]) => ({
        currency,
        stats: calculateStats(group),
    })).sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Lists the markets that appear in the trade history, each with its currency
 * and trade count. Sorted by name for a stable, scannable selector.
 */
export function getMarketSummaries(trades: Trade[]): MarketSummary[] {
    const markets = new Map<number, MarketSummary>();

    for (const trade of trades) {
        const existing = markets.get(trade.marketId);

        if (existing) {
            existing.tradeCount += 1;
        } else {
            markets.set(trade.marketId, {
                id: trade.marketId,
                name: trade.marketName,
                currency: normalizeCurrency(trade.currency),
                tradeCount: 1,
            });
        }
    }

    return Array.from(markets.values()).sort(
        (a, b) => a.name.localeCompare(b.name) || a.id - b.id
    );
}

/**
 * Lists the currencies in the journal with trade and market counts. Sorted by
 * trade count so the most active currency is the natural default.
 */
export function getCurrencySummaries(trades: Trade[]): CurrencySummary[] {
    const groups = new Map<
        string,
        { tradeCount: number; markets: Set<number> }
    >();

    for (const trade of trades) {
        const currency = normalizeCurrency(trade.currency);
        const group = groups.get(currency);

        if (group) {
            group.tradeCount += 1;
            group.markets.add(trade.marketId);
        } else {
            groups.set(currency, {
                tradeCount: 1,
                markets: new Set([trade.marketId]),
            });
        }
    }

    return Array.from(groups, ([currency, group]) => ({
        currency,
        tradeCount: group.tradeCount,
        marketCount: group.markets.size,
    })).sort(
        (a, b) =>
            b.tradeCount - a.tradeCount || a.currency.localeCompare(b.currency)
    );
}

/**
 * Computes statistics for a single market. Every trade in a market shares that
 * market's currency, so the resulting monetary totals and equity curve stay
 * within one currency.
 */
export function calculateStatsForMarket(trades: Trade[], marketId: number): TradeStats {
    return calculateStats(trades.filter((trade) => trade.marketId === marketId));
}
