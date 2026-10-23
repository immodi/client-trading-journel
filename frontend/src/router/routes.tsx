import { createBrowserRouter, Navigate } from "react-router-dom";
import DashboardPage from "@/pages/DashboardPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import MarketsPage from "@/pages/MarketsPage";
import TradesPage from "@/pages/TradesPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { AppLayout } from "@/components/layout/AppLayout";

export const router = createBrowserRouter([
    {
        element: <AppLayout />,
        children: [
            { index: true, element: <DashboardPage /> },
            { path: "analytics", element: <AnalyticsPage /> },
            { path: "markets", element: <MarketsPage /> },
            { path: "trades", element: <TradesPage /> },
        ],
    },
    {
        // Old bookmarks from the account-based release land on the journal.
        path: "login",
        element: <Navigate to="/" replace />,
    },
    {
        path: "register",
        element: <Navigate to="/" replace />,
    },
    {
        path: "*",
        element: <NotFoundPage />,
    },
]);
