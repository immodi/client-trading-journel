import { cn } from "@/lib/utils";
import { formatPercent, formatSignedCurrency } from "@/lib/format";

export interface PnlBarItem {
    label: string;
    value: number;
    trades: number;
    winRate?: number;
}

interface PnlBarChartProps {
    items: PnlBarItem[];
    currency?: string;
    emptyMessage?: string;
}

/**
 * Horizontal bars centred on zero so profits and losses are immediately
 * comparable. Bar length is relative to the largest absolute value.
 */
export function PnlBarChart({
    items,
    currency = "USD",
    emptyMessage = "No trades in this breakdown yet.",
}: PnlBarChartProps) {
    if (items.length === 0) {
        return (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                {emptyMessage}
            </div>
        );
    }

    const maxAbs = Math.max(...items.map((item) => Math.abs(item.value)), 0) || 1;

    return (
        <div className="grid gap-2">
            {items.map((item) => {
                const width = (Math.abs(item.value) / maxAbs) * 50;
                const positive = item.value >= 0;

                return (
                    <div
                        key={item.label}
                        className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm"
                        title={`${item.label}: ${formatSignedCurrency(item.value, currency)}${
                            item.trades === 1 ? " · 1 trade" : ` · ${item.trades} trades`
                        }${item.winRate === undefined ? "" : ` · ${formatPercent(item.winRate)} win rate`}`}
                    >
                        <span className="grid leading-tight">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground/70">
                                {item.trades} {item.trades === 1 ? "trade" : "trades"}
                            </span>
                        </span>

                        <div className="relative h-5 rounded-sm bg-muted/60">
                            <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                            <div
                                className={cn(
                                    "absolute inset-y-0",
                                    positive
                                        ? "left-1/2 rounded-r-sm bg-emerald-500/80"
                                        : "right-1/2 rounded-l-sm bg-rose-500/80"
                                )}
                                style={{ width: `${width}%` }}
                            />
                        </div>

                        <span
                            className={cn(
                                "w-24 text-right tabular-nums",
                                positive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                            )}
                        >
                            {formatSignedCurrency(item.value, currency)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
