import { useId } from "react";
import type { EquityPoint } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface EquityCurveProps {
    points: EquityPoint[];
    /** ISO 4217 code used to format the curve's monetary labels. */
    currency?: string;
}

const WIDTH = 100;
const HEIGHT = 100;
const PADDING = 8;

/**
 * Dependency-free SVG equity curve. Coordinates are normalised to a 0-100
 * viewBox and stretched to the container; `vector-effect="non-scaling-stroke"`
 * keeps the line crisp regardless of the rendered size.
 *
 * The points are expected to belong to a single currency; the currency is only
 * used to format the labels and never to convert values.
 */
export function EquityCurve({ points, currency = "USD" }: EquityCurveProps) {
    const gradientId = useId();

    if (points.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No trades yet — your equity curve will appear here.
            </div>
        );
    }

    const values = points.map((point) => point.equity);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = max - min || 1;

    const toX = (index: number) =>
        points.length === 1 ? 0 : (index / (points.length - 1)) * WIDTH;

    const toY = (value: number) =>
        HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);

    const coordinates = points.map((point, index) => ({
        x: toX(index),
        y: toY(point.equity),
    }));

    const line = coordinates
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");

    const area = `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;

    const isPositive = points[points.length - 1].equity >= 0;
    const strokeColor = isPositive ? "stroke-emerald-500" : "stroke-rose-500";
    const gradientColor = isPositive ? "#10b981" : "#f43f5e";
    const zeroY = toY(0);

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between pb-2 text-xs text-muted-foreground">
                <span>First trade {formatCurrency(points[0].equity, currency)}</span>
                <span className={cn("font-medium", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    Latest {formatCurrency(points[points.length - 1].equity, currency)}
                </span>
            </div>

            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none"
                className="h-56 w-full"
                role="img"
                aria-label={`Equity curve (${currency})`}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={gradientColor} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={gradientColor} stopOpacity="0" />
                    </linearGradient>
                </defs>

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

                <path d={area} fill={`url(#${gradientId})`} />

                <path
                    d={line}
                    fill="none"
                    className={strokeColor}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <span>Oldest</span>
                <span>Newest</span>
            </div>
        </div>
    );
}
