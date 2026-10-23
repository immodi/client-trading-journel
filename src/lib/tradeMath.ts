import { Direction } from "@/types/models";

/** A round trip pays commission on both the entry and the exit. */
export const COMMISSION_SIDES_PER_ROUND_TRIP = 2;

/**
 * Rounds to four decimals, matching the precision the journal stores and
 * displays for money and prices.
 */
export function roundToFour(value: number): number {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/** Total commission for a trade: per-unit rate × quantity. */
export function calculateCommission(
    commissionPerUnit: number,
    quantity: number
): number {
    return roundToFour(commissionPerUnit * quantity);
}

/**
 * Net profit/loss for a closed trade:
 * `(exit − entry) × quantity × pointValue − commission` for a long trade,
 * inverted for a short trade.
 */
export function calculateProfitLoss(
    direction: Direction,
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    pointValue: number,
    commission: number
): number {
    const priceMove =
        direction === Direction.Short
            ? (entryPrice - exitPrice) * quantity
            : (exitPrice - entryPrice) * quantity;

    return roundToFour(priceMove * pointValue - commission);
}
