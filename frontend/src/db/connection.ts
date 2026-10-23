import { deleteDB, openDB, type IDBPDatabase } from "idb";
import { AppError } from "@/lib/errors";
import type { TradingJournalDB } from "./schema";

const DB_NAME = "trading-journal";
const DB_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<TradingJournalDB>> | null = null;

/**
 * Opens (and, on first use, creates) the journal database. The connection is
 * cached for the lifetime of the tab; IndexedDB itself is persisted by the
 * browser.
 */
export function getDatabase(): Promise<IDBPDatabase<TradingJournalDB>> {
    if (databasePromise) return databasePromise;

    if (typeof indexedDB === "undefined") {
        return Promise.reject(
            new AppError(
                "This browser does not support IndexedDB, which is required to store your journal locally."
            )
        );
    }

    databasePromise = openDB<TradingJournalDB>(DB_NAME, DB_VERSION, {
        upgrade(database) {
            if (!database.objectStoreNames.contains("markets")) {
                database.createObjectStore("markets", {
                    keyPath: "id",
                    autoIncrement: true,
                });
            }

            if (!database.objectStoreNames.contains("trades")) {
                const trades = database.createObjectStore("trades", {
                    keyPath: "id",
                    autoIncrement: true,
                });
                trades.createIndex("by-market", "marketId");
                trades.createIndex("by-exit-time", "exitTime");
            }
        },
    }).catch((error: unknown) => {
        databasePromise = null;

        if (error instanceof AppError) throw error;

        throw new AppError(
            "Could not open the local journal database. Check that this site is allowed to store data in your browser."
        );
    });

    return databasePromise;
}

/**
 * Closes the cached connection. Used by tests and by the future "reset local
 * data" flow; normal app code never needs this.
 */
export async function closeDatabase(): Promise<void> {
    if (!databasePromise) return;

    const database = await databasePromise;
    database.close();
    databasePromise = null;
}

/** Deletes the whole local journal. Intended for tests only. */
export async function deleteJournalDatabase(): Promise<void> {
    await closeDatabase();
    await deleteDB(DB_NAME);
}
