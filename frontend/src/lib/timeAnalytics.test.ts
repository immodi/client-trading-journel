import { describe, expect, it } from "vitest";
import type { Trade } from "@/types/models";
import {
    calculateTimeStats,
    localDateKey,
    localHour,
    localMonthKey,
    localWeekdayIndex,
    localWeekKey,
} from "@/lib/timeAnalytics";

let nextId = 1;

function makeTrade(overrides: Partial<Trade> = {}): Trade {
    const id = nextId++;

    return {
        id,
        marketId: 1,
        marketName: "US Equities",
        currency: "USD",
        instrument: "AAPL",
        direction: 0,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pointValue: 1,
        entryTime: "2026-01-05T09:30:00",
        exitTime: "2026-01-05T10:00:00",
        commissionPerUnit: 0,
        commission: 0,
        profitLoss: 0,
        createdAt: "2026-01-05T10:00:00",
        updatedAt: "2026-01-05T10:00:00",
        ...overrides,
    };
}

describe("local time keys", () => {
    it("extracts local dates, weeks, months, weekdays, and hours", () => {
        expect(localDateKey("2026-01-05T09:30:00")).toBe("2026-01-05");
        expect(localWeekKey("2026-01-05T09:30:00")).toBe("2026-01-05");
        expect(localWeekKey("2026-01-11T23:00:00")).toBe("2026-01-05");
        expect(localMonthKey("2026-02-02T09:30:00")).toBe("2026-02");
        expect(localWeekdayIndex("2026-01-05T09:30:00")).toBe(0);
        expect(localWeekdayIndex("2026-01-06T09:30:00")).toBe(1);
        expect(localHour("2026-01-05T09:30:00")).toBe(9);
    });
});

describe("calculateTimeStats", () => {
    const trades = [
        makeTrade({
            entryTime: "2026-01-05T09:30:00",
            exitTime: "2026-01-05T10:00:00",
            profitLoss: 100,
        }),
        makeTrade({
            entryTime: "2026-01-05T14:30:00",
            exitTime: "2026-01-05T15:00:00",
            profitLoss: -40,
        }),
        makeTrade({
            entryTime: "2026-01-06T09:30:00",
            exitTime: "2026-01-06T10:00:00",
            profitLoss: 60,
        }),
        makeTrade({
            entryTime: "2026-02-02T09:30:00",
            exitTime: "2026-02-02T10:00:00",
            profitLoss: 20,
        }),
    ];

    it("groups realized P/L by day, week, and month", () => {
        const stats = calculateTimeStats(trades);

        expect(stats.daily.map((day) => [day.key, day.netPnl])).toEqual([
            ["2026-01-05", 60],
            ["2026-01-06", 60],
            ["2026-02-02", 20],
        ]);
        expect(stats.weekly.map((week) => [week.key, week.netPnl])).toEqual([
            ["2026-01-05", 120],
            ["2026-02-02", 20],
        ]);
        expect(stats.monthly.map((month) => [month.key, month.netPnl])).toEqual([
            ["2026-01", 120],
            ["2026-02", 20],
        ]);
    });

    it("calculates consistency and best/worst periods", () => {
        const stats = calculateTimeStats(trades);

        expect(stats.tradingDays).toBe(3);
        expect(stats.greenDays).toBe(3);
        expect(stats.redDays).toBe(0);
        expect(stats.flatDays).toBe(0);
        expect(stats.greenDayRate).toBe(1);
        expect(stats.averageDailyPnl).toBeCloseTo(140 / 3);
        expect(stats.tradesPerDay).toBeCloseTo(4 / 3);

        expect(stats.tradingWeeks).toBe(2);
        expect(stats.greenWeeks).toBe(2);
        expect(stats.averageWeeklyPnl).toBe(70);
        expect(stats.tradesPerWeek).toBe(2);

        expect(stats.tradingMonths).toBe(2);
        expect(stats.greenMonths).toBe(2);
        expect(stats.averageMonthlyPnl).toBe(70);
        expect(stats.tradesPerMonth).toBe(2);

        expect(stats.bestDay?.key).toBe("2026-01-05");
        expect(stats.worstDay?.key).toBe("2026-02-02");
        expect(stats.bestWeek?.key).toBe("2026-01-05");
        expect(stats.worstWeek?.key).toBe("2026-02-02");
        expect(stats.bestMonth?.key).toBe("2026-01");
        expect(stats.worstMonth?.key).toBe("2026-02");
    });

    it("breaks P/L down by entry weekday", () => {
        const stats = calculateTimeStats(trades);
        const monday = stats.byWeekday.find((day) => day.weekday === 0)!;
        const tuesday = stats.byWeekday.find((day) => day.weekday === 1)!;

        expect(monday).toMatchObject({
            label: "Mon",
            totalTrades: 3,
            wins: 2,
            losses: 1,
            netPnl: 80,
        });
        expect(monday.winRate).toBeCloseTo(2 / 3);
        expect(monday.averagePnl).toBeCloseTo(80 / 3);
        expect(tuesday).toMatchObject({
            label: "Tue",
            totalTrades: 1,
            netPnl: 60,
            winRate: 1,
        });
        expect(stats.byWeekday).toHaveLength(7);
    });

    it("breaks P/L down by entry hour", () => {
        const stats = calculateTimeStats(trades);
        const nine = stats.byEntryHour.find((hour) => hour.hour === 9)!;
        const fourteen = stats.byEntryHour.find((hour) => hour.hour === 14)!;

        expect(nine).toMatchObject({
            totalTrades: 3,
            wins: 3,
            losses: 0,
            netPnl: 180,
            winRate: 1,
            averagePnl: 60,
        });
        expect(fourteen).toMatchObject({
            totalTrades: 1,
            wins: 0,
            losses: 1,
            netPnl: -40,
            winRate: 0,
            averagePnl: -40,
        });
        expect(stats.byEntryHour).toHaveLength(24);
    });

    it("returns safe defaults without trades", () => {
        const stats = calculateTimeStats([]);

        expect(stats.daily).toEqual([]);
        expect(stats.tradingDays).toBe(0);
        expect(stats.greenDayRate).toBe(0);
        expect(stats.averageDailyPnl).toBe(0);
        expect(stats.bestDay).toBeNull();
        expect(stats.byWeekday).toHaveLength(7);
        expect(stats.byEntryHour).toHaveLength(24);
    });
});
