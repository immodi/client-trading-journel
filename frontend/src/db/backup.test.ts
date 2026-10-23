import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteJournalDatabase } from "@/db/connection";
import { readBackup, restoreBackup } from "@/db/backup";
import { createMarket, listMarkets } from "@/db/markets";
import { createTrade, listTrades } from "@/db/trades";
import {
    backupFileName,
    parseBackup,
    serializeBackup,
} from "@/lib/backup";
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

describe("readBackup", () => {
    it("reads every market and trade", async () => {
        const futures = await createMarket({ name: "Futures", currency: "USD" });
        const forex = await createMarket({ name: "Forex", currency: "EUR" });
        await createTrade(tradeInput(futures.id));
        await createTrade(tradeInput(forex.id));

        const backup = await readBackup();

        expect(backup.markets).toHaveLength(2);
        expect(backup.trades).toHaveLength(2);
        expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

describe("restoreBackup", () => {
    it("round-trips a journal through a backup file", async () => {
        const market = await createMarket({ name: "Futures", currency: "USD" });
        const trade = await createTrade(tradeInput(market.id));

        const contents = serializeBackup(await readBackup());
        expect(backupFileName()).toMatch(/^trading-journal-backup-.*\.json$/);

        // Replace the journal with unrelated data before restoring.
        await createMarket({ name: "Temporary", currency: "EUR" });
        expect(await listMarkets()).toHaveLength(2);

        const result = await restoreBackup(parseBackup(JSON.parse(contents)));

        expect(result).toEqual({ markets: 1, trades: 1 });

        const markets = await listMarkets();
        expect(markets).toHaveLength(1);
        expect(markets[0]).toMatchObject({
            id: market.id,
            name: "Futures",
            currency: "USD",
            tradeCount: 1,
        });

        const trades = await listTrades();
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            id: trade.id,
            marketId: market.id,
            marketName: "Futures",
            currency: "USD",
            commission: 4,
            profitLoss: 56,
        });
    });
});
