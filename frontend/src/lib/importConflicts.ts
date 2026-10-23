import type { ImportTradeItem, ImportTradeOverwrite, Trade } from "@/types/models";

/** The two ways a user can resolve an import conflict. */
export type ImportConflictDecision = "overwrite" | "discard";

/**
 * A conflict between an imported trade and either an existing journal trade or
 * an earlier row in the same file.
 */
export type ImportConflict =
    | {
          kind: "existing";
          /** Index of the conflicting row in the imported file. */
          importedIndex: number;
          /** The trade already stored in the journal. */
          existingTrade: Trade;
      }
    | {
          kind: "file";
          /** Index of the conflicting row in the imported file. */
          importedIndex: number;
          /** Index of the first file row with the same instrument and timeframe. */
          previousIndex: number;
      };

export interface ImportPlan {
    /** Rows that should be added as new trades. */
    trades: ImportTradeItem[];
    /** Existing journal trades that should be replaced by imported values. */
    overwrites: ImportTradeOverwrite[];
}

/** Identifies a trade by the two fields that define a duplicate. */
export function duplicateTradeKey(
    trade: Pick<ImportTradeItem, "instrument" | "entryTime" | "exitTime">
): string {
    return [
        trade.instrument.trim().toUpperCase(),
        normalizeTimestamp(trade.entryTime),
        normalizeTimestamp(trade.exitTime),
    ].join("\u0000");
}

function normalizeTimestamp(value: string): string {
    const time = new Date(value).getTime();

    return Number.isNaN(time) ? value : new Date(time).toISOString();
}

/**
 * Finds every imported row that duplicates a journal trade or an earlier row in
 * the file, in the order the rows appear in the file.
 *
 * A journal trade takes precedence: if a row matches something already stored,
 * every file row with that instrument and timeframe is compared against it.
 */
export function findImportConflicts(
    imported: ImportTradeItem[],
    existingTrades: Trade[]
): ImportConflict[] {
    const existingByKey = new Map<string, Trade>();

    for (const trade of existingTrades) {
        const key = duplicateTradeKey(trade);
        if (!existingByKey.has(key)) existingByKey.set(key, trade);
    }

    const firstFileIndexByKey = new Map<string, number>();
    const conflicts: ImportConflict[] = [];

    imported.forEach((trade, importedIndex) => {
        const key = duplicateTradeKey(trade);
        const existingTrade = existingByKey.get(key);

        if (existingTrade) {
            conflicts.push({ kind: "existing", importedIndex, existingTrade });
            return;
        }

        const previousIndex = firstFileIndexByKey.get(key);

        if (previousIndex !== undefined) {
            conflicts.push({ kind: "file", importedIndex, previousIndex });
            return;
        }

        firstFileIndexByKey.set(key, importedIndex);
    });

    return conflicts;
}

/**
 * Applies the user's per-conflict decisions and produces the rows to add and
 * the existing trades to overwrite.
 *
 * @throws {Error} when any conflict has no decision yet.
 */
export function buildImportPlan(
    imported: ImportTradeItem[],
    conflicts: ImportConflict[],
    decisions: Record<number, ImportConflictDecision>
): ImportPlan {
    const working = [...imported];
    const dropped = new Set<number>();
    const overwrites = new Map<number, ImportTradeItem>();

    for (const conflict of conflicts) {
        const decision = decisions[conflict.importedIndex];

        if (!decision) {
            throw new Error("Every import conflict needs a decision.");
        }

        dropped.add(conflict.importedIndex);

        if (decision === "discard") continue;

        if (conflict.kind === "existing") {
            overwrites.set(
                conflict.existingTrade.id,
                working[conflict.importedIndex]
            );
        } else {
            working[conflict.previousIndex] = working[conflict.importedIndex];
        }
    }

    return {
        trades: working.filter((_, index) => !dropped.has(index)),
        overwrites: [...overwrites].map(([id, trade]) => ({ id, trade })),
    };
}
