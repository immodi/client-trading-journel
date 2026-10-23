import { Direction } from "@/types/models";

export const MAX_INSTRUMENT_LENGTH = 20;
export const MAX_MARKET_NAME_LENGTH = 100;
export const MAX_IMPORT_SIZE = 5000;

export interface TradeValues {
    instrument: string;
    direction: number;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pointValue: number;
    entryTime: string;
    exitTime: string;
    commissionPerUnit: number;
}

/** Returns a user-facing validation message, or `null` when the values are valid. */
export function validateMarket(name: string, currency: string): string | null {
    if (!name) return "Market name is required.";
    if (name.length > MAX_MARKET_NAME_LENGTH) {
        return `Market name must be ${MAX_MARKET_NAME_LENGTH} characters or fewer.`;
    }
    if (!currency) return "Currency is required.";
    if (!/^[A-Z]{3}$/.test(currency)) {
        return "Currency must be a 3-letter ISO code, for example USD.";
    }

    return null;
}

export function validateTrade(values: TradeValues): string | null {
    if (!values.instrument) return "Instrument is required.";
    if (values.instrument.length > MAX_INSTRUMENT_LENGTH) {
        return `Instrument must be ${MAX_INSTRUMENT_LENGTH} characters or fewer.`;
    }

    if (
        values.direction !== Direction.Long &&
        values.direction !== Direction.Short
    ) {
        return "Direction must be Long or Short.";
    }

    if (!Number.isInteger(values.quantity) || values.quantity <= 0) {
        return "Quantity must be a whole number greater than zero.";
    }

    if (!Number.isFinite(values.entryPrice) || values.entryPrice < 0) {
        return "Entry price must be a non-negative number.";
    }

    if (!Number.isFinite(values.exitPrice) || values.exitPrice < 0) {
        return "Exit price must be a non-negative number.";
    }

    if (!Number.isFinite(values.pointValue) || values.pointValue <= 0) {
        return "Point value must be a number greater than zero.";
    }

    if (
        !Number.isFinite(values.commissionPerUnit) ||
        values.commissionPerUnit < 0
    ) {
        return "Commission per unit must be a non-negative number.";
    }

    const entry = new Date(values.entryTime).getTime();
    const exit = new Date(values.exitTime).getTime();

    if (!Number.isFinite(entry) || !Number.isFinite(exit)) {
        return "Entry and exit times are required.";
    }

    if (exit < entry) return "Exit time cannot be before the entry time.";

    return null;
}

export function validateImport(
    pointValue: number,
    commissionPerSide: number,
    tradeCount: number
): string | null {
    if (tradeCount > MAX_IMPORT_SIZE) {
        return `A single import can contain at most ${MAX_IMPORT_SIZE} trades.`;
    }
    if (!Number.isFinite(pointValue) || pointValue <= 0) {
        return "Point value must be a number greater than zero.";
    }
    if (!Number.isFinite(commissionPerSide) || commissionPerSide < 0) {
        return "Commission per side must be a non-negative number.";
    }

    return null;
}
