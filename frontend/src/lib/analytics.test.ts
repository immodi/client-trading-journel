import { describe, expect, it } from "vitest";
import type { Trade } from "@/types/models";
import {
    calculateOverallStats,
    calculateStats,
    calculateStatsByCurrency,
    calculateStatsForMarket,
    getMarketSummaries,
    normalizeCurrency,
} from "@/lib/analytics";

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

describe("normalizeCurrency", () => {
    it("trims and upper-cases codes", () => {
        expect(normalizeCurrency("usd")).toBe("USD");
        expect(normalizeCurrency("  eur ")).toBe("EUR");
    });

    it("falls back to USD for missing codes", () => {
        expect(normalizeCurrency(null)).toBe("USD");
        expect(normalizeCurrency(undefined)).toBe("USD");
        expect(normalizeCurrency("")).toBe("USD");
    });
});

describe("calculateStatsByCurrency", () => {
    const usdTrades = [
        makeTrade({
            currency: "USD",
            instrument: "AAPL",
            profitLoss: 150,
            commission: 10,
            exitTime: "2026-01-01T10:00:00.000Z",
        }),
        makeTrade({
            currency: "USD",
            instrument: "MSFT",
            profitLoss: -50,
            commission: 5,
            exitTime: "2026-01-02T10:00:00.000Z",
        }),
    ];

    const egpTrades = [
        makeTrade({
            currency: "EGP",
            instrument: "COMI",
            profitLoss: 1000,
            commission: 100,
            exitTime: "2026-01-03T10:00:00.000Z",
        }),
        makeTrade({
            currency: "EGP",
            instrument: "HRHO",
            profitLoss: -200,
            commission: 20,
            exitTime: "2026-01-04T10:00:00.000Z",
        }),
    ];

    it("groups trades by currency, one summary per currency", () => {
        const result = calculateStatsByCurrency([...usdTrades, ...egpTrades]);

        expect(result.map((group) => group.currency)).toEqual(["EGP", "USD"]);
        expect(result).toHaveLength(2);
    });

    it("never sums monetary metrics across currencies", () => {
        const result = calculateStatsByCurrency([...usdTrades, ...egpTrades]);

        const usd = result.find((group) => group.currency === "USD")!;
        const egp = result.find((group) => group.currency === "EGP")!;

        // USD: +150 - 50 = 100 (not 900, which would combine EGP).
        expect(usd.stats.netPnl).toBe(100);
        // EGP: +1000 - 200 = 800.
        expect(egp.stats.netPnl).toBe(800);
        expect(usd.stats.netPnl).not.toBe(usd.stats.netPnl + egp.stats.netPnl);

        expect(usd.stats.averageWin).toBe(150);
        expect(usd.stats.averageLoss).toBe(50);
        expect(egp.stats.averageWin).toBe(1000);
        expect(egp.stats.averageLoss).toBe(200);

        expect(usd.stats.totalCommission).toBe(15);
        expect(egp.stats.totalCommission).toBe(120);
    });

    it("keeps best and worst trades within their own currency", () => {
        const result = calculateStatsByCurrency([...usdTrades, ...egpTrades]);

        const usd = result.find((group) => group.currency === "USD")!;
        const egp = result.find((group) => group.currency === "EGP")!;

        expect(usd.stats.bestTrade?.profitLoss).toBe(150);
        expect(usd.stats.bestTrade?.currency).toBe("USD");
        expect(usd.stats.worstTrade?.profitLoss).toBe(-50);
        expect(usd.stats.worstTrade?.currency).toBe("USD");

        // The EGP +1000 trade must never be reported as the USD best trade.
        expect(egp.stats.bestTrade?.profitLoss).toBe(1000);
        expect(egp.stats.bestTrade?.currency).toBe("EGP");
        expect(egp.stats.worstTrade?.profitLoss).toBe(-200);
        expect(egp.stats.worstTrade?.currency).toBe("EGP");
    });

    it("builds an equity curve per currency from that currency's trades only", () => {
        const result = calculateStatsByCurrency([...usdTrades, ...egpTrades]);

        const usd = result.find((group) => group.currency === "USD")!;
        const egp = result.find((group) => group.currency === "EGP")!;

        expect(usd.stats.equityCurve.map((point) => point.equity)).toEqual([150, 100]);
        expect(egp.stats.equityCurve.map((point) => point.equity)).toEqual([1000, 800]);

        // Each curve ends at its currency's net P/L, never the mixed total.
        expect(usd.stats.equityCurve.at(-1)!.equity).toBe(usd.stats.netPnl);
        expect(egp.stats.equityCurve.at(-1)!.equity).toBe(egp.stats.netPnl);
        expect(usd.stats.equityCurve).toHaveLength(usd.stats.totalTrades);
        expect(egp.stats.equityCurve).toHaveLength(egp.stats.totalTrades);
    });

    it("does not double a profit when two currencies share the same magnitude", () => {
        const result = calculateStatsByCurrency([
            makeTrade({ currency: "USD", profitLoss: 500 }),
            makeTrade({ currency: "EGP", profitLoss: 500 }),
        ]);

        expect(result).toHaveLength(2);
        expect(result.find((group) => group.currency === "USD")!.stats.netPnl).toBe(500);
        expect(result.find((group) => group.currency === "EGP")!.stats.netPnl).toBe(500);
        expect(result.some((group) => group.stats.netPnl === 1000)).toBe(false);
    });

    it("matches calculateStats when every trade shares one currency", () => {
        const result = calculateStatsByCurrency(usdTrades);
        const expected = calculateStats(usdTrades);

        expect(result).toHaveLength(1);
        expect(result[0].currency).toBe("USD");
        expect(result[0].stats).toEqual(expected);
    });

    it("returns an empty list when there are no trades", () => {
        expect(calculateStatsByCurrency([])).toEqual([]);
    });
});

