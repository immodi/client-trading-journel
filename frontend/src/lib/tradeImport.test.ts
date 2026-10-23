import { describe, expect, it } from "vitest";
import { Direction } from "@/types/models";
import { parseTradeExport, TradeImportError } from "@/lib/tradeImport";

const sampleExport = {
    meta: {
        app: "TradeReplay",
        schemaVersion: 1,
        exportedAt: "2026-10-17T20:03:39.264Z",
        instrument: "MNQ",
        pointValue: 2,
        commissionPerSide: 1,
    },
    summary: {
        tradeCount: 1,
        totalNetProfitLoss: 38,
        totalCommission: 2,
    },
    trades: [
        {
            id: "7e612bdf-66b7-4c34-a995-920b98a1f907",
            instrument: "MNQ",
            direction: "long",
            quantity: 1,
            entryPrice: 14824.98,
            exitPrice: 14844.98,
            entryTime: "2021-07-11T22:00:00.000Z",
            exitTime: "2021-07-11T22:00:00.000Z",
            entryTimeUnix: 1626040800,
            exitTimeUnix: 1626040800,
            totalCommission: 2,
            grossProfitLoss: 40,
            netProfitLoss: 38,
        },
    ],
};

describe("parseTradeExport", () => {
    it("maps a TradeReplay export into importable trades", () => {
        const preview = parseTradeExport(sampleExport);

        expect(preview.instrument).toBe("MNQ");
        expect(preview.pointValue).toBe(2);
        expect(preview.commissionPerSide).toBe(1);
        expect(preview.trades).toHaveLength(1);

        expect(preview.trades[0]).toEqual({
            instrument: "MNQ",
            direction: Direction.Long,
            quantity: 1,
            entryPrice: 14824.98,
            exitPrice: 14844.98,
            entryTime: "2021-07-11T22:00:00.000Z",
            exitTime: "2021-07-11T22:00:00.000Z",
        });
    });

    it("maps the short direction", () => {
        const preview = parseTradeExport({
            meta: { instrument: "ES" },
            trades: [
                {
                    direction: "SHORT",
                    quantity: 2,
                    entryPrice: 10,
                    exitPrice: 9,
                    entryTime: "2026-01-01T00:00:00.000Z",
                    exitTime: "2026-01-01T01:00:00.000Z",
                },
            ],
        });

        expect(preview.trades[0].direction).toBe(Direction.Short);
    });

    it("falls back to meta instrument, point value, and commission per side", () => {
        const preview = parseTradeExport({
            meta: { instrument: "mnq", pointValue: 2, commissionPerSide: 1.25 },
            trades: [
                {
                    direction: "long",
                    quantity: 1,
                    entryPrice: 1,
                    exitPrice: 2,
                    entryTimeUnix: 1626040800,
                    exitTimeUnix: 1626040800,
                },
            ],
        });

        expect(preview.trades[0].instrument).toBe("MNQ");
        expect(preview.pointValue).toBe(2);
        expect(preview.commissionPerSide).toBe(1.25);
        expect(preview.trades[0].entryTime).toBe("2021-07-11T22:00:00.000Z");
    });

    it("defaults point value to one and commission to zero when meta omits them", () => {
        const preview = parseTradeExport({
            trades: [
                {
                    instrument: "AAPL",
                    direction: "long",
                    quantity: 1,
                    entryPrice: 1,
                    exitPrice: 2,
                    entryTime: "2026-01-01T00:00:00.000Z",
                    exitTime: "2026-01-01T01:00:00.000Z",
                },
            ],
        });

        expect(preview.pointValue).toBe(1);
        expect(preview.commissionPerSide).toBe(0);
    });

    it("ignores any commission stored on an individual trade", () => {
        const preview = parseTradeExport({
            meta: { commissionPerSide: 1.25 },
            trades: [
                {
                    instrument: "MNQ",
                    direction: "long",
                    quantity: 1,
                    entryPrice: 1,
                    exitPrice: 2,
                    entryTime: "2026-01-01T00:00:00.000Z",
                    exitTime: "2026-01-01T01:00:00.000Z",
                    commissionPerSide: 9.99,
                },
            ],
        });

        expect(preview.commissionPerSide).toBe(1.25);
    });

    it("rejects a non-positive meta point value", () => {
        expect(() =>
            parseTradeExport({
                meta: { pointValue: 0 },
                trades: [
                    {
                        instrument: "MNQ",
                        direction: "long",
                        quantity: 1,
                        entryPrice: 1,
                        exitPrice: 2,
                        entryTime: "2026-01-01T00:00:00.000Z",
                        exitTime: "2026-01-01T01:00:00.000Z",
                    },
                ],
            })
        ).toThrow(/pointValue/i);
    });

    it("rejects a file without a trades array", () => {
        expect(() => parseTradeExport({ meta: {} })).toThrow(TradeImportError);
    });

    it("rejects an empty trade list", () => {
        expect(() => parseTradeExport({ trades: [] })).toThrow(TradeImportError);
    });

    it("rejects an unknown direction", () => {
        expect(() =>
            parseTradeExport({
                trades: [
                    {
                        instrument: "AAPL",
                        direction: "sideways",
                        quantity: 1,
                        entryPrice: 1,
                        exitPrice: 2,
                        entryTime: "2026-01-01T00:00:00.000Z",
                        exitTime: "2026-01-01T00:00:00.000Z",
                    },
                ],
            })
        ).toThrow(/direction/i);
    });

    it("rejects a fractional quantity", () => {
        expect(() =>
            parseTradeExport({
                trades: [
                    {
                        instrument: "AAPL",
                        direction: "long",
                        quantity: 1.5,
                        entryPrice: 1,
                        exitPrice: 2,
                        entryTime: "2026-01-01T00:00:00.000Z",
                        exitTime: "2026-01-01T00:00:00.000Z",
                    },
                ],
            })
        ).toThrow(/quantity/i);
    });

    it("rejects a trade that exits before it enters", () => {
        expect(() =>
            parseTradeExport({
                trades: [
                    {
                        instrument: "AAPL",
                        direction: "long",
                        quantity: 1,
                        entryPrice: 1,
                        exitPrice: 2,
                        entryTime: "2026-01-01T01:00:00.000Z",
                        exitTime: "2026-01-01T00:00:00.000Z",
                    },
                ],
            })
        ).toThrow(/exits before/i);
    });
});
