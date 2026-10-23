import { AppError } from "@/lib/errors";
import { validateMarket } from "@/lib/validation";
import type { CreateMarketInput, Market, UpdateMarketInput } from "@/types/models";
import { notifyDataChanged } from "./changeNotifications";
import { getDatabase } from "./connection";
import type { MarketRecord } from "./schema";

function normalize(name: string, currency: string): { name: string; currency: string } {
    return {
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
    };
}

async function assertNameAvailable(
    name: string,
    excludeId?: number
): Promise<void> {
    const database = await getDatabase();
    const markets = await database.getAll("markets");
    const key = name.toLowerCase();

    const duplicate = markets.some(
        (market) =>
            market.id !== excludeId && market.name.toLowerCase() === key
    );

    if (duplicate) {
        throw new AppError(`A market named '${name}' already exists.`);
    }
}

export async function getMarketRecord(id: number): Promise<MarketRecord> {
    const database = await getDatabase();
    const market = await database.get("markets", id);

    if (!market) {
        throw new AppError(`Market with id ${id} was not found.`);
    }

    return market;
}

function toMarket(record: MarketRecord, tradeCount: number): Market {
    return {
        id: record.id,
        name: record.name,
        currency: record.currency,
        tradeCount,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

export async function listMarkets(): Promise<Market[]> {
    const database = await getDatabase();
    const [markets, trades] = await Promise.all([
        database.getAll("markets"),
        database.getAll("trades"),
    ]);

    const tradeCounts = new Map<number, number>();

    for (const trade of trades) {
        tradeCounts.set(trade.marketId, (tradeCounts.get(trade.marketId) ?? 0) + 1);
    }

    return markets
        .map((market) => toMarket(market, tradeCounts.get(market.id) ?? 0))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

export async function createMarket(input: CreateMarketInput): Promise<Market> {
    const { name, currency } = normalize(input.name, input.currency);
    const validationError = validateMarket(name, currency);

    if (validationError) throw new AppError(validationError);

    await assertNameAvailable(name);

    const database = await getDatabase();
    const now = new Date().toISOString();
    const record = {
        name,
        currency,
        createdAt: now,
        updatedAt: now,
    };

    const id = Number(await database.add("markets", record as MarketRecord));

    notifyDataChanged();

    return toMarket({ ...record, id }, 0);
}

export async function updateMarket(
    id: number,
    input: UpdateMarketInput
): Promise<void> {
    const existing = await getMarketRecord(id);
    const { name, currency } = normalize(
        input.name ?? existing.name,
        input.currency ?? existing.currency
    );
    const validationError = validateMarket(name, currency);

    if (validationError) throw new AppError(validationError);

    await assertNameAvailable(name, id);

    const database = await getDatabase();

    await database.put("markets", {
        ...existing,
        name,
        currency,
        updatedAt: new Date().toISOString(),
    });

    notifyDataChanged();
}

export async function deleteMarket(id: number): Promise<void> {
    const market = await getMarketRecord(id);
    const database = await getDatabase();
    const tradeCount = await database.countFromIndex("trades", "by-market", id);

    // Never silently discard trade history: refuse to delete a market that
    // still has trades and tell the caller how to proceed.
    if (tradeCount > 0) {
        throw new AppError(
            `Market '${market.name}' has ${tradeCount} associated trade(s) ` +
                "and cannot be deleted. Delete or reassign those trades first."
        );
    }

    await database.delete("markets", id);

    notifyDataChanged();
}
