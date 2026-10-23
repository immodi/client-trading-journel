import { describe, expect, it } from "vitest";
import {
    BACKUP_FORMAT,
    BACKUP_VERSION,
    BackupError,
    backupFileName,
    createBackupDocument,
    parseBackup,
    serializeBackup,
} from "@/lib/backup";
import type { MarketRecord, TradeRecord } from "@/db/schema";
import { Direction } from "@/types/models";

const market: MarketRecord = {
    id: 7,
    name: "Futures",
    currency: "USD",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T08:00:00.000Z",
};

const trade: TradeRecord = {
    id: 11,
    marketId: 7,
    instrument: "MNQ",
    direction: Direction.Long,
    entryPrice: 100,
    exitPrice: 110,
    quantity: 2,
    pointValue: 3,
    entryTime: "2026-01-01T09:30:00.000Z",
    exitTime: "2026-01-01T10:00:00.000Z",
    commissionPerUnit: 2,
    commission: 4,
    profitLoss: 56,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
};

function backupJson(overrides: Record<string, unknown> = {}): unknown {
    return {
        ...createBackupDocument([market], [trade], "2026-10-23T12:00:00.000Z"),
        ...overrides,
    };
}

describe("createBackupDocument", () => {
    it("keeps the journal records and sorts them by id", () => {
        const document = createBackupDocument(
            [{ ...market, id: 9 }, market],
            [{ ...trade, id: 12 }, trade],
            "2026-10-23T12:00:00.000Z"
        );

        expect(document.format).toBe(BACKUP_FORMAT);
        expect(document.version).toBe(BACKUP_VERSION);
        expect(document.exportedAt).toBe("2026-10-23T12:00:00.000Z");
        expect(document.markets.map((entry) => entry.id)).toEqual([7, 9]);
        expect(document.trades.map((entry) => entry.id)).toEqual([11, 12]);
    });

    it("creates a dated file name", () => {
        expect(backupFileName(new Date("2026-10-23T12:00:00.000Z"))).toBe(
            "trading-journal-backup-2026-10-23.json"
        );
    });
});

describe("parseBackup", () => {
    it("round-trips a serialized backup", () => {
        const document = createBackupDocument(
            [market],
            [trade],
            "2026-10-23T12:00:00.000Z"
        );
        const parsed = parseBackup(JSON.parse(serializeBackup(document)));

        expect(parsed).toEqual(document);
    });

    it("accepts an empty journal", () => {
        const parsed = parseBackup(backupJson({ markets: [], trades: [] }));

        expect(parsed.markets).toEqual([]);
        expect(parsed.trades).toEqual([]);
    });

    it("recomputes derived commission and profit/loss", () => {
        const parsed = parseBackup(
            backupJson({
                trades: [{ ...trade, commission: 999, profitLoss: 999 }],
            })
        );

        expect(parsed.trades[0]).toMatchObject({
            commission: 4,
            profitLoss: 56,
        });
    });

    it("rejects a broker trade export with a pointer to trade import", () => {
        expect(() =>
            parseBackup({
                meta: { instrument: "MNQ" },
                trades: [],
            })
        ).toThrow(/Trades page/i);
    });

    it("rejects a backup from a newer app version", () => {
        expect(() =>
            parseBackup(backupJson({ version: BACKUP_VERSION + 1 }))
        ).toThrow(/only supports version/i);
    });

    it("rejects a trade whose market is missing", () => {
        expect(() =>
            parseBackup(backupJson({ markets: [], trades: [trade] }))
        ).toThrow(/market 7/i);
    });

    it("rejects duplicate market names regardless of case", () => {
        expect(() =>
            parseBackup(
                backupJson({
                    markets: [
                        market,
                        { ...market, id: 8, name: " futures " },
                    ],
                })
            )
        ).toThrow(/appears more than once/i);
    });

    it("rejects a trade with invalid values", () => {
        expect(() =>
            parseBackup(
                backupJson({ trades: [{ ...trade, quantity: 0 }] })
            )
        ).toThrow(/quantity/i);
    });

    it("reports that a malformed JSON value is not an object", () => {
        expect(() => parseBackup([])).toThrow(BackupError);
    });
});
