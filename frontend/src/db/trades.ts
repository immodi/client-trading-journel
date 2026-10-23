import { AppError } from "@/lib/errors";
import { duplicateTradeKey } from "@/lib/importConflicts";
import {
    COMMISSION_SIDES_PER_ROUND_TRIP,
    calculateCommission,
    calculateProfitLoss,
    roundToFour,
} from "@/lib/tradeMath";
import { validateImport, validateTrade, type TradeValues } from "@/lib/validation";
import type {
    CreateTradeInput,
    Direction,
    ImportTradesInput,
    Trade,
    UpdateTradeInput,
} from "@/types/models";
import { notifyDataChanged } from "./changeNotifications";
import { getDatabase } from "./connection";
import { getMarketRecord } from "./markets";
import type { MarketRecord, NewTradeRecord, TradeRecord } from "./schema";

/** Validates the merged values and normalizes them before they are stored. */
function prepareTradeValues(values: TradeValues, prefix = ""): TradeValues {
    const trimmed: TradeValues = {
        ...values,
        instrument: values.instrument.trim(),
    };

    const validationError = validateTrade(trimmed);

    if (validationError) {
        throw new AppError(`${prefix}${validationError}`);
    }

    return {
        ...trimmed,
        instrument: trimmed.instrument.toUpperCase(),
        entryPrice: roundToFour(trimmed.entryPrice),
        exitPrice: roundToFour(trimmed.exitPrice),
        pointValue: roundToFour(trimmed.pointValue),
        commissionPerUnit: roundToFour(trimmed.commissionPerUnit),
        entryTime: new Date(trimmed.entryTime).toISOString(),
        exitTime: new Date(trimmed.exitTime).toISOString(),
    };
}

/**
 * Combines the entered values with the derived commission and profit/loss.
 * Both derived fields are always recomputed here, never accepted from input.
 */
function toRecord(
    values: TradeValues,
    marketId: number,
    createdAt: string,
    updatedAt: string
): NewTradeRecord {
    const direction = values.direction as Direction;
    const commission = calculateCommission(
        values.commissionPerUnit,
        values.quantity
    );
    const profitLoss = calculateProfitLoss(
        direction,
        values.entryPrice,
        values.exitPrice,
        values.quantity,
        values.pointValue,
        commission
    );

    return {
        marketId,
        instrument: values.instrument,
        direction,
        entryPrice: values.entryPrice,
        exitPrice: values.exitPrice,
        quantity: values.quantity,
        pointValue: values.pointValue,
        entryTime: values.entryTime,
        exitTime: values.exitTime,
        commissionPerUnit: values.commissionPerUnit,
        commission,
        profitLoss,
        createdAt,
        updatedAt,
    };
}

