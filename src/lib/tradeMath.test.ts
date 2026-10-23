import { describe, expect, it } from "vitest";
import { Direction } from "@/types/models";
import {
    calculateCommission,
    calculateProfitLoss,
    roundToFour,
} from "@/lib/tradeMath";

describe("roundToFour", () => {
    it("rounds to four decimal places", () => {
        expect(roundToFour(1.23456)).toBe(1.2346);
        expect(roundToFour(1.23444)).toBe(1.2344);
    });
});

describe("calculateCommission", () => {
    it("multiplies the per-unit rate by quantity", () => {
        expect(calculateCommission(2.5, 4)).toBe(10);
    });

    it("returns zero when there is no commission", () => {
        expect(calculateCommission(0, 10)).toBe(0);
    });
});

describe("calculateProfitLoss", () => {
    it("computes a long winner including point value and commission", () => {
        // (110 - 100) × 2 × 3 - 12 = 48
        expect(
            calculateProfitLoss(Direction.Long, 100, 110, 2, 3, 12)
        ).toBe(48);
    });

    it("computes a short winner", () => {
        // (100 - 90) × 2 × 1 - 4 = 16
        expect(
            calculateProfitLoss(Direction.Short, 100, 90, 2, 1, 4)
        ).toBe(16);
    });

    it("turns a long trade that moves against it into a loss", () => {
        // (95 - 100) × 1 × 1 - 2 = -7
        expect(
            calculateProfitLoss(Direction.Long, 100, 95, 1, 1, 2)
        ).toBe(-7);
    });

    it("turns a short trade that moves against it into a loss", () => {
        // (100 - 105) × 1 × 1 - 2 = -7
        expect(
            calculateProfitLoss(Direction.Short, 100, 105, 1, 1, 2)
        ).toBe(-7);
    });

    it("rounds floating point noise to four decimals", () => {
        const result = calculateProfitLoss(
            Direction.Long,
            0.1,
            0.3,
            1,
            1,
            0
        );

        expect(result).toBe(0.2);
    });
});
