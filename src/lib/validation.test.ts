import { describe, expect, it } from "vitest";
import { Direction } from "@/types/models";
import {
    MAX_IMPORT_SIZE,
    validateImport,
    validateMarket,
    validateTrade,
    type TradeValues,
} from "@/lib/validation";

function validTrade(overrides: Partial<TradeValues> = {}): TradeValues {
    return {
        instrument: "MNQ",
        direction: Direction.Long,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pointValue: 2,
        entryTime: "2026-01-01T09:30:00.000Z",
        exitTime: "2026-01-01T10:00:00.000Z",
        commissionPerUnit: 2,
        ...overrides,
    };
}

describe("validateMarket", () => {
    it("accepts a valid name and currency", () => {
        expect(validateMarket("US Equities", "USD")).toBeNull();
    });

    it("requires a name", () => {
        expect(validateMarket("", "USD")).toMatch(/name/i);
    });

    it("caps the name length", () => {
        expect(validateMarket("x".repeat(101), "USD")).toMatch(/100/);
    });

    it("requires a three-letter currency code", () => {
        expect(validateMarket("US Equities", "US")).toMatch(/3-letter/i);
        expect(validateMarket("US Equities", "USDX")).toMatch(/3-letter/i);
        expect(validateMarket("US Equities", "12D")).toMatch(/3-letter/i);
    });
});

describe("validateTrade", () => {
    it("accepts a valid trade", () => {
        expect(validateTrade(validTrade())).toBeNull();
    });

    it("accepts a valid short trade", () => {
        expect(
            validateTrade(validTrade({ direction: Direction.Short }))
        ).toBeNull();
    });

    it("requires an instrument and caps its length", () => {
        expect(validateTrade(validTrade({ instrument: "" }))).toMatch(
            /instrument/i
        );
        expect(
            validateTrade(validTrade({ instrument: "x".repeat(21) }))
        ).toMatch(/20/);
    });

    it("rejects an unknown direction", () => {
        expect(validateTrade(validTrade({ direction: 2 }))).toMatch(
            /direction/i
        );
    });

    it("requires a whole, positive quantity", () => {
        expect(validateTrade(validTrade({ quantity: 0 }))).toMatch(/quantity/i);
        expect(validateTrade(validTrade({ quantity: 1.5 }))).toMatch(
            /quantity/i
        );
    });

    it("rejects negative prices", () => {
        expect(validateTrade(validTrade({ entryPrice: -1 }))).toMatch(
            /entry price/i
        );
        expect(validateTrade(validTrade({ exitPrice: -1 }))).toMatch(
            /exit price/i
        );
    });

    it("requires a positive point value", () => {
        expect(validateTrade(validTrade({ pointValue: 0 }))).toMatch(
            /point value/i
        );
    });

    it("rejects negative commission", () => {
        expect(
            validateTrade(validTrade({ commissionPerUnit: -0.01 }))
        ).toMatch(/commission/i);
    });

    it("rejects unparseable and reversed times", () => {
        expect(
            validateTrade(validTrade({ entryTime: "not a date" }))
        ).toMatch(/times/i);
        expect(
            validateTrade(
                validTrade({
                    entryTime: "2026-01-01T10:00:00.000Z",
                    exitTime: "2026-01-01T09:00:00.000Z",
                })
            )
        ).toMatch(/exits? before|before the entry/i);
    });
});

describe("validateImport", () => {
    it("accepts valid import metadata", () => {
        expect(validateImport(2, 1.25, 10)).toBeNull();
    });

    it("caps the number of imported trades", () => {
        expect(validateImport(1, 0, MAX_IMPORT_SIZE + 1)).toMatch(/5000/);
    });

    it("requires a positive point value and non-negative commission", () => {
        expect(validateImport(0, 0, 1)).toMatch(/point value/i);
        expect(validateImport(1, -1, 1)).toMatch(/commission/i);
    });
});
