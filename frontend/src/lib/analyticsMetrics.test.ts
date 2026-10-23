import { describe, expect, it } from "vitest";
import type { Trade } from "@/types/models";
import { calculateStats, getCurrencySummaries } from "@/lib/analytics";

let nextId = 1;

function makeTrade(overrides: Partial<Trade> = {}): Trade {
    const id = nextId++;

    return {
        id,
        marketId: 1,
        marketName: "Market",
        currency: "USD",
        instrument: "AAPL",
        direction: 0,
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

describe("calculateStats risk and quality metrics", () => {
    const trades = [
        makeTrade({ profitLoss: 100, commission: 5, exitTime: "2026-01-01T10:00:00.000Z" }),
        makeTrade({ profitLoss: 50, commission: 5, exitTime: "2026-01-01T11:00:00.000Z" }),
        makeTrade({ profitLoss: -40, commission: 5, exitTime: "2026-01-01T12:00:00.000Z" }),
        makeTrade({ profitLoss: -20, commission: 5, exitTime: "2026-01-01T13:00:00.000Z" }),
        makeTrade({ profitLoss: 10, commission: 5, exitTime: "2026-01-01T14:00:00.000Z" }),
    ];

    it("computes expectancy, median, deviation, and per-trade ratios", () => {
        const stats = calculateStats(trades);

        expect(stats.averageTrade).toBeCloseTo(20);
        expect(stats.medianTrade).toBe(10);
        expect(stats.standardDeviation).toBeCloseTo(56.1249, 3);
        expect(stats.sharpeRatio).toBeCloseTo(0.3563, 3);
        expect(stats.sortinoRatio).toBeCloseTo(1);
        expect(stats.payoffRatio).toBeCloseTo(1.7778, 3);
        expect(stats.breakEvenWinRate).toBeCloseTo(0.36, 3);
    });

    it("tracks drawdown and the underwater curve", () => {
        const stats = calculateStats(trades);

        expect(stats.equityCurve.map((point) => point.equity)).toEqual([
            100, 150, 110, 90, 100,
        ]);
        expect(stats.drawdownCurve.map((point) => point.drawdown)).toEqual([
            0, 0, 40, 60, 50,
        ]);
        expect(stats.maxDrawdown).toBe(60);
        expect(stats.currentDrawdown).toBe(50);
        expect(stats.recoveryFactor).toBeCloseTo(100 / 60);
    });

    it("tracks winning and losing streaks", () => {
        const stats = calculateStats(trades);

        expect(stats.maxWinStreak).toBe(2);
        expect(stats.maxLossStreak).toBe(2);
        expect(stats.currentStreak).toEqual({ type: "win", count: 1 });
    });

    it("reports profit concentration and outlier-excluded P/L", () => {
        const stats = calculateStats(trades);

        expect(stats.profitConcentration.map((entry) => entry.count)).toEqual([
            1, 5, 10,
        ]);
        expect(stats.profitConcentration[0]).toMatchObject({
            count: 1,
            pnl: 100,
            shareOfNetPnl: 1,
        });
        expect(stats.profitConcentration[1]).toMatchObject({
            count: 5,
            pnl: 160,
            shareOfNetPnl: 1.6,
        });
        expect(stats.profitConcentration[2]).toMatchObject({
            count: 10,
            pnl: 160,
            shareOfNetPnl: 1.6,
        });
        expect(stats.netPnlWithoutBest).toBe(0);
        expect(stats.netPnlWithoutTop5).toBe(-60);
    });

    it("sums only winning trades for top-N concentration", () => {
        const stats = calculateStats([
            makeTrade({ profitLoss: 1000, exitTime: "2026-01-01T10:00:00.000Z" }),
            makeTrade({ profitLoss: -200, exitTime: "2026-01-01T11:00:00.000Z" }),
        ]);

        expect(stats.profitConcentration[0].pnl).toBe(1000);
        expect(stats.profitConcentration[1].pnl).toBe(1000);
        expect(stats.profitConcentration[2].pnl).toBe(1000);
        expect(stats.netPnlWithoutTop5).toBe(-200);
    });

    it("reports commission drag", () => {
        const stats = calculateStats(trades);

        expect(stats.totalCommission).toBe(25);
        expect(stats.averageCommission).toBe(5);
        expect(stats.commissionToGrossProfitRatio).toBeCloseTo(25 / 160);
    });

    it("returns safe defaults for an empty journal", () => {
        const stats = calculateStats([]);

        expect(stats.averageTrade).toBe(0);
        expect(stats.standardDeviation).toBeNull();
        expect(stats.sharpeRatio).toBeNull();
        expect(stats.maxDrawdown).toBe(0);
        expect(stats.currentStreak).toEqual({ type: "none", count: 0 });
        expect(stats.equityCurve).toEqual([]);
        expect(stats.drawdownCurve).toEqual([]);
        expect(stats.profitConcentration).toEqual([]);
    });
});

describe("getCurrencySummaries", () => {
    it("counts trades and markets per normalized currency", () => {
        const summaries = getCurrencySummaries([
            makeTrade({ currency: "usd", marketId: 1 }),
            makeTrade({ currency: "USD", marketId: 2 }),
            makeTrade({ currency: "EGP", marketId: 3 }),
            makeTrade({ currency: "EGP", marketId: 3 }),
            makeTrade({ currency: "EGP", marketId: 4 }),
        ]);

        expect(summaries).toEqual([
            { currency: "EGP", tradeCount: 3, marketCount: 2 },
            { currency: "USD", tradeCount: 2, marketCount: 2 },
        ]);
    });

    it("returns an empty list without trades", () => {
        expect(getCurrencySummaries([])).toEqual([]);
    });
});
