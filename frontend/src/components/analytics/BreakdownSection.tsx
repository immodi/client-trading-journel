import { Clock3, Hash, Scale } from "lucide-react";
import type { TradeStats } from "@/lib/analytics";
import type {
    DirectionStats,
    DurationStats,
    InstrumentStats,
    PnlHistogram,
} from "@/lib/breakdowns";
import {
    formatCurrency,
    formatDurationMs,
    formatPercent,
    formatSignedCurrency,
} from "@/lib/format";
import { DistributionHistogram } from "@/components/analytics/DistributionHistogram";
import { ProfitLossValue } from "@/components/trades/DirectionBadge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface BreakdownSectionProps {
    stats: TradeStats;
    currency: string;
    directionStats: DirectionStats[];
    instrumentStats: InstrumentStats[];
    durationStats: DurationStats;
    histogram: PnlHistogram;
}

function formatRatio(value: number | null): string {
    return value === null ? "—" : value.toFixed(2);
}

function MiniMetric({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="grid gap-1 rounded-lg border bg-muted/20 p-3">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </span>
            <span className="text-lg font-semibold tabular-nums">{value}</span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
    );
}

export function BreakdownSection({
    stats,
    currency,
    directionStats,
    instrumentStats,
    durationStats,
    histogram,
}: BreakdownSectionProps) {
    return (
        <section className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Breakdowns
                </h2>
                <span className="text-sm text-muted-foreground">
                    Direction, instrument, commission, and holding-time detail.
                </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Long vs short</CardTitle>
                        <CardDescription>
                            Separate performance for each side of the strategy.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Side</TableHead>
                                    <TableHead className="text-right">Trades</TableHead>
                                    <TableHead className="text-right">Win rate</TableHead>
                                    <TableHead className="text-right">Net P/L</TableHead>
                                    <TableHead className="text-right">Avg P/L</TableHead>
                                    <TableHead className="text-right">PF</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {directionStats.map((entry) => (
                                    <TableRow key={entry.direction}>
                                        <TableCell className="font-medium">
                                            {entry.label}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {entry.totalTrades}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatPercent(entry.winRate)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ProfitLossValue
                                                value={entry.netPnl}
                                                currency={currency}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ProfitLossValue
                                                value={entry.averagePnl}
                                                currency={currency}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatRatio(entry.profitFactor)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Commission drag</CardTitle>
                        <CardDescription>
                            What trading costs take out of gross profit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <MiniMetric
                                label="Total commission"
                                value={formatCurrency(stats.totalCommission, currency)}
                                hint={`${stats.totalTrades} trades`}
                            />
                            <MiniMetric
                                label="Per trade"
                                value={formatCurrency(stats.averageCommission, currency)}
                                hint="Average commission"
                            />
                            <MiniMetric
                                label="Of gross profit"
                                value={
                                    stats.commissionToGrossProfitRatio === null
                                        ? "—"
                                        : formatPercent(
                                              stats.commissionToGrossProfitRatio
                                          )
                                }
                                hint="Commission drag"
                            />
                        </div>

                        <div className="grid gap-2 border-t pt-3 text-sm">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Gross profit
                                </span>
                                <span className="font-medium tabular-nums">
                                    {formatCurrency(stats.grossProfit, currency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Net after commission
                                </span>
                                <span className="font-medium tabular-nums">
                                    {formatSignedCurrency(stats.netPnl, currency)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Instrument performance</CardTitle>
                    <CardDescription>
                        Every instrument is grouped within its own market, so
                        identical tickers in different markets stay separate.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {instrumentStats.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            No instrument data yet.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Instrument</TableHead>
                                    <TableHead>Market</TableHead>
                                    <TableHead className="text-right">Trades</TableHead>
                                    <TableHead className="text-right">Win rate</TableHead>
                                    <TableHead className="text-right">Net P/L</TableHead>
                                    <TableHead className="text-right">Avg P/L</TableHead>
                                    <TableHead className="text-right">PF</TableHead>
                                    <TableHead className="text-right">Commission</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instrumentStats.map((entry) => (
                                    <TableRow key={entry.key}>
                                        <TableCell className="font-medium">
                                            {entry.instrument}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {entry.marketName}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {entry.totalTrades}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatPercent(entry.winRate)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ProfitLossValue
                                                value={entry.netPnl}
                                                currency={currency}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ProfitLossValue
                                                value={entry.averagePnl}
                                                currency={currency}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatRatio(entry.profitFactor)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatCurrency(
                                                entry.totalCommission,
                                                currency
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Hold time</CardTitle>
                        <CardDescription>
                            Average and median duration, plus results by holding
                            period.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <MiniMetric
                                label="Average hold"
                                value={formatDurationMs(durationStats.averageMs)}
                                hint="Entry to exit"
                            />
                            <MiniMetric
                                label="Median hold"
                                value={formatDurationMs(durationStats.medianMs)}
                                hint="Middle trade"
                            />
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Duration</TableHead>
                                    <TableHead className="text-right">Trades</TableHead>
                                    <TableHead className="text-right">Win rate</TableHead>
                                    <TableHead className="text-right">Net P/L</TableHead>
                                    <TableHead className="text-right">Avg P/L</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {durationStats.buckets.map((bucket) => (
                                    <TableRow key={bucket.key}>
                                        <TableCell className="font-medium">
                                            {bucket.label}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {bucket.totalTrades}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatPercent(bucket.winRate)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ProfitLossValue
                                                value={bucket.netPnl}
                                                currency={currency}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ProfitLossValue
                                                value={bucket.averagePnl}
                                                currency={currency}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>P/L distribution</CardTitle>
                        <CardDescription>
                            How many trades land in each P/L range. Look for fat
                            left tails and clustered small wins.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DistributionHistogram
                            histogram={histogram}
                            currency={currency}
                        />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric
                    label="Gross loss"
                    value={formatCurrency(stats.grossLoss, currency)}
                    hint="Sum of losing trades"
                />
                <MiniMetric
                    label="Average win"
                    value={formatCurrency(stats.averageWin, currency)}
                    hint={`${stats.wins} winning trades`}
                />
                <MiniMetric
                    label="Average loss"
                    value={formatCurrency(stats.averageLoss, currency)}
                    hint={`${stats.losses} losing trades`}
                />
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Scale className="size-3.5" />
                Profit factor (PF) is gross profit ÷ gross loss.
                <Hash className="ml-2 size-3.5" />
                All monetary values are in {currency}.
                <Clock3 className="ml-2 size-3.5" />
                Hold time is calculated from entry to exit.
            </p>
        </section>
    );
}
