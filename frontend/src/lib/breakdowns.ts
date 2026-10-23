import {
    Direction,
    DIRECTION_LABELS,
    type Trade,
} from "@/types/models";
import { calculateStats, normalizeCurrency } from "@/lib/analytics";

export interface DirectionStats {
    direction: Direction;
    label: string;
    totalTrades: number;
    wins: number;
    losses: number;
    breakEven: number;
    netPnl: number;
    totalCommission: number;
    winRate: number;
    averagePnl: number;
    profitFactor: number | null;
}

/**
 * Long and short performance are reported separately so a strong overall
 * result cannot hide a weak side of the strategy.
 */
export function calculateDirectionStats(trades: Trade[]): DirectionStats[] {
    return [Direction.Long, Direction.Short].map((direction) => {
        const stats = calculateStats(
            trades.filter((trade) => trade.direction === direction)
        );

        return {
            direction,
            label: DIRECTION_LABELS[direction],
            totalTrades: stats.totalTrades,
            wins: stats.wins,
            losses: stats.losses,
            breakEven: stats.breakEven,
            netPnl: stats.netPnl,
            totalCommission: stats.totalCommission,
            winRate: stats.winRate,
            averagePnl: stats.averageTrade,
            profitFactor: stats.profitFactor,
        };
    });
}

export interface InstrumentStats {
    key: string;
    instrument: string;
    marketId: number;
    marketName: string;
    currency: string;
    totalTrades: number;
    wins: number;
    losses: number;
    breakEven: number;
    netPnl: number;
    totalCommission: number;
    winRate: number;
    averagePnl: number;
    profitFactor: number | null;
}

/**
 * Groups by market and instrument, not instrument alone: the same ticker can
 * exist in two markets with different currencies. Rows are never summed.
 */
export function calculateInstrumentStats(trades: Trade[]): InstrumentStats[] {
    const groups = new Map<string, Trade[]>();

    for (const trade of trades) {
        const key = `${trade.marketId}:${trade.instrument}`;
        const group = groups.get(key);

        if (group) group.push(trade);
        else groups.set(key, [trade]);
    }

    return Array.from(groups, ([key, group]) => {
        const stats = calculateStats(group);
        const sample = group[0];

        return {
            key,
            instrument: sample.instrument,
            marketId: sample.marketId,
            marketName: sample.marketName,
            currency: normalizeCurrency(sample.currency),
            totalTrades: stats.totalTrades,
            wins: stats.wins,
            losses: stats.losses,
            breakEven: stats.breakEven,
            netPnl: stats.netPnl,
            totalCommission: stats.totalCommission,
            winRate: stats.winRate,
            averagePnl: stats.averageTrade,
            profitFactor: stats.profitFactor,
        };
    }).sort(
        (a, b) =>
            b.netPnl - a.netPnl ||
            a.instrument.localeCompare(b.instrument) ||
            a.marketId - b.marketId
    );
}

