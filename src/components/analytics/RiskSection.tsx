import { Flame, Percent, TrendingDown, Trophy } from "lucide-react";
import type { TradeStats } from "@/lib/analytics";
import {
    formatInteger,
    formatPercent,
    formatSignedCurrency,
} from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
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

interface RiskSectionProps {
    stats: TradeStats;
    currency: string;
}

export function RiskSection({ stats, currency }: RiskSectionProps) {
    const currentStreak =
        stats.currentStreak.type === "none"
            ? "—"
            : `${stats.currentStreak.count} ${
                  stats.currentStreak.type === "win"
                      ? stats.currentStreak.count === 1
                          ? "win"
                          : "wins"
                      : stats.currentStreak.count === 1
                        ? "loss"
                        : "losses"
              }`;

    return (
        <section className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Risk & concentration
                </h2>
                <span className="text-sm text-muted-foreground">
                    Streaks, outliers, and how much of the result comes from a
                    handful of trades.
                </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Longest win streak"
                    value={formatInteger(stats.maxWinStreak)}
                    hint="Consecutive winning trades"
                    icon={<Trophy className="size-4" />}
                    tone="positive"
                />
                <StatCard
                    label="Longest loss streak"
                    value={formatInteger(stats.maxLossStreak)}
                    hint="Consecutive losing trades"
                    icon={<TrendingDown className="size-4" />}
                    tone="negative"
                />
                <StatCard
                    label="Current streak"
                    value={currentStreak}
                    hint="Most recent run"
                    icon={<Flame className="size-4" />}
                    tone={
                        stats.currentStreak.type === "win"
                            ? "positive"
                            : stats.currentStreak.type === "loss"
                              ? "negative"
                              : "default"
                    }
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Profit concentration</CardTitle>
                    <CardDescription>
                        How much of net P/L comes from the best winning trades.
                        A high share means the result depends on a few outliers.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Top winners</TableHead>
                                <TableHead className="text-right">P/L</TableHead>
                                <TableHead className="text-right">
                                    Share of net P/L
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.profitConcentration.map((entry) => (
                                <TableRow key={entry.count}>
                                    <TableCell className="font-medium">
                                        Top {entry.count}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <ProfitLossValue
                                            value={entry.pnl}
                                            currency={currency}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {entry.shareOfNetPnl === null ? (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        ) : (
                                            formatPercent(entry.shareOfNetPnl)
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Excluding best trade
                            </p>
                            <p className="mt-1 text-lg font-semibold tabular-nums">
                                {formatSignedCurrency(
                                    stats.netPnlWithoutBest,
                                    currency
                                )}
                            </p>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                <Percent className="size-3.5" />
                                Excluding top 5 winners
                            </p>
                            <p className="mt-1 text-lg font-semibold tabular-nums">
                                {formatSignedCurrency(
                                    stats.netPnlWithoutTop5,
                                    currency
                                )}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
