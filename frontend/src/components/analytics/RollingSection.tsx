import type { RollingPoint } from "@/lib/breakdowns";
import {
    RollingMetricsChart,
    type RollingMetric,
} from "@/components/analytics/RollingMetricsChart";
import {
    Card,
    CardAction,
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

interface RollingSectionProps {
    points: RollingPoint[];
    window: string;
    metric: RollingMetric;
    currency: string;
    onWindowChange: (value: string) => void;
    onMetricChange: (value: RollingMetric) => void;
}

const WINDOW_ITEMS: Record<string, string> = {
    "20": "20 trades",
    "50": "50 trades",
};

const METRIC_ITEMS: Record<string, string> = {
    expectancy: "Expectancy",
    winRate: "Win rate",
    profitFactor: "Profit factor",
};

export function RollingSection({
    points,
    window,
    metric,
    currency,
    onWindowChange,
    onMetricChange,
}: RollingSectionProps) {
    return (
        <section className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Rolling performance
                </h2>
                <span className="text-sm text-muted-foreground">
                    Smoothed metrics reveal regime changes that a full-history
                    average hides.
                </span>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Rolling window</CardTitle>
                    <CardDescription>
                        Win rate, profit factor, and expectancy over the last{" "}
                        {window} trades. Null profit factor means the window had
                        no losing trades.
                    </CardDescription>
                    <CardAction>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select
                                items={WINDOW_ITEMS}
                                value={window}
                                onValueChange={(value) =>
                                    onWindowChange(value === null ? "20" : String(value))
                                }
                            >
                                <SelectTrigger
                                    size="sm"
                                    className="w-28"
                                    aria-label="Select rolling window size"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="20">20 trades</SelectItem>
                                    <SelectItem value="50">50 trades</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                items={METRIC_ITEMS}
                                value={metric}
                                onValueChange={(value) => {
                                    if (
                                        value === "winRate" ||
                                        value === "profitFactor" ||
                                        value === "expectancy"
                                    ) {
                                        onMetricChange(value);
                                    }
                                }}
                            >
                                <SelectTrigger
                                    size="sm"
                                    className="w-32"
                                    aria-label="Select rolling metric"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="expectancy">Expectancy</SelectItem>
                                    <SelectItem value="winRate">Win rate</SelectItem>
                                    <SelectItem value="profitFactor">
                                        Profit factor
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <RollingMetricsChart
                        points={points}
                        metric={metric}
                        window={Number(window)}
                        currency={currency}
                    />
                </CardContent>
            </Card>
        </section>
    );
}
