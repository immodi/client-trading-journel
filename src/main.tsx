import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { subscribeToDataChanges } from "@/db/changeNotifications";
import { router } from "@/router/routes";
import "./style.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
        },
    },
});

// Writes from another tab share the same IndexedDB database; invalidate the
// in-memory cache so every open tab shows the same journal.
subscribeToDataChanges(() => {
    queryClient.invalidateQueries();
});

// Best effort: ask the browser not to evict the journal under storage pressure.
if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <RouterProvider router={router} />
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>
);
