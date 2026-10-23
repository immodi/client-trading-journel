/**
 * Trade direction. Kept as numeric values so records stored in IndexedDB stay
 * compact and stable across releases.
 */
export const Direction = {
    Long: 0,
    Short: 1,
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

export const DIRECTION_LABELS: Record<number, string> = {
    [Direction.Long]: "Long",
    [Direction.Short]: "Short",
};

export interface Market {
    id: number;
    name: string;
    /** ISO 4217 currency code applied to every trade in the market. */
    currency: string;
    /** Number of trades currently associated with the market. */
    tradeCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMarketInput {
    name: string;
    currency: string;
}

export type UpdateMarketInput = Partial<CreateMarketInput>;

export interface Trade {
    id: number;
    marketId: number;
    marketName: string;
    /** Currency inherited from the trade's market. */
    currency: string;
    instrument: string;
    direction: Direction;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    /** Value of one price point per unit (for example 2 for MNQ, 1 for shares). */
    pointValue: number;
    entryTime: string;
    exitTime: string;
    /** Flat commission charged per unit for the full round trip (per side × 2). */
    commissionPerUnit: number;
    /** Total commission, derived as `commissionPerUnit × quantity`. */
    commission: number;
    profitLoss: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTradeInput {
    instrument: string;
    direction: Direction;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    /** Value of one price point per unit; must be greater than zero. */
    pointValue: number;
    entryTime: string;
    exitTime: string;
    /** The market the trade belongs to; its currency is inherited by the trade. */
    marketId: number;
    /** Round-trip commission charged per unit (per side × 2). */
    commissionPerUnit: number;
}

export type UpdateTradeInput = Partial<CreateTradeInput>;

/** A single trade parsed from an external export, in the shape the import expects. */
export interface ImportTradeItem {
    instrument: string;
    direction: Direction;
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    entryTime: string;
    exitTime: string;
}

export interface ImportTradesInput {
    /** Every imported trade is filed under this market. */
    marketId: number;
    /** Point value from the export meta; applies to every imported trade. */
    pointValue: number;
    /** Per-side commission from the export meta; applies to every imported trade. */
    commissionPerSide: number;
    trades: ImportTradeItem[];
}