describe("calculateOverallStats", () => {
    it("counts trades and win rate across currencies without producing money totals", () => {
        const trades = [
            makeTrade({ currency: "USD", profitLoss: 100 }),
            makeTrade({ currency: "USD", profitLoss: -40 }),
            makeTrade({ currency: "EGP", profitLoss: 1000 }),
            makeTrade({ currency: "EGP", profitLoss: 300 }),
            makeTrade({ currency: "EGP", profitLoss: 0 }),
        ];

        const overall = calculateOverallStats(trades);

        expect(overall.totalTrades).toBe(5);
        expect(overall.wins).toBe(3);
        expect(overall.losses).toBe(1);
        expect(overall.breakEven).toBe(1);
        expect(overall.winRate).toBeCloseTo(0.75);

        // Only count/ratio fields exist; there is nowhere for money to be summed.
        expect(Object.keys(overall).sort()).toEqual(
            ["breakEven", "losses", "totalTrades", "winRate", "wins"].sort()
        );
    });

    it("reports a zero win rate when no trade is decisive", () => {
        const overall = calculateOverallStats([
            makeTrade({ currency: "USD", profitLoss: 0 }),
        ]);

        expect(overall.winRate).toBe(0);
        expect(overall.breakEven).toBe(1);
    });
});

describe("getMarketSummaries", () => {
    it("lists each market once with its currency and trade count", () => {
        const trades = [
            makeTrade({ marketId: 2, marketName: "Egyptian Stocks", currency: "EGP" }),
            makeTrade({ marketId: 1, marketName: "US Equities", currency: "USD" }),
            makeTrade({ marketId: 1, marketName: "US Equities", currency: "USD" }),
        ];

        const markets = getMarketSummaries(trades);

        expect(markets.map((market) => market.id)).toEqual([2, 1]);
        expect(markets.map((market) => market.name)).toEqual([
            "Egyptian Stocks",
            "US Equities",
        ]);
        expect(markets.find((market) => market.id === 1)).toMatchObject({
            currency: "USD",
            tradeCount: 2,
        });
        expect(markets.find((market) => market.id === 2)).toMatchObject({
            currency: "EGP",
            tradeCount: 1,
        });
    });

    it("normalizes the market currency", () => {
        const markets = getMarketSummaries([
            makeTrade({ marketId: 5, marketName: "Cairo", currency: "egp" }),
        ]);

        expect(markets[0].currency).toBe("EGP");
    });

    it("returns an empty list when there are no trades", () => {
        expect(getMarketSummaries([])).toEqual([]);
    });
});

describe("calculateStatsForMarket", () => {
    it("only counts the selected market's trades", () => {
        const trades = [
            makeTrade({ marketId: 1, currency: "USD", profitLoss: 100, commission: 5 }),
            makeTrade({ marketId: 1, currency: "USD", profitLoss: -40, commission: 5 }),
            makeTrade({ marketId: 2, currency: "EGP", profitLoss: 1000, commission: 50 }),
        ];

        const usd = calculateStatsForMarket(trades, 1);
        const egp = calculateStatsForMarket(trades, 2);

        expect(usd.totalTrades).toBe(2);
        expect(usd.netPnl).toBe(60);
        expect(usd.totalCommission).toBe(10);
        expect(usd.equityCurve.map((point) => point.equity)).toEqual([100, 60]);

        expect(egp.totalTrades).toBe(1);
        expect(egp.netPnl).toBe(1000);
        expect(egp.equityCurve.map((point) => point.equity)).toEqual([1000]);
    });

    it("never mixes another currency into the selected market's totals", () => {
        const trades = [
            makeTrade({ marketId: 1, currency: "USD", profitLoss: 500 }),
            makeTrade({ marketId: 2, currency: "EGP", profitLoss: 500 }),
        ];

        const usd = calculateStatsForMarket(trades, 1);

        expect(usd.netPnl).toBe(500);
        expect(usd.netPnl).not.toBe(1000);
        expect(usd.equityCurve).toHaveLength(1);
        expect(usd.bestTrade?.currency).toBe("USD");
    });

    it("returns empty statistics for a market with no trades", () => {
        const stats = calculateStatsForMarket(
            [makeTrade({ marketId: 1, currency: "USD" })],
            99
        );

        expect(stats.totalTrades).toBe(0);
        expect(stats.netPnl).toBe(0);
        expect(stats.equityCurve).toEqual([]);
    });
});
