import { describe, expect, it } from "vitest";
import {
    buildImportPlan,
    duplicateTradeKey,
    findImportConflicts,
} from "@/lib/importConflicts";
import { Direction, type ImportTradeItem, type Trade } from "@/types/models";

function imported(
    overrides: Partial<ImportTradeItem> = {}
): ImportTradeItem {
    return {
        instrument: "MNQ",
        direction: Direction.Long,
        quantity: 1,
        entryPrice: 100,
        exitPrice: 110,
        entryTime: "2026-01-01T09:30:00.000Z",
        exitTime: "2026-01-01T10:00:00.000Z",
        ...overrides,
    };
}

function existing(overrides: Partial<Trade> = {}): Trade {
    return {
        id: 10,
        marketId: 1,
        marketName: "Futures",
        currency: "USD",
        instrument: "MNQ",
        direction: Direction.Long,
        quantity: 1,
        entryPrice: 100,
        exitPrice: 110,
        pointValue: 2,
        entryTime: "2026-01-01T09:30:00.000Z",
        exitTime: "2026-01-01T10:00:00.000Z",
        commissionPerUnit: 2,
        commission: 2,
        profitLoss: 18,
        createdAt: "2026-01-01T10:01:00.000Z",
        updatedAt: "2026-01-01T10:01:00.000Z",
        ...overrides,
    };
}

describe("duplicateTradeKey", () => {
    it("normalizes instrument case and equivalent timestamps", () => {
        expect(
            duplicateTradeKey({
                instrument: " mnq ",
                entryTime: "2026-01-01T04:30:00-05:00",
                exitTime: "2026-01-01T10:00:00.000Z",
            })
        ).toBe(
            duplicateTradeKey({
                instrument: "MNQ",
                entryTime: "2026-01-01T09:30:00.000Z",
                exitTime: "2026-01-01T10:00:00.000Z",
            })
        );
    });

    it("does not consider direction, quantity, or prices", () => {
        expect(
            duplicateTradeKey(
                imported({
                    direction: Direction.Short,
                    quantity: 99,
                    entryPrice: 1,
                    exitPrice: 2,
                })
            )
        ).toBe(duplicateTradeKey(imported()));
    });
});

describe("findImportConflicts", () => {
    it("returns no conflicts for distinct trades", () => {
        expect(
            findImportConflicts(
                [
                    imported(),
                    imported({ entryTime: "2026-01-02T09:30:00.000Z" }),
                ],
                []
            )
        ).toEqual([]);
    });

    it("flags a trade already stored in the journal", () => {
        const stored = existing();

        const conflicts = findImportConflicts(
            [imported({ instrument: "mnq" })],
            [stored]
        );

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]).toMatchObject({
            kind: "existing",
            importedIndex: 0,
            existingTrade: stored,
        });
    });

    it("flags every repeated row against the first file row", () => {
        const conflicts = findImportConflicts(
            [imported(), imported({ entryPrice: 1 }), imported({ entryPrice: 2 })],
            []
        );

        expect(conflicts).toEqual([
            { kind: "file", importedIndex: 1, previousIndex: 0 },
            { kind: "file", importedIndex: 2, previousIndex: 0 },
        ]);
    });

    it("prefers the journal match when a file also repeats the timeframe", () => {
        const stored = existing();

        const conflicts = findImportConflicts(
            [imported(), imported({ entryPrice: 1 })],
            [stored]
        );

        expect(conflicts.map((conflict) => conflict.kind)).toEqual([
            "existing",
            "existing",
        ]);
    });
});

describe("buildImportPlan", () => {
    it("adds new rows and drops discarded duplicates", () => {
        const rows = [
            imported(),
            imported({ entryPrice: 1 }),
            imported({ entryTime: "2026-01-02T09:30:00.000Z" }),
        ];
        const conflicts = findImportConflicts(rows, []);

        const plan = buildImportPlan(rows, conflicts, { 1: "discard" });

        expect(plan.overwrites).toEqual([]);
        expect(plan.trades).toEqual([rows[0], rows[2]]);
    });

    it("replaces the earlier file row when a file duplicate is overwritten", () => {
        const rows = [imported(), imported({ entryPrice: 1 })];
        const conflicts = findImportConflicts(rows, []);

        const plan = buildImportPlan(rows, conflicts, { 1: "overwrite" });

        expect(plan.overwrites).toEqual([]);
        expect(plan.trades).toEqual([rows[1]]);
        // The input is not mutated.
        expect(rows[0].entryPrice).toBe(100);
    });

    it("keeps the last overwrite when a timeframe repeats more than twice", () => {
        const rows = [
            imported(),
            imported({ entryPrice: 1 }),
            imported({ entryPrice: 2 }),
        ];
        const conflicts = findImportConflicts(rows, []);

        const plan = buildImportPlan(rows, conflicts, {
            1: "overwrite",
            2: "overwrite",
        });

        expect(plan.trades).toEqual([rows[2]]);
    });

    it("collects journal overwrites and discards the imported rows", () => {
        const stored = existing();
        const laterStored = existing({
            id: 11,
            entryTime: "2026-01-03T09:30:00.000Z",
        });
        const rows = [
            imported({ entryPrice: 1 }),
            imported({ entryTime: "2026-01-03T09:30:00.000Z", entryPrice: 2 }),
            imported({ entryTime: "2026-01-04T09:30:00.000Z" }),
        ];
        const conflicts = findImportConflicts(rows, [stored, laterStored]);

        const plan = buildImportPlan(rows, conflicts, {
            0: "overwrite",
            1: "discard",
        });

        expect(plan.overwrites).toEqual([{ id: 10, trade: rows[0] }]);
        expect(plan.trades).toEqual([rows[2]]);
    });

    it("requires a decision for every conflict", () => {
        const rows = [imported(), imported()];
        const conflicts = findImportConflicts(rows, []);

        expect(() => buildImportPlan(rows, conflicts, {})).toThrow(
            /decision/i
        );
    });
});
