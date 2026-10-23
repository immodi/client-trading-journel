import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTrades } from "@/hooks/useTrades";
import {
    calculateStats,
    getCurrencySummaries,
    normalizeCurrency,
} from "@/lib/analytics";
import {
    calculateDirectionStats,
    calculateDurationStats,
    calculateInstrumentStats,
    calculatePnlHistogram,
    calculateRollingMetrics,
} from "@/lib/breakdowns";
import { calculateTimeStats } from "@/lib/timeAnalytics";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PerformanceSection } from "@/components/analytics/PerformanceSection";
import { RiskSection } from "@/components/analytics/RiskSection";
import { BreakdownSection } from "@/components/analytics/BreakdownSection";
import { RollingSection } from "@/components/analytics/RollingSection";
import { TimingSection } from "@/components/analytics/TimingSection";
import type { RollingMetric } from "@/components/analytics/RollingMetricsChart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsPage() {
    const { data: trades = [], isLoading, isError, error } = useTrades();

    const currencies = useMemo(() => getCurrencySummaries(trades), [trades]);
    const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

    // Fall back to the most active currency if the selected one disappears.
    const currency = useMemo(() => {
        if (
            selectedCurrency &&
            currencies.some((entry) => entry.currency === selectedCurrency)
        ) {
            return selectedCurrency;
        }

        return currencies[0]?.currency ?? null;
    }, [currencies, selectedCurrency]);

    const filteredTrades = useMemo(
        () =>
            currency
                ? trades.filter(
                      (trade) => normalizeCurrency(trade.currency) === currency
                  )
                : [],
        [trades, currency]
    );

    const marketCount = useMemo(
        () => new Set(filteredTrades.map((trade) => trade.marketId)).size,
        [filteredTrades]
    );

    const analytics = useMemo(() => {
        const stats = calculateStats(filteredTrades);

        return {
            stats,
            directionStats: calculateDirectionStats(filteredTrades),
            instrumentStats: calculateInstrumentStats(filteredTrades),
            durationStats: calculateDurationStats(filteredTrades),
            histogram: calculatePnlHistogram(filteredTrades),
            timeStats: calculateTimeStats(filteredTrades),
        };
    }, [filteredTrades]);

    const [rollingWindow, setRollingWindow] = useState("20");
    const [rollingMetric, setRollingMetric] =
        useState<RollingMetric>("expectancy");

    const rollingPoints = useMemo(
        () => calculateRollingMetrics(filteredTrades, Number(rollingWindow)),
        [filteredTrades, rollingWindow]
    );

    const currencyItems = useMemo(
        () =>
            Object.fromEntries(
                currencies.map((entry) => [
                    entry.currency,
                    `${entry.currency} · ${entry.tradeCount} trades`,
                ])
            ),
        [currencies]
    );

    const currencySelector = (
        <Select
            items={currencyItems}
            value={currency}
            onValueChange={(value) =>
                setSelectedCurrency(value === null ? null : String(value))
            }
        >
            <SelectTrigger
                size="sm"
                className="w-full sm:w-48"
                aria-label="Select a currency"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {currencies.map((entry) => (
                    <SelectItem key={entry.currency} value={entry.currency}>
                        {entry.currency} · {entry.tradeCount} trades
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    if (isError) {
        return (
            <div className="grid gap-6">
                <PageHeader title="Analytics" />
                <Alert variant="destructive">
                    <AlertDescription>{getErrorMessage(error)}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    title="Analytics"
                    description="Deeper performance, risk, and timing breakdowns."
                />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-64 rounded-xl" />
            </div>
        );
    }

    if (trades.length === 0 || currency === null) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    title="Analytics"
                    description="Deeper performance, risk, and timing breakdowns."
                />
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            No trades yet — analytics will appear after you log or
                            import trades.
                        </p>
                        <Link to="/trades" className={cn(buttonVariants())}>
                            Log your first trade
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <PageHeader
                title="Analytics"
                description="Deeper performance, risk, and timing breakdowns for your journal."
                action={currencies.length > 1 ? currencySelector : undefined}
            />

            <PerformanceSection
                stats={analytics.stats}
                currency={currency}
                marketCount={marketCount}
            />

            <RiskSection stats={analytics.stats} currency={currency} />

            <BreakdownSection
                stats={analytics.stats}
                currency={currency}
                directionStats={analytics.directionStats}
                instrumentStats={analytics.instrumentStats}
                durationStats={analytics.durationStats}
                histogram={analytics.histogram}
            />

            <RollingSection
                points={rollingPoints}
                window={rollingWindow}
                metric={rollingMetric}
                currency={currency}
                onWindowChange={setRollingWindow}
                onMetricChange={setRollingMetric}
            />

            <TimingSection
                timeStats={analytics.timeStats}
                currency={currency}
            />
        </div>
    );
}
