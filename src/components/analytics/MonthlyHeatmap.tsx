import type { MonthlyStats } from "@/lib/timeAnalytics";
import {
    formatMonthKey,
    formatSignedCompactNumber,
    formatSignedCurrency,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface MonthlyHeatmapProps {
    monthly: MonthlyStats[];
    currency?: string;
}

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/**
 * Year × month grid of realized P/L. Colour intensity is relative to the
 * largest absolute month, which makes small but consistent months visible
 * without letting a single outlier wash out the rest.
 */
export function MonthlyHeatmap({ monthly, currency = "USD" }: MonthlyHeatmapProps) {
    if (monthly.length === 0) {
        return (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No trades yet — your monthly heatmap will appear here.
            </div>
        );
    }

    const statsByKey = new Map(monthly.map((month) => [month.key, month]));
    const years = Array.from(new Set(monthly.map((month) => month.year))).sort(
        (a, b) => a - b
    );
    const maxAbs = Math.max(...monthly.map((month) => Math.abs(month.netPnl)), 0) || 1;

    const yearTotals = new Map<number, number>();

    for (const month of monthly) {
        yearTotals.set(month.year, (yearTotals.get(month.year) ?? 0) + month.netPnl);
    }

    return (
        <div className="grid gap-3">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-16">Year</TableHead>
                        {MONTHS.map((month) => (
                            <TableHead key={month} className="px-1 text-center">
                                {month}
                            </TableHead>
                        ))}
                        <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {years.map((year) => (
                        <TableRow key={year}>
                            <TableCell className="font-medium">{year}</TableCell>

                            {MONTHS.map((_, index) => {
                                const key = `${year}-${String(index + 1).padStart(2, "0")}`;
                                const month = statsByKey.get(key);
                                const value = month?.netPnl ?? 0;
                                const hasTrades = (month?.totalTrades ?? 0) > 0;
                                const intensity = hasTrades
                                    ? 0.12 + 0.78 * (Math.abs(value) / maxAbs)
                                    : 0;
                                const background =
                                    hasTrades && value !== 0
                                        ? value > 0
                                            ? `rgba(16, 185, 129, ${intensity})`
                                            : `rgba(244, 63, 94, ${intensity})`
                                        : undefined;

                                return (
                                    <TableCell key={key} className="p-1">
                                        <div
                                            className={cn(
                                                "min-w-14 rounded-md px-1.5 py-1 text-right text-xs tabular-nums",
                                                !hasTrades && "bg-muted/30 text-muted-foreground"
                                            )}
                                            style={{
                                                backgroundColor: background,
                                                color: intensity > 0.55 ? "white" : undefined,
                                            }}
                                            title={
                                                month
                                                    ? `${formatMonthKey(key)}: ${formatSignedCurrency(
                                                          value,
                                                          currency
                                                      )} across ${month.totalTrades} ${
                                                          month.totalTrades === 1
                                                              ? "trade"
                                                              : "trades"
                                                      }`
                                                    : `${formatMonthKey(key)}: no trades`
                                            }
                                        >
                                            {hasTrades
                                                ? formatSignedCompactNumber(value)
                                                : "·"}
                                        </div>
                                    </TableCell>
                                );
                            })}

                            <TableCell className="text-right font-medium tabular-nums">
                                {formatSignedCurrency(yearTotals.get(year) ?? 0, currency)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <p className="text-xs text-muted-foreground">
                Green is profit, red is loss. Intensity is scaled to the largest
                absolute month; hover a cell for the exact P/L and trade count.
            </p>
        </div>
    );
}
