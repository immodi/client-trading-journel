import {
    Activity,
    Gauge,
    Percent,
    Scale,
    Sigma,
    Target,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import type { TradeStats } from "@/lib/analytics";
import {
    formatCurrency,
    formatPercent,
    formatSignedCurrency,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { EquityCurve } from "@/components/dashboard/EquityCurve";
import { UnderwaterCurve } from "@/components/analytics/UnderwaterCurve";

interface PerformanceSectionProps {
    stats: TradeStats;
    currency: string;
    marketCount: number;
}

function toneFor(value: number): "positive" | "negative" | "default" {
    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "default";
}

function formatRatio(value: number | null): string {
    return value === null ? "—" : value.toFixed(2);
}

export function PerformanceSection({
    stats,
    currency,
    marketCount,
}: PerformanceSectionProps) {
    return (
        <section className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Performance
                </h2>
                <Badge variant="secondary">{currency}</Badge>
                <span className="text-sm text-muted-foreground">
                    {stats.totalTrades}{" "}
                    {stats.totalTrades === 1 ? "trade" : "trades"} across{" "}
                    {marketCount} {marketCount === 1 ? "market" : "markets"}
                </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Expectancy"
                    value={formatSignedCurrency(stats.averageTrade, currency)}
                    hint="Average P/L per trade"
                    icon={<Target className="size-4" />}
                    tone={toneFor(stats.averageTrade)}
                />
                <StatCard
                    label="Median trade"
                    value={formatSignedCurrency(stats.medianTrade, currency)}
                    hint="Middle trade result"
                    icon={<Activity className="size-4" />}
                    tone={toneFor(stats.medianTrade)}
                />
                <StatCard
                    label="Payoff ratio"
                    value={formatRatio(stats.payoffRatio)}
                    hint="Average win ÷ average loss"
                    icon={<Scale className="size-4" />}
                />
                <StatCard
                    label="Breakeven win rate"
                    value={
                        stats.breakEvenWinRate === null
                            ? "—"
                            : formatPercent(stats.breakEvenWinRate)
                    }
                    hint={`Actual win rate ${formatPercent(stats.winRate)}`}
                    icon={<Percent className="size-4" />}
                />
                <StatCard
                    label="Max drawdown"
                    value={formatCurrency(stats.maxDrawdown, currency)}
                    hint={`Current drawdown ${formatCurrency(
                        stats.currentDrawdown,
                        currency
                    )}`}
                    icon={<TrendingDown className="size-4" />}
                    tone={stats.maxDrawdown > 0 ? "negative" : "default"}
                />
                <StatCard
                    label="Recovery factor"
                    value={formatRatio(stats.recoveryFactor)}
                    hint="Net P/L ÷ max drawdown"
                    icon={<Gauge className="size-4" />}
                    tone={
                        stats.recoveryFactor === null
                            ? "default"
                            : toneFor(stats.recoveryFactor)
                    }
                />
                <StatCard
                    label="Std deviation"
                    value={
                        stats.standardDeviation === null
                            ? "—"
                            : formatCurrency(stats.standardDeviation, currency)
                    }
                    hint="Per-trade P/L dispersion"
                    icon={<Sigma className="size-4" />}
                />
                <StatCard
                    label="Sharpe / Sortino"
                    value={`${formatRatio(stats.sharpeRatio)} / ${formatRatio(
                        stats.sortinoRatio
                    )}`}
                    hint="Per-trade, not annualized"
                    icon={<TrendingUp className="size-4" />}
                    tone={
                        stats.sharpeRatio === null
                            ? "default"
                            : toneFor(stats.sharpeRatio)
                    }
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Equity curve</CardTitle>
                        <CardDescription>
                            Cumulative P/L across your {currency} trades.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <EquityCurve points={stats.equityCurve} currency={currency} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Underwater curve</CardTitle>
                        <CardDescription>
                            How far equity sits below its running high-water mark.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <UnderwaterCurve
                            points={stats.drawdownCurve}
                            currency={currency}
                        />
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
