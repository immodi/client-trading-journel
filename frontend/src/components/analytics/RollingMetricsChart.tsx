import type { RollingPoint } from "@/lib/breakdowns";
import {
    formatCurrency,
    formatPercent,
    formatSignedCurrency,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export type RollingMetric = "winRate" | "profitFactor" | "expectancy";

interface RollingMetricsChartProps {
    points: RollingPoint[];
    metric: RollingMetric;
    window: number;
    currency?: string;
}

const WIDTH = 100;
const HEIGHT = 100;
const PADDING = 8;

function metricValue(point: RollingPoint, metric: RollingMetric): number | null {
    if (metric === "expectancy") return point.expectancy;
    if (metric === "winRate") return point.winRate;
    return point.profitFactor;
}

function formatMetric(
    value: number | null,
    metric: RollingMetric,
    currency: string
): string {
    if (value === null) return "—";
    if (metric === "expectancy") return formatSignedCurrency(value, currency);
    if (metric === "winRate") return formatPercent(value);
    return value.toFixed(2);
}

function formatAxis(
    value: number,
    metric: RollingMetric,
    currency: string
): string {
    if (metric === "expectancy") return formatCurrency(value, currency);
    if (metric === "winRate") return formatPercent(value, 0);
    return value.toFixed(1);
}

/**
 * Line chart for a rolling metric. Null values (for example, profit factor in
 * a window with no losses) create a gap rather than a misleading zero.
 */
export function RollingMetricsChart({
    points,
    metric,
    window,
    currency = "USD",
}: RollingMetricsChartProps) {
    if (points.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Need at least {window} trades to calculate a {window}-trade
                rolling window.
            </div>
        );
    }

    const values = points.map((point) => metricValue(point, metric));
    const numeric = values.filter((value): value is number => value !== null);

    if (numeric.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                No values available for this metric in the current window.
            </div>
        );
    }

    const min = Math.min(0, ...numeric);
    const max = Math.max(0, ...numeric);
    const range = max - min || 1;
    const lastValue = values[values.length - 1] ?? null;

    const toX = (index: number) =>
        points.length === 1 ? 0 : (index / (points.length - 1)) * WIDTH;

    const toY = (value: number) =>
        HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);

    const segments: { x: number; y: number }[][] = [];
    let segment: { x: number; y: number }[] = [];

    values.forEach((value, index) => {
        if (value === null) {
            if (segment.length > 0) segments.push(segment);
            segment = [];
            return;
        }

        segment.push({ x: toX(index), y: toY(value) });
    });

    if (segment.length > 0) segments.push(segment);

    const zeroY = toY(0);
    const isNegative = lastValue !== null && lastValue < 0;
    const strokeClass = isNegative ? "stroke-rose-500" : "stroke-emerald-500";
    const fillClass = isNegative ? "fill-rose-500" : "fill-emerald-500";

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between pb-2 text-xs text-muted-foreground">
                <span>{formatAxis(min, metric, currency)}</span>
                <span className={cn("font-medium", isNegative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                    Latest {formatMetric(lastValue, metric, currency)}
                </span>
                <span>{formatAxis(max, metric, currency)}</span>
            </div>

            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none"
                className="h-48 w-full"
                role="img"
                aria-label={`${window}-trade rolling ${metric} chart`}
            >
                {min <= 0 && max >= 0 && (
                    <line
                        x1="0"
                        x2={WIDTH}
                        y1={zeroY}
                        y2={zeroY}
                        className="stroke-border"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {segments.map((pointsInSegment, index) => {
                    if (pointsInSegment.length === 1) {
                        const point = pointsInSegment[0];

                        return (
                            <circle
                                key={index}
                                cx={point.x}
                                cy={point.y}
                                r="1.5"
                                className={fillClass}
                                vectorEffect="non-scaling-stroke"
                            />
                        );
                    }

                    const path = pointsInSegment
                        .map(
                            (point, pointIndex) =>
                                `${pointIndex === 0 ? "M" : "L"}${point.x.toFixed(
                                    2
                                )} ${point.y.toFixed(2)}`
                        )
                        .join(" ");

                    return (
                        <path
                            key={index}
                            d={path}
                            fill="none"
                            className={strokeClass}
                            strokeWidth="2"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}
            </svg>

            <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <span>First full window</span>
                <span>Latest</span>
            </div>
        </div>
    );
}
