import type { PnlHistogram } from "@/lib/breakdowns";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DistributionHistogramProps {
    histogram: PnlHistogram;
    currency?: string;
}

/**
 * Dependency-free histogram of per-trade P/L. Bars are coloured by the bin
 * midpoint so losing, flat, and winning trades read at a glance.
 */
export function DistributionHistogram({
    histogram,
    currency = "USD",
}: DistributionHistogramProps) {
    if (histogram.bins.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No trades yet — your P/L distribution will appear here.
            </div>
        );
    }

    const maxCount = Math.max(...histogram.bins.map((bin) => bin.count), 0) || 1;

    return (
        <div className="w-full">
            <div
                className="flex h-48 items-end gap-1 border-b border-border pb-1"
                role="img"
                aria-label={`P/L distribution (${currency})`}
            >
                {histogram.bins.map((bin, index) => {
                    const midpoint = (bin.from + bin.to) / 2;
                    const height = (bin.count / maxCount) * 100;
                    const positive = midpoint >= 0;

                    return (
                        <div
                            key={`${bin.from}-${index}`}
                            className="group flex h-full flex-1 items-end"
                            title={`${formatCurrency(bin.from, currency)} to ${formatCurrency(
                                bin.to,
                                currency
                            )}: ${bin.count} ${bin.count === 1 ? "trade" : "trades"}`}
                        >
                            <div
                                className={cn(
                                    "w-full rounded-t-sm transition-opacity",
                                    bin.count === 0
                                        ? "bg-muted"
                                        : positive
                                          ? "bg-emerald-500/80 group-hover:bg-emerald-500"
                                          : "bg-rose-500/80 group-hover:bg-rose-500"
                                )}
                                style={{
                                    height: `${bin.count === 0 ? 0 : Math.max(height, 3)}%`,
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between pt-2 text-xs text-muted-foreground">
                <span>{formatCurrency(histogram.min, currency)}</span>
                <span>P/L per trade</span>
                <span>{formatCurrency(histogram.max, currency)}</span>
            </div>
        </div>
    );
}
