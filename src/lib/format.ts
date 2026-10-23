const priceFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
});

const integerFormatter = new Intl.NumberFormat("en-US");

const compactFormatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
    let formatter = currencyFormatters.get(currency);

    if (!formatter) {
        formatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        currencyFormatters.set(currency, formatter);
    }

    return formatter;
}

/**
 * Formats a monetary amount in the given ISO 4217 currency (defaults to USD).
 */
export function formatCurrency(value: number, currency = "USD"): string {
    try {
        return currencyFormatter(currency || "USD").format(value);
    } catch {
        return `${value.toFixed(2)} ${currency}`;
    }
}

/**
 * Like {@link formatCurrency} but always shows an explicit + or - sign.
 */
export function formatSignedCurrency(value: number, currency = "USD"): string {
    const formatted = formatCurrency(Math.abs(value), currency);
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

export function formatPrice(value: number): string {
    return priceFormatter.format(value);
}

export function formatInteger(value: number): string {
    return integerFormatter.format(value);
}

export function formatCompactNumber(value: number): string {
    return compactFormatter.format(value);
}

export function formatSignedCompactNumber(value: number): string {
    const formatted = compactFormatter.format(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

export function formatPercent(value: number, fractionDigits = 1): string {
    return `${(value * 100).toFixed(fractionDigits)}%`;
}

/** Formats a local YYYY-MM-DD date key without shifting it through UTC. */
export function formatDateKey(key: string): string {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/** Formats a local YYYY-MM month key as a long month and year. */
export function formatMonthKey(key: string): string {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
    });
}

export function formatHour(hour: number): string {
    return `${String(hour).padStart(2, "0")}:00`;
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * Human readable duration from a millisecond count, e.g. "1h 25m".
 */
export function formatDurationMs(milliseconds: number): string {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";

    const totalMinutes = Math.floor(milliseconds / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * Human readable duration between two ISO timestamps, e.g. "1h 25m".
 */
export function formatDuration(startIso: string, endIso: string): string {
    const milliseconds = new Date(endIso).getTime() - new Date(startIso).getTime();
    return formatDurationMs(milliseconds);
}
