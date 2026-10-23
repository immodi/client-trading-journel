import type { DBSchema } from "idb";
import type { Direction } from "@/types/models";

/**
 * The records are kept free of derived/joined fields: market names and
 * currencies are resolved from the `markets` store when trades are read. That
 * keeps a market rename or currency change consistent across its trades.
 */
export interface MarketRecord {
    id: number;
    name: string;
    currency: string;
    createdAt: string;
    updatedAt: string;
}

export interface TradeRecord {
    id: number;
    marketId: number;
    instrument: string;
    direction: Direction;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pointValue: number;
    entryTime: string;
    exitTime: string;
    commissionPerUnit: number;
    commission: number;
    profitLoss: number;
    createdAt: string;
    updatedAt: string;
}

export interface TradingJournalDB extends DBSchema {
    markets: {
        key: number;
        value: MarketRecord;
    };
    trades: {
        key: number;
        value: TradeRecord;
        indexes: {
            "by-market": number;
            "by-exit-time": string;
        };
    };
}

export type NewMarketRecord = Omit<MarketRecord, "id">;
export type NewTradeRecord = Omit<TradeRecord, "id">;
