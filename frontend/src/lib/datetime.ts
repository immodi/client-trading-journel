/**
 * Helpers for bridging the ISO timestamps stored in the journal and the
 * timezone-less strings a `<input type="datetime-local">` expects.
 */

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

/**
 * Converts an ISO timestamp into the local "YYYY-MM-DDTHH:mm" string used by
 * datetime-local inputs.
 */
export function toDateTimeLocal(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return "";

    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

/**
 * Converts a datetime-local value (interpreted in the browser's timezone) into
 * a UTC ISO string suitable for the journal database.
 */
export function fromDateTimeLocal(value: string): string {
    return new Date(value).toISOString();
}

export function nowAsDateTimeLocal(): string {
    return toDateTimeLocal(new Date().toISOString());
}
