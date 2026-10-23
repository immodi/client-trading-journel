import type { Trade } from "@/types/models";

export interface AggregateStats {
    totalTrades: number;
    wins: number;
    losses: number;
    breakEven: number;
    netPnl: number;
    winRate: number;
    averagePnl: number;
}

export interface DailyStats extends AggregateStats {
    /** Local calendar date in YYYY-MM-DD form. */
    key: string;
}

export interface WeeklyStats extends AggregateStats {
    /** Local date of the Monday that starts the week, in YYYY-MM-DD form. */
    key: string;
}

export interface MonthlyStats extends AggregateStats {
    /** Local month in YYYY-MM form. */
    key: string;
    year: number;
    /** 1-12. */
    month: number;
}

export interface WeekdayStats extends AggregateStats {
    /** 0 = Monday, 6 = Sunday. */
    weekday: number;
    label: string;
}

export interface HourStats extends AggregateStats {
    /** Local entry hour, 0-23. */
    hour: number;
}

export interface TimeStats {
    daily: DailyStats[];
    weekly: WeeklyStats[];
    monthly: MonthlyStats[];

    tradingDays: number;
    greenDays: number;
    redDays: number;
    flatDays: number;
    greenDayRate: number;
    averageDailyPnl: number;
    tradesPerDay: number;

    tradingWeeks: number;
    greenWeeks: number;
    greenWeekRate: number;
    averageWeeklyPnl: number;
    tradesPerWeek: number;

    tradingMonths: number;
    greenMonths: number;
    greenMonthRate: number;
    averageMonthlyPnl: number;
    tradesPerMonth: number;

    bestDay: DailyStats | null;
    worstDay: DailyStats | null;
    bestWeek: WeeklyStats | null;
    worstWeek: WeeklyStats | null;
    bestMonth: MonthlyStats | null;
    worstMonth: MonthlyStats | null;

    byWeekday: WeekdayStats[];
    byEntryHour: HourStats[];
}

interface Aggregate {
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    breakEven: number;
}

export const WEEKDAY_LABELS = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
] as const;

function emptyAggregate(): Aggregate {
    return { pnl: 0, trades: 0, wins: 0, losses: 0, breakEven: 0 };
}

function addTrade(aggregate: Aggregate, pnl: number): void {
    aggregate.pnl += pnl;
    aggregate.trades += 1;

    if (pnl > 0) aggregate.wins += 1;
    else if (pnl < 0) aggregate.losses += 1;
    else aggregate.breakEven += 1;
}

function finalize(aggregate: Aggregate): AggregateStats {
    const decisive = aggregate.wins + aggregate.losses;

    return {
        totalTrades: aggregate.trades,
        wins: aggregate.wins,
        losses: aggregate.losses,
        breakEven: aggregate.breakEven,
        netPnl: aggregate.pnl,
        winRate: decisive === 0 ? 0 : aggregate.wins / decisive,
        averagePnl:
            aggregate.trades === 0 ? 0 : aggregate.pnl / aggregate.trades,
    };
}

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

function formatLocalDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}`;
}

export function localDateKey(iso: string): string {
    return formatLocalDate(new Date(iso));
}

/**
 * Returns the local Monday of the week containing the timestamp. Using a date
 * key rather than an ISO week number keeps the grouping stable across years
 * and avoids locale-specific week-number rules.
 */
export function localWeekKey(iso: string): string {
    const date = new Date(iso);
    date.setHours(0, 0, 0, 0);

    const daysSinceMonday = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - daysSinceMonday);

    return formatLocalDate(date);
}

export function localMonthKey(iso: string): string {
    const date = new Date(iso);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** 0 = Monday, 6 = Sunday. */
export function localWeekdayIndex(iso: string): number {
    return (new Date(iso).getDay() + 6) % 7;
}

export function localHour(iso: string): number {
    return new Date(iso).getHours();
}

function bestBy<T extends { netPnl: number }>(items: T[]): T | null {
    return items.reduce<T | null>(
        (best, item) => (best === null || item.netPnl > best.netPnl ? item : best),
        null
    );
}

function worstBy<T extends { netPnl: number }>(items: T[]): T | null {
    return items.reduce<T | null>(
        (worst, item) =>
            worst === null || item.netPnl < worst.netPnl ? item : worst,
        null
    );
}

function addToMap(
    map: Map<string, Aggregate>,
    key: string,
    pnl: number
): void {
    const aggregate = map.get(key);

    if (aggregate) addTrade(aggregate, pnl);
    else {
        const next = emptyAggregate();
        addTrade(next, pnl);
        map.set(key, next);
    }
}

/**
 * Groups realized P/L by local exit day, exit week, and exit month, then adds
 * entry-time weekday and hour breakdowns. Daily, weekly, and monthly monetary
 * figures must belong to a single currency.
 */
export function calculateTimeStats(trades: Trade[]): TimeStats {
    const dailyMap = new Map<string, Aggregate>();
    const weeklyMap = new Map<string, Aggregate>();
    const monthlyMap = new Map<string, Aggregate>();
    const weekdayAggregates = Array.from({ length: 7 }, emptyAggregate);
    const hourAggregates = Array.from({ length: 24 }, emptyAggregate);

    for (const trade of trades) {
        addToMap(dailyMap, localDateKey(trade.exitTime), trade.profitLoss);
        addToMap(weeklyMap, localWeekKey(trade.exitTime), trade.profitLoss);
        addToMap(monthlyMap, localMonthKey(trade.exitTime), trade.profitLoss);

        addTrade(
            weekdayAggregates[localWeekdayIndex(trade.entryTime)],
            trade.profitLoss
        );
        addTrade(hourAggregates[localHour(trade.entryTime)], trade.profitLoss);
    }

    const daily = Array.from(dailyMap, ([key, aggregate]) => ({
        key,
        ...finalize(aggregate),
    })).sort((a, b) => a.key.localeCompare(b.key));

    const weekly = Array.from(weeklyMap, ([key, aggregate]) => ({
        key,
        ...finalize(aggregate),
    })).sort((a, b) => a.key.localeCompare(b.key));

    const monthly = Array.from(monthlyMap, ([key, aggregate]) => {
        const [year, month] = key.split("-").map(Number);

        return {
            key,
            year,
            month,
            ...finalize(aggregate),
        };
    }).sort((a, b) => a.key.localeCompare(b.key));

    const netPnl = trades.reduce((sum, trade) => sum + trade.profitLoss, 0);

    const greenDays = daily.filter((day) => day.netPnl > 0).length;
    const redDays = daily.filter((day) => day.netPnl < 0).length;
    const flatDays = daily.filter((day) => day.netPnl === 0).length;
    const greenWeeks = weekly.filter((week) => week.netPnl > 0).length;
    const greenMonths = monthly.filter((month) => month.netPnl > 0).length;

    return {
        daily,
        weekly,
        monthly,
        tradingDays: daily.length,
        greenDays,
        redDays,
        flatDays,
        greenDayRate: daily.length === 0 ? 0 : greenDays / daily.length,
        averageDailyPnl: daily.length === 0 ? 0 : netPnl / daily.length,
        tradesPerDay: daily.length === 0 ? 0 : trades.length / daily.length,
        tradingWeeks: weekly.length,
        greenWeeks,
        greenWeekRate: weekly.length === 0 ? 0 : greenWeeks / weekly.length,
        averageWeeklyPnl: weekly.length === 0 ? 0 : netPnl / weekly.length,
        tradesPerWeek: weekly.length === 0 ? 0 : trades.length / weekly.length,
        tradingMonths: monthly.length,
        greenMonths,
        greenMonthRate:
            monthly.length === 0 ? 0 : greenMonths / monthly.length,
        averageMonthlyPnl: monthly.length === 0 ? 0 : netPnl / monthly.length,
        tradesPerMonth:
            monthly.length === 0 ? 0 : trades.length / monthly.length,
        bestDay: bestBy(daily),
        worstDay: worstBy(daily),
        bestWeek: bestBy(weekly),
        worstWeek: worstBy(weekly),
        bestMonth: bestBy(monthly),
        worstMonth: worstBy(monthly),
        byWeekday: WEEKDAY_LABELS.map((label, weekday) => ({
            weekday,
            label,
            ...finalize(weekdayAggregates[weekday]),
        })),
        byEntryHour: Array.from({ length: 24 }, (_, hour) => ({
            hour,
            ...finalize(hourAggregates[hour]),
        })),
    };
}
