import { useCallback, useState } from "react";

/**
 * Shared by the dashboard and analytics pages so switching between them keeps
 * the same market in focus.
 */
export const LAST_MARKET_STORAGE_KEY = "trading-journal-last-market";

/** Selection value used by pages that can show every market at once. */
export const ALL_MARKETS = "all";

function readStoredSelection(): string | null {
    if (typeof window === "undefined") return null;

    try {
        return window.localStorage.getItem(LAST_MARKET_STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Remembers the last market the user opened. The value is kept in React state
 * and mirrored to localStorage so it survives reloads.
 */
export function useMarketSelection() {
    const [selection, setSelectionState] = useState<string | null>(readStoredSelection);

    const setSelection = useCallback((value: string | null) => {
        setSelectionState(value);

        try {
            if (value === null) {
                window.localStorage.removeItem(LAST_MARKET_STORAGE_KEY);
            } else {
                window.localStorage.setItem(LAST_MARKET_STORAGE_KEY, value);
            }
        } catch {
            // Ignore unavailable storage (for example a blocked private mode).
        }
    }, []);

    return { selection, setSelection };
}
