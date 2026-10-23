type Listener = () => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function getChannel(): BroadcastChannel | null {
    if (channel) return channel;
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
        return null;
    }

    channel = new BroadcastChannel("trading-journal");
    // A change written in another tab should refresh this tab's cached data,
    // but must not be re-broadcast (that would loop between tabs).
    channel.addEventListener("message", emit);

    return channel;
}

/**
 * Announces a local IndexedDB write. Same-tab subscribers are notified
 * immediately and other open tabs receive the message over BroadcastChannel.
 */
export function notifyDataChanged(): void {
    emit();
    getChannel()?.postMessage("changed");
}

/**
 * Subscribes to journal changes from this tab or another one. Returns an
 * unsubscribe function.
 */
export function subscribeToDataChanges(listener: Listener): () => void {
    listeners.add(listener);
    getChannel();

    return () => {
        listeners.delete(listener);
    };
}
