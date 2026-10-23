/**
 * An error whose message is safe and useful to show directly in the UI.
 * Validation failures and conflicts raised by the local data layer use this
 * type; anything else falls back to a generic message.
 */
export class AppError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AppError";
    }
}

export function getErrorMessage(error: unknown): string {
    if (error instanceof AppError) return error.message;

    if (typeof DOMException !== "undefined" && error instanceof DOMException) {
        if (error.name === "QuotaExceededError") {
            return "Browser storage is full. Free up space for this site and try again.";
        }

        return error.message;
    }

    if (error instanceof Error) return error.message;

    return "Something went wrong. Please try again.";
}
