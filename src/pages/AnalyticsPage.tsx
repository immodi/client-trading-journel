import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTrades } from "@/hooks/useTrades";
import { useMarketSelection } from "@/hooks/useMarketSelection";
import { calculateStats, getMarketSummaries } from "@/lib/analytics";
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

    const { selection, setSelection } = useMarketSelection();

    // Markets are derived from the loaded trades, which carry their market's
    // name and currency. Analytics always operates on exactly one market, so
    // monetary metrics stay within that market's currency.
    const markets = useMemo(() => getMarketSummaries(trades), [trades]);

    // Fall back to the first market when nothing is saved or the saved market
    // no longer exists.
    const market = useMemo(
        () => markets.find((entry) => String(entry.id) === selection) ?? markets[0] ?? null,
        [markets, selection]
    );

    const currency = market?.currency ?? null;

    const filteredTrades = useMemo(
        () => (market ? trades.filter((trade) => trade.marketId === market.id) : []),
        [trades, market]
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

    // Base UI uses the items map to render the selected label in the trigger.
    const marketItems = useMemo(
        () =>
            Object.fromEntries(
                markets.map((entry) => [
                    String(entry.id),
                    `${entry.name} (${entry.currency})`,
                ])
            ),
        [markets]
    );

    const marketSelector = (
        <Select
            items={marketItems}
            value={market ? String(market.id) : null}
            onValueChange={(value) => {
                if (value !== null) setSelection(String(value));
            }}
        >
            <SelectTrigger
                size="sm"
                className="w-full sm:w-56"
                aria-label="Select a market"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {markets.map((entry) => (
                    <SelectItem key={entry.id} value={String(entry.id)}>
                        {entry.name} ({entry.currency})
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

    if (trades.length === 0 || market === null || currency === null) {
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
                description="Deeper performance, risk, and timing breakdowns, one market at a time."
                action={markets.length > 1 ? marketSelector : undefined}
            />

            <PerformanceSection
                stats={analytics.stats}
                currency={currency}
                marketName={market.name}
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
