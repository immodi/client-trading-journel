import { Direction, type ImportTradeItem } from "@/types/models";

/** Thrown when an uploaded file is not a usable trade export. */
export class TradeImportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TradeImportError";
    }
}

export interface TradeImportPreview {
    /** Trades mapped to the shape the import uses. */
    trades: ImportTradeItem[];
    /** The instrument from the export meta, falling back to the first trade. */
    instrument: string;
    /** Point value from the export meta; applies to every imported trade. */
    pointValue: number;
    /** Per-side commission from the export meta; applies to every imported trade. */
    commissionPerSide: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function optionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requireNumber(value: unknown, field: string): number {
    const parsed = optionalNumber(value);

    if (parsed === undefined) {
        throw new TradeImportError(`"${field}" must be a number.`);
    }

    return parsed;
}

function parseDirection(value: unknown, index: number): Direction {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "long") return Direction.Long;
        if (normalized === "short") return Direction.Short;
    }

    if (value === Direction.Long || value === Direction.Short) {
        return value;
    }

    throw new TradeImportError(
        `Trade #${index + 1} needs a direction of "long" or "short".`
    );
}

/**
 * Reads an ISO timestamp, falling back to the export's Unix-seconds field when
 * the string is missing or unparseable.
 */
function parseTime(
    value: unknown,
    unix: unknown,
    field: string,
    index: number
): string {
    if (typeof value === "string" && value.trim() !== "") {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
    }

    const seconds = optionalNumber(unix);
    if (seconds !== undefined) {
        return new Date(seconds * 1000).toISOString();
    }

    throw new TradeImportError(`Trade #${index + 1} has an invalid ${field}.`);
}

/**
 * Parses a TradeReplay-style `.json` export into importable trades.
 *
 * @throws {TradeImportError} when the file is malformed or a trade is invalid.
 */
export function parseTradeExport(raw: unknown): TradeImportPreview {
    const root = asRecord(raw);

    if (!root) {
        throw new TradeImportError("The file is not a valid JSON object.");
    }

    const meta = asRecord(root.meta);

    if (!Array.isArray(root.trades)) {
        throw new TradeImportError('The file is missing a "trades" array.');
    }

    if (root.trades.length === 0) {
        throw new TradeImportError("The file does not contain any trades to import.");
    }

    const metaInstrument =
        typeof meta?.instrument === "string"
            ? meta.instrument.trim().toUpperCase()
            : "";

    const pointValue = optionalNumber(meta?.pointValue) ?? 1;

    if (pointValue <= 0) {
        throw new TradeImportError('"meta.pointValue" must be greater than zero.');
    }

    const commissionPerSide = optionalNumber(meta?.commissionPerSide) ?? 0;

    if (commissionPerSide < 0) {
        throw new TradeImportError(
            '"meta.commissionPerSide" cannot be negative.'
        );
    }

    const trades = root.trades.map((rawTrade, index): ImportTradeItem => {
        const trade = asRecord(rawTrade);

        if (!trade) {
            throw new TradeImportError(`Trade #${index + 1} is not an object.`);
        }

        const instrument = (
            typeof trade.instrument === "string" && trade.instrument.trim() !== ""
                ? trade.instrument
                : metaInstrument
        )
            .trim()
            .toUpperCase();

        if (!instrument) {
            throw new TradeImportError(`Trade #${index + 1} is missing an instrument.`);
        }

        const quantity = requireNumber(trade.quantity, `trades[${index}].quantity`);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new TradeImportError(
                `Trade #${index + 1} quantity must be a whole number greater than zero.`
            );
        }

        const entryPrice = requireNumber(trade.entryPrice, `trades[${index}].entryPrice`);
        const exitPrice = requireNumber(trade.exitPrice, `trades[${index}].exitPrice`);

        if (entryPrice < 0 || exitPrice < 0) {
            throw new TradeImportError(`Trade #${index + 1} prices cannot be negative.`);
        }

        const entryTime = parseTime(
            trade.entryTime,
            trade.entryTimeUnix,
            "entry time",
            index
        );
        const exitTime = parseTime(
            trade.exitTime,
            trade.exitTimeUnix,
            "exit time",
            index
        );

        if (new Date(exitTime) < new Date(entryTime)) {
            throw new TradeImportError(
                `Trade #${index + 1} exits before it enters.`
            );
        }

        return {
            instrument,
            direction: parseDirection(trade.direction, index),
            quantity,
            entryPrice,
            exitPrice,
            entryTime,
            exitTime,
        };
    });

    return {
        trades,
        instrument: metaInstrument || trades[0].instrument,
        pointValue,
        commissionPerSide,
    };
}
