import { Direction, DIRECTION_LABELS } from "@/types/models";
import { formatSignedCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function DirectionBadge({ direction }: { direction: number }) {
    const isLong = direction === Direction.Long;

    return (
        <Badge
            variant="outline"
            className={cn(
                "border-transparent",
                isLong
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
            )}
        >
            {DIRECTION_LABELS[direction] ?? "Unknown"}
        </Badge>
    );
}

export function ProfitLossValue({
    value,
    currency = "USD",
}: {
    value: number;
    currency?: string;
}) {
    const tone =
        value > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : value < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-muted-foreground";

    return (
        <span className={cn("font-medium tabular-nums", tone)}>
            {formatSignedCurrency(value, currency)}
        </span>
    );
}