function toTrade(record: TradeRecord, market: MarketRecord | undefined): Trade {
    return {
        id: record.id,
        marketId: record.marketId,
        marketName: market?.name ?? "Unknown market",
        currency: market?.currency ?? "USD",
        instrument: record.instrument,
        direction: record.direction,
        entryPrice: record.entryPrice,
        exitPrice: record.exitPrice,
        quantity: record.quantity,
        pointValue: record.pointValue,
        entryTime: record.entryTime,
        exitTime: record.exitTime,
        commissionPerUnit: record.commissionPerUnit,
        commission: record.commission,
        profitLoss: record.profitLoss,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

function inputToValues(input: CreateTradeInput): TradeValues {
    return {
        instrument: input.instrument,
        direction: input.direction,
        entryPrice: input.entryPrice,
        exitPrice: input.exitPrice,
        quantity: input.quantity,
        pointValue: input.pointValue,
        entryTime: input.entryTime,
        exitTime: input.exitTime,
        commissionPerUnit: input.commissionPerUnit,
    };
}

export async function listTrades(): Promise<Trade[]> {
    const database = await getDatabase();
    const [records, markets] = await Promise.all([
        database.getAll("trades"),
        database.getAll("markets"),
    ]);

    const marketById = new Map(markets.map((market) => [market.id, market]));

    return records
        .map((record) => toTrade(record, marketById.get(record.marketId)))
        .sort(
            (a, b) =>
                new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime() ||
                b.id - a.id
        );
}

export async function createTrade(input: CreateTradeInput): Promise<Trade> {
    const market = await getMarketRecord(input.marketId);
    const values = prepareTradeValues(inputToValues(input));
    const database = await getDatabase();
    const now = new Date().toISOString();
    const record = toRecord(values, market.id, now, now);
    const id = Number(await database.add("trades", record as TradeRecord));

    notifyDataChanged();

    return toTrade({ ...record, id }, market);
}

export async function updateTrade(
    id: number,
    input: UpdateTradeInput
): Promise<void> {
    const database = await getDatabase();
    const existing = await database.get("trades", id);

    if (!existing) {
        throw new AppError(`Trade with id ${id} was not found.`);
    }

    const market = await getMarketRecord(input.marketId ?? existing.marketId);
    const values = prepareTradeValues({
        instrument: input.instrument ?? existing.instrument,
        direction: input.direction ?? existing.direction,
        entryPrice: input.entryPrice ?? existing.entryPrice,
        exitPrice: input.exitPrice ?? existing.exitPrice,
        quantity: input.quantity ?? existing.quantity,
        pointValue: input.pointValue ?? existing.pointValue,
        entryTime: input.entryTime ?? existing.entryTime,
        exitTime: input.exitTime ?? existing.exitTime,
        commissionPerUnit:
            input.commissionPerUnit ?? existing.commissionPerUnit,
    });

    // Re-derive the commission and profit/loss from the merged values, just as
    // they were derived when the trade was created.
    const record = toRecord(
        values,
        market.id,
        existing.createdAt,
        new Date().toISOString()
    );

    await database.put("trades", { ...record, id });

    notifyDataChanged();
}

export async function deleteTrade(id: number): Promise<void> {
    const database = await getDatabase();
    const existing = await database.get("trades", id);

    if (!existing) {
        throw new AppError(`Trade with id ${id} was not found.`);
    }

    await database.delete("trades", id);

    notifyDataChanged();
}

/**
 * Bulk-adds trades under one market and applies any user-chosen overwrites.
 * Every row is validated and duplicate-checked before the first write, so an
 * invalid or unresolved import never produces a partial write.
 */
export async function importTrades(input: ImportTradesInput): Promise<number> {
    const market = await getMarketRecord(input.marketId);
    const overwrites = input.overwrites ?? [];

    if (input.trades.length === 0 && overwrites.length === 0) return 0;

    const importError = validateImport(
        input.pointValue,
        input.commissionPerSide,
        input.trades.length + overwrites.length
    );

    if (importError) throw new AppError(importError);

    const now = new Date().toISOString();
    const commissionPerUnit = roundToFour(
        input.commissionPerSide * COMMISSION_SIDES_PER_ROUND_TRIP
    );

    const database = await getDatabase();
    const existingRecords = await database.getAll("trades");
    const existingById = new Map(
        existingRecords.map((record) => [record.id, record])
    );

    function prepareImportRecord(
        trade: ImportTradesInput["trades"][number],
        prefix: string
    ) {
        const values = prepareTradeValues(
            {
                instrument: trade.instrument,
                direction: trade.direction,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                quantity: trade.quantity,
                pointValue: input.pointValue,
                entryTime: trade.entryTime,
                exitTime: trade.exitTime,
                commissionPerUnit,
            },
            prefix
        );

        return toRecord(values, market.id, now, now);
    }

    const records = input.trades.map((trade, index) =>
        prepareImportRecord(trade, `Trade #${index + 1}: `)
    );

    const overwriteRecords = overwrites.map((overwrite, index) => {
        const existing = existingById.get(overwrite.id);

        if (!existing) {
            throw new AppError(
                `Trade with id ${overwrite.id} was not found.`
            );
        }

        return {
            ...prepareImportRecord(
                overwrite.trade,
                `Overwrite #${index + 1}: `
            ),
            id: existing.id,
            createdAt: existing.createdAt,
        } satisfies TradeRecord;
    });

    // Duplicate detection is instrument + entry/exit timeframe. Overwritten
    // trades are excluded from the journal side because they are being replaced.
    const overwrittenIds = new Set(overwriteRecords.map((record) => record.id));
    const existingKeys = new Set(
        existingRecords
            .filter((record) => !overwrittenIds.has(record.id))
            .map(duplicateTradeKey)
    );
    const incomingKeys = new Set<string>();

    for (const record of [...records, ...overwriteRecords]) {
        const key = duplicateTradeKey(record);

        if (incomingKeys.has(key)) {
            throw new AppError(
                `The import contains duplicate ${record.instrument} trades with the same entry and exit time.`
            );
        }

        incomingKeys.add(key);
    }

    // New rows must not collide with journal trades. Overwritten trades are
    // excluded because they are being replaced; their ids are verified above.
    for (const record of records) {
        if (existingKeys.has(duplicateTradeKey(record))) {
            throw new AppError(
                `A ${record.instrument} trade with the same entry and exit time already exists. Resolve the duplicate before importing.`
            );
        }
    }

    const transaction = database.transaction("trades", "readwrite");

    await Promise.all([
        ...records.map((record) =>
            transaction.store.add(record as TradeRecord)
        ),
        ...overwriteRecords.map((record) => transaction.store.put(record)),
    ]);
    await transaction.done;

    notifyDataChanged();

    return records.length + overwriteRecords.length;
}
