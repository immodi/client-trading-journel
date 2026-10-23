import type { MarketRecord, TradeRecord } from "@/db/schema";
import {
    calculateCommission,
    calculateProfitLoss,
    roundToFour,
} from "@/lib/tradeMath";
import { validateMarket, validateTrade } from "@/lib/validation";
import { Direction } from "@/types/models";

export const BACKUP_FORMAT = "trading-journal-backup";
export const BACKUP_VERSION = 1;

/** Thrown when a file is not a valid whole-journal backup. */
export class BackupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BackupError";
    }
}

/**
 * The complete contents of the journal. Unlike a broker trade export, a backup
 * carries markets, trade records, identifiers, and timestamps so it can restore
 * the journal exactly as it was.
 */
export interface BackupDocument {
    format: typeof BACKUP_FORMAT;
    version: number;
    exportedAt: string;
    markets: MarketRecord[];
    trades: TradeRecord[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
    const record = asRecord(value);

    if (!record) throw new BackupError(message);

    return record;
}

function requirePositiveInteger(value: unknown, field: string): number {
    if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value <= 0 ||
        !Number.isSafeInteger(value)
    ) {
        throw new BackupError(`"${field}" must be a positive whole number.`);
    }

    return value;
}

function requireNumber(value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new BackupError(`"${field}" must be a number.`);
    }

    return value;
}

function normalizeTimestamp(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim() === "") {
        throw new BackupError(`"${field}" must be a date.`);
    }

    const time = new Date(value).getTime();

    if (!Number.isFinite(time)) {
        throw new BackupError(`"${field}" must be a valid date.`);
    }

    return new Date(time).toISOString();
}

/**
 * Builds a backup document from the records stored in IndexedDB. Records are
 * sorted by id so repeated exports of the same journal are easy to compare.
 */
export function createBackupDocument(
    markets: MarketRecord[],
    trades: TradeRecord[],
    exportedAt = new Date().toISOString()
): BackupDocument {
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt,
        markets: [...markets].sort((a, b) => a.id - b.id),
        trades: [...trades].sort((a, b) => a.id - b.id),
    };
}

export function serializeBackup(document: BackupDocument): string {
    return JSON.stringify(document, null, 2);
}

