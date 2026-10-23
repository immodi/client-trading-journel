import { NavLink, Outlet } from "react-router-dom";
import {
    ChartNoAxesCombined,
    Database,
    Landmark,
    LayoutDashboard,
    LineChart,
    ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV_ITEMS = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/analytics", label: "Analytics", icon: ChartNoAxesCombined, end: false },
    { to: "/markets", label: "Markets", icon: Landmark, end: false },
    { to: "/trades", label: "Trades", icon: ListOrdered, end: false },
];

export function AppLayout() {
    return (
        <div className="flex min-h-screen bg-muted/20">
            <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r bg-background md:w-60">
                <div className="flex h-14 items-center gap-2 px-3 md:px-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <LineChart className="size-4" />
                    </span>
                    <span className="hidden text-sm font-semibold tracking-tight md:block">
                        Trading Journal
                    </span>
                </div>

                <nav className="flex flex-1 flex-col gap-1 p-2">
                    {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-secondary text-secondary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )
                            }
                        >
                            <Icon className="size-4 shrink-0" />
                            <span className="hidden md:block">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="border-t p-3">
                    <p
                        className="hidden items-center gap-2 text-xs leading-snug text-muted-foreground md:flex"
                        title="Your trades are stored in this browser using IndexedDB."
                    >
                        <Database className="size-4 shrink-0" />
                        Data stays in this browser.
                    </p>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
                    <div className="flex items-center gap-3">
                        <span
                            className="hidden items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground sm:flex"
                            title="All data is stored locally in this browser."
                        >
                            <Database className="size-3.5" />
                            Local only
                        </span>
                        <ThemeToggle />
                    </div>
                </header>

                <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
