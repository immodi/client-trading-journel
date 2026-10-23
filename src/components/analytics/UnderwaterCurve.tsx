import { useId } from "react";
import type { DrawdownPoint } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";

interface UnderwaterCurveProps {
    points: DrawdownPoint[];
    currency?: string;
}

const WIDTH = 100;
const HEIGHT = 100;
const PADDING = 8;

/**
 * Plots drawdown below the high-water mark. Values are already positive
 * drawdown amounts; the chart intentionally draws them downward from zero.
 */
export function UnderwaterCurve({ points, currency = "USD" }: UnderwaterCurveProps) {
    const gradientId = useId();

    if (points.length === 0) {
        return (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No trades yet — your underwater curve will appear here.
            </div>
        );
    }

    const maxDrawdown = Math.max(...points.map((point) => point.drawdown), 0);
    const scale = maxDrawdown || 1;
    const last = points[points.length - 1];

    const toX = (index: number) =>
        points.length === 1 ? 0 : (index / (points.length - 1)) * WIDTH;

    const toY = (drawdown: number) =>
        PADDING + (drawdown / scale) * (HEIGHT - PADDING * 2);

    const coordinates = points.map((point, index) => ({
        x: toX(index),
        y: toY(point.drawdown),
    }));

    const line = coordinates
        .map(
            (point, index) =>
                `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        )
        .join(" ");

    const area = `${line} L${WIDTH} ${PADDING} L0 ${PADDING} Z`;

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between pb-2 text-xs text-muted-foreground">
                <span>Max drawdown {formatCurrency(maxDrawdown, currency)}</span>
                <span className="font-medium text-rose-600 dark:text-rose-400">
                    Now {formatCurrency(last.drawdown, currency)}
                </span>
            </div>

            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none"
                className="h-56 w-full"
                role="img"
                aria-label={`Underwater drawdown curve (${currency})`}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.35" />
                    </linearGradient>
                </defs>

                <line
                    x1="0"
                    x2={WIDTH}
                    y1={PADDING}
                    y2={PADDING}
                    className="stroke-border"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                />

                <path d={area} fill={`url(#${gradientId})`} />

                <path
                    d={line}
                    fill="none"
                    className="stroke-rose-500"
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