/** A filename that makes it clear the file is a full journal backup. */
export function backupFileName(date = new Date()): string {
    return `trading-journal-backup-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Validates a backup file and returns the records to restore. Every record is
 * checked before anything is written, so a malformed file can never leave the
 * journal partially replaced. Derived commission and profit/loss are recomputed
 * from the trade's inputs, matching how the data layer writes trades.
 *
 * @throws {BackupError} when the file is not a supported, valid backup.
 */
export function parseBackup(raw: unknown): BackupDocument {
    const root = asRecord(raw);

    if (!root) {
        throw new BackupError("The backup file is not a valid JSON object.");
    }

    if (root.format !== BACKUP_FORMAT) {
        throw new BackupError(
            "This is not a Trading Journal backup file. To import a broker export, use Import on the Trades page."
        );
    }

    if (typeof root.version !== "number" || !Number.isInteger(root.version)) {
        throw new BackupError("The backup file is missing a valid version.");
    }

    if (root.version !== BACKUP_VERSION) {
        throw new BackupError(
            root.version > BACKUP_VERSION
                ? `This backup uses version ${root.version}, but this app only supports version ${BACKUP_VERSION}. Update the app and try again.`
                : `Backup version ${root.version} is not supported. This app supports version ${BACKUP_VERSION}.`
        );
    }

    if (!Array.isArray(root.markets)) {
        throw new BackupError('The backup file is missing a "markets" array.');
    }

    if (!Array.isArray(root.trades)) {
        throw new BackupError('The backup file is missing a "trades" array.');
    }

    const exportedAt = normalizeTimestamp(root.exportedAt, "exportedAt");
    const marketIds = new Set<number>();
    const marketNames = new Set<string>();

    const markets = root.markets.map((rawMarket, index): MarketRecord => {
        const label = `Market #${index + 1}`;
        const market = requireRecord(rawMarket, `${label} is not an object.`);

        const id = requirePositiveInteger(market.id, `markets[${index}].id`);

        if (marketIds.has(id)) {
            throw new BackupError(`Market id ${id} appears more than once.`);
        }

        marketIds.add(id);

        const name = typeof market.name === "string" ? market.name.trim() : "";
        const currency =
            typeof market.currency === "string"
                ? market.currency.trim().toUpperCase()
                : "";
        const validationError = validateMarket(name, currency);

        if (validationError) {
            throw new BackupError(`${label}: ${validationError}`);
        }

        const nameKey = name.toLowerCase();

        if (marketNames.has(nameKey)) {
            throw new BackupError(`Market name '${name}' appears more than once.`);
        }

        marketNames.add(nameKey);

        return {
            id,
            name,
            currency,
            createdAt: normalizeTimestamp(
                market.createdAt,
                `markets[${index}].createdAt`
            ),
            updatedAt: normalizeTimestamp(
                market.updatedAt,
                `markets[${index}].updatedAt`
            ),
        };
    });

    const tradeIds = new Set<number>();

    const trades = root.trades.map((rawTrade, index): TradeRecord => {
        const label = `Trade #${index + 1}`;
        const trade = requireRecord(rawTrade, `${label} is not an object.`);

        const id = requirePositiveInteger(trade.id, `trades[${index}].id`);

        if (tradeIds.has(id)) {
            throw new BackupError(`Trade id ${id} appears more than once.`);
        }

        tradeIds.add(id);

        const marketId = requirePositiveInteger(
            trade.marketId,
            `trades[${index}].marketId`
        );

        if (!marketIds.has(marketId)) {
            throw new BackupError(
                `${label} refers to market ${marketId}, which is not in this backup.`
            );
        }

        if (trade.direction !== Direction.Long && trade.direction !== Direction.Short) {
            throw new BackupError(`${label}: direction must be Long or Short.`);
        }

        const direction = trade.direction;
        const instrument =
            typeof trade.instrument === "string"
                ? trade.instrument.trim().toUpperCase()
                : "";

        const values = {
            instrument,
            direction,
            entryPrice: roundToFour(
                requireNumber(trade.entryPrice, `trades[${index}].entryPrice`)
            ),
            exitPrice: roundToFour(
                requireNumber(trade.exitPrice, `trades[${index}].exitPrice`)
            ),
            quantity: requireNumber(trade.quantity, `trades[${index}].quantity`),
            pointValue: roundToFour(
                requireNumber(trade.pointValue, `trades[${index}].pointValue`)
            ),
            entryTime: normalizeTimestamp(
                trade.entryTime,
                `trades[${index}].entryTime`
            ),
            exitTime: normalizeTimestamp(
                trade.exitTime,
                `trades[${index}].exitTime`
            ),
            commissionPerUnit: roundToFour(
                requireNumber(
                    trade.commissionPerUnit,
                    `trades[${index}].commissionPerUnit`
                )
            ),
        };

        const validationError = validateTrade(values);

        if (validationError) {
            throw new BackupError(`${label}: ${validationError}`);
        }

        const commission = calculateCommission(
            values.commissionPerUnit,
            values.quantity
        );

        return {
            id,
            marketId,
            ...values,
            commission,
            profitLoss: calculateProfitLoss(
                direction,
                values.entryPrice,
                values.exitPrice,
                values.quantity,
                values.pointValue,
                commission
            ),
            createdAt: normalizeTimestamp(
                trade.createdAt,
                `trades[${index}].createdAt`
            ),
            updatedAt: normalizeTimestamp(
                trade.updatedAt,
                `trades[${index}].updatedAt`
            ),
        };
    });

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt,
        markets,
        trades,
    };
}
