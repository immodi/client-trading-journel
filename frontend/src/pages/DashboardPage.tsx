import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    Hash,
    Landmark,
    Percent,
    Scale,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import {
    calculateOverallStats,
    calculateStatsForMarket,
    getMarketSummaries,
} from "@/lib/analytics";
import {
    formatCurrency,
    formatDuration,
    formatPercent,
    formatPrice,
    formatSignedCurrency,
} from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { EquityCurve } from "@/components/dashboard/EquityCurve";
import { DirectionBadge, ProfitLossValue } from "@/components/trades/DirectionBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const ALL_MARKETS = "all";

export default function DashboardPage() {
    const { data: trades = [], isLoading, isError, error } = useTrades();

    const [selection, setSelection] = useState<string>(ALL_MARKETS);

    // Markets are derived from the loaded trades (which carry their market's
    // name and currency), so the selector needs no separate markets query.
    const markets = useMemo(() => getMarketSummaries(trades), [trades]);

    const activeMarket = useMemo(
        () => markets.find((market) => String(market.id) === selection) ?? null,
        [markets, selection]
    );

    // Monetary metrics for one market only; every trade in a market shares the
    // market's currency, so no currencies are ever combined.
    const activeStats = useMemo(
        () => (activeMarket ? calculateStatsForMarket(trades, activeMarket.id) : null),
        [trades, activeMarket]
    );

    // Counts and ratios are currency-independent and can be shown globally.
    const overall = useMemo(() => calculateOverallStats(trades), [trades]);

    const currencyCount = useMemo(
        () => new Set(markets.map((market) => market.currency)).size,
        [markets]
    );

    // Base UI uses the items map to render the selected label in the trigger.
    const marketItems = useMemo(
        () => ({
            [ALL_MARKETS]: "All markets",
            ...Object.fromEntries(
                markets.map((market) => [
                    String(market.id),
                    `${market.name} (${market.currency})`,
                ])
            ),
        }),
        [markets]
    );

    const recentTrades = useMemo(
        () =>
            [...trades]
                .sort(
                    (a, b) =>
                        new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
                )
                .slice(0, 5),
        [trades]
    );

    if (isError) {
        return (
            <div className="grid gap-6">
                <PageHeader title="Dashboard" />
                <Alert variant="destructive">
                    <AlertDescription>{getErrorMessage(error)}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const netTone =
        activeStats === null
            ? "default"
            : activeStats.netPnl > 0
              ? "positive"
              : activeStats.netPnl < 0
                ? "negative"
                : "default";

    const marketSelector = (
        <Select
            items={marketItems}
            value={activeMarket ? String(activeMarket.id) : ALL_MARKETS}
            onValueChange={(value) => setSelection(value === null ? ALL_MARKETS : String(value))}
        >
            <SelectTrigger
                size="sm"
                className="w-full sm:w-56"
                aria-label="Select a market"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL_MARKETS}>All markets</SelectItem>
                {markets.map((market) => (
                    <SelectItem key={market.id} value={String(market.id)}>
                        {market.name} ({market.currency})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    return (
        <div className="grid gap-6">
            <PageHeader
                title="Dashboard"
                description="A snapshot of your trading performance."
                action={!isLoading && trades.length > 0 ? marketSelector : undefined}
            />

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-xl" />
                    ))}
                </div>
            ) : trades.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            No trades yet — your statistics will appear here.
                        </p>
                    </CardContent>
                </Card>
            ) : activeMarket && activeStats ? (
                <section className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-lg font-semibold tracking-tight">
                            {activeMarket.name}
                        </h2>
                        <Badge variant="secondary">{activeMarket.currency}</Badge>
                        <span className="text-sm text-muted-foreground">
                            {activeStats.totalTrades}{" "}
                            {activeStats.totalTrades === 1 ? "trade" : "trades"}
                        </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <StatCard
                            label="Net P/L"
                            value={formatSignedCurrency(
                                activeStats.netPnl,
                                activeMarket.currency
                            )}
                            hint={`${activeStats.wins}W / ${activeStats.losses}L / ${activeStats.breakEven}BE`}
                            icon={<Activity className="size-4" />}
                            tone={netTone}
                        />
                        <StatCard
                            label="Win rate"
                            value={formatPercent(activeStats.winRate)}
                            hint={`${activeStats.wins + activeStats.losses} decisive trades`}
                            icon={<Percent className="size-4" />}
                        />
                        <StatCard
                            label="Profit factor"
                            value={
                                activeStats.profitFactor === null
                                    ? "—"
                                    : activeStats.profitFactor.toFixed(2)
                            }
                            hint={
                                activeStats.profitFactor === null
                                    ? "No losing trades yet"
                                    : "Gross profit ÷ gross loss"
                            }
                            icon={<Scale className="size-4" />}
                        />
                        <StatCard
                            label="Average win"
                            value={formatCurrency(
                                activeStats.averageWin,
                                activeMarket.currency
                            )}
                            hint={
                                activeStats.bestTrade
                                    ? `Best ${formatSignedCurrency(activeStats.bestTrade.profitLoss, activeMarket.currency)}`
                                    : undefined
                            }
                            icon={<TrendingUp className="size-4" />}
                            tone="positive"
                        />
                        <StatCard
                            label="Average loss"
                            value={formatCurrency(
                                activeStats.averageLoss,
                                activeMarket.currency
                            )}
                            hint={
                                activeStats.worstTrade
                                    ? `Worst ${formatSignedCurrency(activeStats.worstTrade.profitLoss, activeMarket.currency)}`
                                    : undefined
                            }
                            icon={<TrendingDown className="size-4" />}
                            tone="negative"
                        />
                        <StatCard
                            label="Total commission"
                            value={formatCurrency(
                                activeStats.totalCommission,
                                activeMarket.currency
                            )}
                            hint={`${activeMarket.currency} commissions`}
                            icon={<Hash className="size-4" />}
                        />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Equity curve</CardTitle>
                            <CardDescription>
                                Cumulative profit/loss across your closed{" "}
                                {activeMarket.currency} trades.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EquityCurve
                                points={activeStats.equityCurve}
                                currency={activeMarket.currency}
                            />
                        </CardContent>
                    </Card>
                </section>
            ) : (
                <section className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-lg font-semibold tracking-tight">
                            All markets
                        </h2>
                        <span className="text-sm text-muted-foreground">
                            Currency-independent metrics
                        </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <StatCard
                            label="Total trades"
                            value={String(overall.totalTrades)}
                            hint={`${overall.wins}W / ${overall.losses}L / ${overall.breakEven}BE across all markets`}
                            icon={<Hash className="size-4" />}
                        />
                        <StatCard
                            label="Win rate"
                            value={formatPercent(overall.winRate)}
                            hint={`${overall.wins + overall.losses} decisive trades`}
                            icon={<Percent className="size-4" />}
                        />
                        <StatCard
                            label="Markets"
                            value={String(markets.length)}
                            hint={`${currencyCount} ${
                                currencyCount === 1 ? "currency" : "currencies"
                            }`}
                            icon={<Landmark className="size-4" />}
                        />
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Select a market to see its net P/L, averages, commissions,
                        and equity curve in that market's own currency.
                    </p>
                </section>
            )}

            <Card>
                <CardHeader className="grid-cols-[1fr_auto]">
                    <CardTitle>Recent trades</CardTitle>
                    <CardDescription>Your five most recent trades.</CardDescription>
                    <Link
                        to="/trades"
                        className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "col-start-2 row-span-2 row-start-1 self-start justify-self-end"
                        )}
                    >
                        View all
                    </Link>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="grid gap-2">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <Skeleton key={index} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : recentTrades.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <p className="text-sm text-muted-foreground">
                                You have not logged any trades yet.
                            </p>
                            <Link to="/trades" className={cn(buttonVariants())}>
                                Log your first trade
                            </Link>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Instrument</TableHead>
                                    <TableHead>Direction</TableHead>
                                    <TableHead className="text-right">Entry</TableHead>
                                    <TableHead className="text-right">Exit</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                    <TableHead className="text-right">P/L</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentTrades.map((trade) => (
                                    <TableRow key={trade.id}>
                                        <TableCell className="font-medium">
                                            {trade.instrument}
                                        </TableCell>
                                        <TableCell>
                                            <DirectionBadge direction={trade.direction} />
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatPrice(trade.entryPrice)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatPrice(trade.exitPrice)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {formatDuration(trade.entryTime, trade.exitTime)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ProfitLossValue
                                                value={trade.profitLoss}
                                                currency={trade.currency}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
