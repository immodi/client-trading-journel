import {
    createBackupDocument,
    type BackupDocument,
} from "@/lib/backup";
import { notifyDataChanged } from "./changeNotifications";
import { getDatabase } from "./connection";

export interface RestoreResult {
    markets: number;
    trades: number;
}

/** Reads every market and trade in the local journal into one backup document. */
export async function readBackup(): Promise<BackupDocument> {
    const database = await getDatabase();
    const [markets, trades] = await Promise.all([
        database.getAll("markets"),
        database.getAll("trades"),
    ]);

    return createBackupDocument(markets, trades);
}

/**
 * Replaces the whole journal with a previously validated backup. Both stores
 * are cleared and repopulated in a single transaction, so a failure leaves the
 * existing journal untouched. The caller must run {@link parseBackup} first.
 */
export async function restoreBackup(
    backup: BackupDocument
): Promise<RestoreResult> {
    const database = await getDatabase();
    const transaction = database.transaction(["markets", "trades"], "readwrite");
    const marketStore = transaction.objectStore("markets");
    const tradeStore = transaction.objectStore("trades");

    await Promise.all([marketStore.clear(), tradeStore.clear()]);

    // Explicit keys preserve the ids referenced by each trade.
    await Promise.all([
        ...backup.markets.map((market) => marketStore.put(market)),
        ...backup.trades.map((trade) => tradeStore.put(trade)),
    ]);
    await transaction.done;

    notifyDataChanged();

    return {
        markets: backup.markets.length,
        trades: backup.trades.length,
    };
}
