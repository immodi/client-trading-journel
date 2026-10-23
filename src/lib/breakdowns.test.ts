import { describe, expect, it } from "vitest";
import { Direction, type Trade } from "@/types/models";
import {
    calculateDirectionStats,
    calculateDurationStats,
    calculateInstrumentStats,
    calculatePnlHistogram,
    calculateRollingMetrics,
} from "@/lib/breakdowns";

let nextId = 1;

function makeTrade(overrides: Partial<Trade> = {}): Trade {
    const id = nextId++;

    return {
        id,
        marketId: 1,
        marketName: "US Equities",
        currency: "USD",
        instrument: "AAPL",
        direction: Direction.Long,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pointValue: 1,
        entryTime: "2026-01-01T09:30:00.000Z",
        exitTime: "2026-01-01T10:00:00.000Z",
        commissionPerUnit: 0,
        commission: 0,
        profitLoss: 0,
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
        ...overrides,
    };
}

describe("calculateDirectionStats", () => {
    it("separates long and short performance", () => {
        const stats = calculateDirectionStats([
            makeTrade({ direction: Direction.Long, profitLoss: 100 }),
            makeTrade({ direction: Direction.Long, profitLoss: -40 }),
            makeTrade({ direction: Direction.Short, profitLoss: 50 }),
            makeTrade({ direction: Direction.Short, profitLoss: -10 }),
        ]);

        expect(stats.map((entry) => entry.label)).toEqual(["Long", "Short"]);
        expect(stats[0]).toMatchObject({
            totalTrades: 2,
            wins: 1,
            losses: 1,
            netPnl: 60,
            averagePnl: 30,
            winRate: 0.5,
        });
        expect(stats[0].profitFactor).toBeCloseTo(2.5);
        expect(stats[1]).toMatchObject({
            totalTrades: 2,
            netPnl: 40,
            averagePnl: 20,
            winRate: 0.5,
        });
        expect(stats[1].profitFactor).toBeCloseTo(5);
    });
});

describe("calculateInstrumentStats", () => {
    it("groups by market and instrument without merging currencies", () => {
        const stats = calculateInstrumentStats([
            makeTrade({
                marketId: 1,
                marketName: "US Equities",
                currency: "USD",
                instrument: "AAPL",
                profitLoss: 100,
            }),
            makeTrade({
                marketId: 1,
                marketName: "US Equities",
                currency: "USD",
                instrument: "AAPL",
                profitLoss: -20,
            }),
            makeTrade({
                marketId: 2,
                marketName: "Egyptian Stocks",
                currency: "EGP",
                instrument: "AAPL",
                profitLoss: 50,
            }),
            makeTrade({
                marketId: 1,
                marketName: "US Equities",
                currency: "USD",
                instrument: "MSFT",
                profitLoss: -10,
            }),
        ]);

        expect(stats.map((entry) => entry.key)).toEqual([
            "1:AAPL",
            "2:AAPL",
            "1:MSFT",
        ]);
        expect(stats[0]).toMatchObject({
            instrument: "AAPL",
            marketName: "US Equities",
            currency: "USD",
            totalTrades: 2,
            netPnl: 80,
            averagePnl: 40,
        });
        expect(stats[1]).toMatchObject({
            marketName: "Egyptian Stocks",
            currency: "EGP",
            netPnl: 50,
        });
        expect(stats[2].netPnl).toBe(-10);
    });
});

describe("calculateDurationStats", () => {
    it("computes average, median, and bucket performance", () => {
        const stats = calculateDurationStats([
            makeTrade({
                entryTime: "2026-01-01T09:00:00",
                exitTime: "2026-01-01T09:02:00",
                profitLoss: 10,
            }),
            makeTrade({
                entryTime: "2026-01-01T10:00:00",
                exitTime: "2026-01-01T10:10:00",
                profitLoss: -5,
            }),
            makeTrade({
                entryTime: "2026-01-01T11:00:00",
                exitTime: "2026-01-01T13:00:00",
                profitLoss: 20,
            }),
            makeTrade({
                entryTime: "2026-01-01T14:00:00",
                exitTime: "2026-01-03T14:00:00",
                profitLoss: -10,
            }),
        ]);

        expect(stats.averageMs).toBe(45_180_000);
        expect(stats.medianMs).toBe(3_900_000);

        const byKey = Object.fromEntries(
            stats.buckets.map((bucket) => [bucket.key, bucket])
        );

        expect(byKey["under-5m"].totalTrades).toBe(1);
        expect(byKey["5-15m"].totalTrades).toBe(1);
        expect(byKey["15-60m"].totalTrades).toBe(0);
        expect(byKey["1-4h"].totalTrades).toBe(1);
        expect(byKey["4-24h"].totalTrades).toBe(0);
        expect(byKey["1-7d"].totalTrades).toBe(1);
        expect(byKey["over-7d"].totalTrades).toBe(0);
        expect(byKey["1-4h"].netPnl).toBe(20);
    });
});

describe("calculatePnlHistogram", () => {
    it("counts every trade once across evenly spaced bins", () => {
        const histogram = calculatePnlHistogram(
            [
                makeTrade({ profitLoss: -10 }),
                makeTrade({ profitLoss: 0 }),
                makeTrade({ profitLoss: 10 }),
                makeTrade({ profitLoss: 20 }),
            ],
            3
        );

        expect(histogram.min).toBe(-10);
        expect(histogram.max).toBe(20);
        expect(histogram.bins.map((bin) => bin.count)).toEqual([1, 1, 2]);
        expect(
            histogram.bins.reduce((sum, bin) => sum + bin.count, 0)
        ).toBe(4);
    });

    it("uses one bin when all trades have the same P/L", () => {
        const histogram = calculatePnlHistogram([
            makeTrade({ profitLoss: 5 }),
            makeTrade({ profitLoss: 5 }),
        ]);

        expect(histogram.bins).toEqual([{ from: 5, to: 5, count: 2 }]);
    });
});

describe("calculateRollingMetrics", () => {
    it("computes rolling win rate, profit factor, and expectancy", () => {
        const points = calculateRollingMetrics(
            [
                makeTrade({ profitLoss: 10, exitTime: "2026-01-01T10:00:00Z" }),
                makeTrade({ profitLoss: -5, exitTime: "2026-01-01T11:00:00Z" }),
                makeTrade({ profitLoss: 20, exitTime: "2026-01-01T12:00:00Z" }),
                makeTrade({ profitLoss: -10, exitTime: "2026-01-01T13:00:00Z" }),
            ],
            2
        );

        expect(points).toHaveLength(3);
        expect(points[0]).toMatchObject({
            winRate: 0.5,
            expectancy: 2.5,
        });
        expect(points[0].profitFactor).toBeCloseTo(2);
        expect(points[1].profitFactor).toBeCloseTo(4);
        expect(points[2].profitFactor).toBeCloseTo(2);
    });

    it("returns no points until a full window is available", () => {
        expect(
            calculateRollingMetrics([makeTrade({ profitLoss: 10 })], 20)
        ).toEqual([]);
    });

    it("uses null profit factor for a window with no losses", () => {
        const points = calculateRollingMetrics(
            [
                makeTrade({ profitLoss: 10, exitTime: "2026-01-01T10:00:00Z" }),
                makeTrade({ profitLoss: 20, exitTime: "2026-01-01T11:00:00Z" }),
            ],
            2
        );

        expect(points[0].profitFactor).toBeNull();
    });
});
