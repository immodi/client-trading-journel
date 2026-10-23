import {
    CalendarDays,
    Clock3,
    Percent,
    TrendingDown,
    TrendingUp,
    Trophy,
} from "lucide-react";
import type { TimeStats } from "@/lib/timeAnalytics";
import {
    formatDateKey,
    formatHour,
    formatInteger,
    formatMonthKey,
    formatPercent,
    formatSignedCurrency,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { PnlBarChart } from "@/components/analytics/PnlBarChart";
import { MonthlyHeatmap } from "@/components/analytics/MonthlyHeatmap";
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

interface TimingSectionProps {
    timeStats: TimeStats;
    currency: string;
}

function PeriodValue({
    label,
    value,
    currency,
}: {
    label: string;
    value: number;
    currency: string;
}) {
    return (
        <div className="grid gap-0.5">
            <span
                className={cn(
                    "font-medium tabular-nums",
                    value > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : value < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                )}
            >
                {formatSignedCurrency(value, currency)}
            </span>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

export function TimingSection({ timeStats, currency }: TimingSectionProps) {
    const activeHours = timeStats.byEntryHour.filter(
        (hour) => hour.totalTrades > 0
    );

    return (
        <section className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Timing
                </h2>
                <span className="text-sm text-muted-foreground">
                    When your edge shows up — by day, week, month, weekday, and
                    entry hour.
                </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Green day rate"
                    value={formatPercent(timeStats.greenDayRate)}
                    hint={`${timeStats.greenDays} of ${timeStats.tradingDays} trading days`}
                    icon={<Percent className="size-4" />}
                    tone={timeStats.greenDayRate >= 0.5 ? "positive" : "default"}
                />
                <StatCard
                    label="Average daily P/L"
                    value={formatSignedCurrency(
                        timeStats.averageDailyPnl,
                        currency
                    )}
                    hint={`${timeStats.tradingDays} trading days`}
                    icon={<TrendingUp className="size-4" />}
                    tone={
                        timeStats.averageDailyPnl > 0
                            ? "positive"
                            : timeStats.averageDailyPnl < 0
                              ? "negative"
                              : "default"
                    }
                />
                <StatCard
                    label="Trades per day"
                    value={timeStats.tradesPerDay.toFixed(1)}
                    hint="Average across trading days"
                    icon={<CalendarDays className="size-4" />}
                />
                <StatCard
                    label="Best day"
                    value={
                        timeStats.bestDay
                            ? formatSignedCurrency(
                                  timeStats.bestDay.netPnl,
                                  currency
                              )
                            : "—"
                    }
                    hint={
                        timeStats.bestDay
                            ? formatDateKey(timeStats.bestDay.key)
                            : "No trades yet"
                    }
                    icon={<Trophy className="size-4" />}
                    tone={timeStats.bestDay ? "positive" : "default"}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Consistency by period</CardTitle>
                        <CardDescription>
                            Green-period rate, average P/L, and trade pace at
                            each time scale.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Period</TableHead>
                                    <TableHead className="text-right">Periods</TableHead>
                                    <TableHead className="text-right">Green rate</TableHead>
                                    <TableHead className="text-right">Avg P/L</TableHead>
                                    <TableHead className="text-right">Trades / period</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">Day</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatInteger(timeStats.tradingDays)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPercent(timeStats.greenDayRate)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="tabular-nums">
                                            {formatSignedCurrency(
                                                timeStats.averageDailyPnl,
                                                currency
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {timeStats.tradesPerDay.toFixed(1)}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Week</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatInteger(timeStats.tradingWeeks)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPercent(timeStats.greenWeekRate)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="tabular-nums">
                                            {formatSignedCurrency(
                                                timeStats.averageWeeklyPnl,
                                                currency
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {timeStats.tradesPerWeek.toFixed(1)}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Month</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatInteger(timeStats.tradingMonths)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPercent(timeStats.greenMonthRate)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="tabular-nums">
                                            {formatSignedCurrency(
                                                timeStats.averageMonthlyPnl,
                                                currency
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {timeStats.tradesPerMonth.toFixed(1)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Best and worst periods</CardTitle>
                        <CardDescription>
                            Realized P/L grouped by local exit date.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Best</TableHead>
                                    <TableHead>Worst</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">Day</TableCell>
                                    <TableCell>
                                        {timeStats.bestDay ? (
                                            <PeriodValue
                                                value={timeStats.bestDay.netPnl}
                                                currency={currency}
                                                label={`${formatDateKey(
                                                    timeStats.bestDay.key
                                                )} · ${timeStats.bestDay.totalTrades} trades`}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {timeStats.worstDay ? (
                                            <PeriodValue
                                                value={timeStats.worstDay.netPnl}
                                                currency={currency}
                                                label={`${formatDateKey(
                                                    timeStats.worstDay.key
                                                )} · ${timeStats.worstDay.totalTrades} trades`}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Week</TableCell>
                                    <TableCell>
                                        {timeStats.bestWeek ? (
                                            <PeriodValue
                                                value={timeStats.bestWeek.netPnl}
                                                currency={currency}
                                                label={`Week of ${formatDateKey(
                                                    timeStats.bestWeek.key
                                                )} · ${timeStats.bestWeek.totalTrades} trades`}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {timeStats.worstWeek ? (
                                            <PeriodValue
                                                value={timeStats.worstWeek.netPnl}
                                                currency={currency}
                                                label={`Week of ${formatDateKey(
                                                    timeStats.worstWeek.key
                                                )} · ${timeStats.worstWeek.totalTrades} trades`}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Month</TableCell>
                                    <TableCell>
                                        {timeStats.bestMonth ? (
                                            <PeriodValue
                                                value={timeStats.bestMonth.netPnl}
                                                currency={currency}
                                                label={`${formatMonthKey(
                                                    timeStats.bestMonth.key
                                                )} · ${timeStats.bestMonth.totalTrades} trades`}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {timeStats.worstMonth ? (
                                            <PeriodValue
                                                value={timeStats.worstMonth.netPnl}
                                                currency={currency}
                                                label={`${formatMonthKey(
                                                    timeStats.worstMonth.key
                                                )} · ${timeStats.worstMonth.totalTrades} trades`}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                —
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>P/L by entry weekday</CardTitle>
                        <CardDescription>
                            Grouped by the local day a trade was opened.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PnlBarChart
                            items={timeStats.byWeekday.map((day) => ({
                                label: day.label,
                                value: day.netPnl,
                                trades: day.totalTrades,
                                winRate: day.winRate,
                            }))}
                            currency={currency}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>P/L by entry hour</CardTitle>
                        <CardDescription>
                            Local entry time. Only hours with trades are shown.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PnlBarChart
                            items={activeHours.map((hour) => ({
                                label: formatHour(hour.hour),
                                value: hour.netPnl,
                                trades: hour.totalTrades,
                                winRate: hour.winRate,
                            }))}
                            currency={currency}
                            emptyMessage="No entry-hour data yet."
                        />
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Monthly P/L heatmap</CardTitle>
                    <CardDescription>
                        Realized P/L by local exit month in {currency}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MonthlyHeatmap
                        monthly={timeStats.monthly}
                        currency={currency}
                    />
                </CardContent>
            </Card>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                Day, week, and month results use the local exit date; weekday and
                hour breakdowns use the local entry time.
                <TrendingDown className="ml-2 size-3.5" />
                Green period = positive realized P/L.
            </p>
        </section>
    );
}