export interface DurationBucket {
    key: string;
    label: string;
    minMs: number;
    maxMs: number | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DURATION_BUCKETS: readonly DurationBucket[] = [
    { key: "under-5m", label: "< 5m", minMs: 0, maxMs: 5 * MINUTE },
    { key: "5-15m", label: "5–15m", minMs: 5 * MINUTE, maxMs: 15 * MINUTE },
    { key: "15-60m", label: "15–60m", minMs: 15 * MINUTE, maxMs: HOUR },
    { key: "1-4h", label: "1–4h", minMs: HOUR, maxMs: 4 * HOUR },
    { key: "4-24h", label: "4–24h", minMs: 4 * HOUR, maxMs: DAY },
    { key: "1-7d", label: "1–7d", minMs: DAY, maxMs: 7 * DAY },
    { key: "over-7d", label: "> 7d", minMs: 7 * DAY, maxMs: null },
];

export interface DurationBucketStats extends DurationBucket {
    totalTrades: number;
    wins: number;
    losses: number;
    breakEven: number;
    netPnl: number;
    winRate: number;
    averagePnl: number;
    profitFactor: number | null;
}

export interface DurationStats {
    averageMs: number;
    medianMs: number;
    buckets: DurationBucketStats[];
}

function tradeDurationMs(trade: Trade): number {
    return Math.max(
        0,
        new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime()
    );
}

function median(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

/**
 * Hold time is calculated from entry to exit. Buckets are lower-bound
 * inclusive and upper-bound exclusive, with the final bucket open-ended.
 */
export function calculateDurationStats(trades: Trade[]): DurationStats {
    const entries = trades.map((trade) => ({
        trade,
        durationMs: tradeDurationMs(trade),
    }));
    const durations = entries.map((entry) => entry.durationMs);
    const averageMs =
        durations.length === 0
            ? 0
            : durations.reduce((sum, duration) => sum + duration, 0) /
              durations.length;

    const buckets = DURATION_BUCKETS.map((bucket) => {
        const group = entries
            .filter(
                (entry) =>
                    entry.durationMs >= bucket.minMs &&
                    (bucket.maxMs === null || entry.durationMs < bucket.maxMs)
            )
            .map((entry) => entry.trade);
        const stats = calculateStats(group);

        return {
            ...bucket,
            totalTrades: stats.totalTrades,
            wins: stats.wins,
            losses: stats.losses,
            breakEven: stats.breakEven,
            netPnl: stats.netPnl,
            winRate: stats.winRate,
            averagePnl: stats.averageTrade,
            profitFactor: stats.profitFactor,
        };
    });

    return {
        averageMs,
        medianMs: median(durations),
        buckets,
    };
}

export interface HistogramBin {
    from: number;
    to: number;
    count: number;
}

export interface PnlHistogram {
    min: number;
    max: number;
    bins: HistogramBin[];
}

/**
 * Builds an evenly spaced histogram of per-trade P/L. The final bin includes
 * the maximum value so every trade is counted exactly once.
 */
export function calculatePnlHistogram(
    trades: Trade[],
    binCount = 9
): PnlHistogram {
    if (trades.length === 0) {
        return { min: 0, max: 0, bins: [] };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const trade of trades) {
        min = Math.min(min, trade.profitLoss);
        max = Math.max(max, trade.profitLoss);
    }

    if (min === max) {
        return {
            min,
            max,
            bins: [{ from: min, to: max, count: trades.length }],
        };
    }

    const count = Math.max(1, Math.floor(binCount));
    const width = (max - min) / count;
    const bins: HistogramBin[] = Array.from({ length: count }, (_, index) => ({
        from: min + index * width,
        to: index === count - 1 ? max : min + (index + 1) * width,
        count: 0,
    }));

    for (const trade of trades) {
        const index = Math.min(
            count - 1,
            Math.floor((trade.profitLoss - min) / width)
        );
        bins[index].count += 1;
    }

    return { min, max, bins };
}

export interface RollingPoint {
    /** Zero-based index of the final trade in the rolling window. */
    index: number;
    date: string;
    winRate: number;
    profitFactor: number | null;
    expectancy: number;
}

/**
 * Calculates rolling metrics over a fixed number of trades. The first point
 * appears once a full window is available. A null profit factor means the
 * window contains no losing trades.
 */
export function calculateRollingMetrics(
    trades: Trade[],
    window: number
): RollingPoint[] {
    const size = Math.floor(window);

    if (size <= 0 || trades.length < size) return [];

    const chronological = [...trades].sort(
        (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()
    );
    const pnls = chronological.map((trade) => trade.profitLoss);
    const points: RollingPoint[] = [];

    let sum = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;

    for (let end = 0; end < pnls.length; end += 1) {
        const pnl = pnls[end];
        sum += pnl;

        if (pnl > 0) {
            wins += 1;
            grossProfit += pnl;
        } else if (pnl < 0) {
            losses += 1;
            grossLoss += Math.abs(pnl);
        }

        if (end >= size) {
            const removed = pnls[end - size];
            sum -= removed;

            if (removed > 0) {
                wins -= 1;
                grossProfit -= removed;
            } else if (removed < 0) {
                losses -= 1;
                grossLoss -= Math.abs(removed);
            }
        }

        if (end >= size - 1) {
            const decisive = wins + losses;

            points.push({
                index: end,
                date: chronological[end].exitTime,
                winRate: decisive === 0 ? 0 : wins / decisive,
                profitFactor: grossLoss === 0 ? null : grossProfit / grossLoss,
                expectancy: sum / size,
            });
        }
    }

    return points;
}
