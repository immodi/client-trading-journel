import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteJournalDatabase } from "@/db/connection";
import {
    createMarket,
    deleteMarket,
    listMarkets,
    updateMarket,
} from "@/db/markets";
import {
    createTrade,
    deleteTrade,
    importTrades,
    listTrades,
    updateTrade,
} from "@/db/trades";
import { Direction, type CreateTradeInput } from "@/types/models";

beforeEach(async () => {
    await deleteJournalDatabase();
});

afterAll(async () => {
    await deleteJournalDatabase();
});

function tradeInput(marketId: number): CreateTradeInput {
    return {
        marketId,
        instrument: "MNQ",
        direction: Direction.Long,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 2,
        pointValue: 3,
        entryTime: "2026-01-01T09:30:00.000Z",
        exitTime: "2026-01-01T10:00:00.000Z",
        commissionPerUnit: 2,
    };
}

describe("markets", () => {
    it("creates and lists a market with a normalized currency", async () => {
        const market = await createMarket({
            name: "  US Equities ",
            currency: " usd ",
        });

        expect(market.name).toBe("US Equities");
        expect(market.currency).toBe("USD");
        expect(market.tradeCount).toBe(0);

        const markets = await listMarkets();
        expect(markets).toHaveLength(1);
        expect(markets[0]).toMatchObject({
            id: market.id,
            name: "US Equities",
            currency: "USD",
            tradeCount: 0,
        });
    });

    it("rejects a duplicate name regardless of case", async () => {
        await createMarket({ name: "US Equities", currency: "USD" });

        await expect(
            createMarket({ name: "us equities", currency: "EUR" })
        ).rejects.toThrow(/already exists/i);
    });

    it("updates a market and keeps its name unique", async () => {
        const first = await createMarket({ name: "First", currency: "USD" });
        const second = await createMarket({ name: "Second", currency: "USD" });

        await updateMarket(first.id, { currency: "eur" });

        const markets = await listMarkets();
        expect(markets.find((market) => market.id === first.id)?.currency).toBe(
            "EUR"
        );

        await expect(
            updateMarket(second.id, { name: "first" })
        ).rejects.toThrow(/already exists/i);
    });

    it("refuses to delete a market that still has trades", async () => {
        const market = await createMarket({ name: "US Equities", currency: "USD" });
        const trade = await createTrade(tradeInput(market.id));

        await expect(deleteMarket(market.id)).rejects.toThrow(/associated trade/i);

        await deleteTrade(trade.id);
        await deleteMarket(market.id);

        expect(await listMarkets()).toEqual([]);
    });
});

describe("trades", () => {
    it("derives commission and profit/loss on create", async () => {
        const market = await createMarket({ name: "Futures", currency: "USD" });
        const trade = await createTrade(tradeInput(market.id));

        // commission = 2 × 2 = 4
        expect(trade.commission).toBe(4);
        // (110 − 100) × 2 × 3 − 4 = 56
        expect(trade.profitLoss).toBe(56);
        expect(trade.marketName).toBe("Futures");
        expect(trade.currency).toBe("USD");
    });

    it("re-derives commission and profit/loss when a trade is edited", async () => {
        const market = await createMarket({ name: "Futures", currency: "USD" });
        const trade = await createTrade(tradeInput(market.id));

        await updateTrade(trade.id, { exitPrice: 105, quantity: 3 });

        const [updated] = await listTrades();
        // commission = 2 × 3 = 6
        expect(updated.commission).toBe(6);
        // (105 − 100) × 3 × 3 − 6 = 39
        expect(updated.profitLoss).toBe(39);
    });

    it("rejects an invalid update without writing it", async () => {
        const market = await createMarket({ name: "Futures", currency: "USD" });
        const trade = await createTrade(tradeInput(market.id));

        await expect(
            updateTrade(trade.id, { quantity: 0 })
        ).rejects.toThrow(/quantity/i);

        const [unchanged] = await listTrades();
        expect(unchanged.quantity).toBe(2);
        expect(unchanged.profitLoss).toBe(56);
    });

    it("joins the current market name and currency", async () => {
        const market = await createMarket({ name: "Old name", currency: "USD" });
        await createTrade(tradeInput(market.id));

        await updateMarket(market.id, { name: "New name", currency: "EUR" });

        const [trade] = await listTrades();
        expect(trade.marketName).toBe("New name");
        expect(trade.currency).toBe("EUR");
    });

    it("deletes a trade", async () => {
        const market = await createMarket({ name: "Futures", currency: "USD" });
        const trade = await createTrade(tradeInput(market.id));

        await deleteTrade(trade.id);

        expect(await listTrades()).toEqual([]);
    });
});

describe("importTrades", () => {
    it("imports rows with the batch point value and per-side commission", async () => {
        const market = await createMarket({ name: "Futures", currency: "USD" });

        const imported = await importTrades({
            marketId: market.id,
            pointValue: 2,
            commissionPerSide: 1,
            trades: [
                {
                    instrument: "MNQ",
                    direction: Direction.Long,
                    quantity: 1,
                    entryPrice: 100,
                    exitPrice: 110,
                    entryTime: "2026-01-01T09:30:00.000Z",
                    exitTime: "2026-01-01T10:00:00.000Z",
                },
                {
                    instrument: "MNQ",
                    direction: Direction.Short,
                    quantity: 2,
                    entryPrice: 100,
                    exitPrice: 95,
                    entryTime: "2026-01-02T09:30:00.000Z",
                    exitTime: "2026-01-02T10:00:00.000Z",
                },
            ],
        });

        expect(imported).toBe(2);

        const trades = await listTrades();
        expect(trades).toHaveLength(2);
        // Per-side 1 is doubled to 2 per unit; qty 1 → commission 2.
        expect(trades[1]).toMatchObject({ commission: 2, profitLoss: 18 });
        // Short: (100 − 95) × 2 × 2 − 4 = 16.
        expect(trades[0]).toMatchObject({ commission: 4, profitLoss: 16 });
    });

    it("rejects the whole batch when any row is invalid", async () => {
        const market = await createMarket({ name: "Futures", currency: "USD" });

        await expect(
            importTrades({
                marketId: market.id,
                pointValue: 2,
                commissionPerSide: 1,
                trades: [
                    {
                        instrument: "MNQ",
                        direction: Direction.Long,
                        quantity: 1,
                        entryPrice: 100,
                        exitPrice: 110,
                        entryTime: "2026-01-01T09:30:00.000Z",
                        exitTime: "2026-01-01T10:00:00.000Z",
                    },
                    {
                        instrument: "MNQ",
                        direction: Direction.Long,
                        quantity: 0,
                        entryPrice: 100,
                        exitPrice: 110,
                        entryTime: "2026-01-01T09:30:00.000Z",
                        exitTime: "2026-01-01T10:00:00.000Z",
                    },
                ],
            })
        ).rejects.toThrow(/Trade #2.*quantity/i);

        expect(await listTrades()).toEqual([]);
    });

    it("refuses to import into a market that does not exist", async () => {
        await expect(
            importTrades({
                marketId: 999,
                pointValue: 1,
                commissionPerSide: 0,
                trades: [],
            })
        ).rejects.toThrow(/not found/i);
    });
});
