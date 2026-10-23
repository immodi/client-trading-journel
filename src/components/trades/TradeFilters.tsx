import { Search, X } from "lucide-react";
import { Direction, DIRECTION_LABELS } from "@/types/models";
import { EMPTY_FILTERS, type TradeFiltersState } from "@/components/trades/tradeFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const DIRECTION_ITEMS: Record<string, string> = {
    all: "All directions",
    [Direction.Long]: DIRECTION_LABELS[Direction.Long],
    [Direction.Short]: DIRECTION_LABELS[Direction.Short],
};

interface TradeFiltersProps {
    value: TradeFiltersState;
    onChange: (value: TradeFiltersState) => void;
}

export function TradeFilters({ value, onChange }: TradeFiltersProps) {
    const hasFilters = Boolean(
        value.search || value.direction !== "all" || value.from || value.to
    );

    function patch(partial: Partial<TradeFiltersState>) {
        onChange({ ...value, ...partial });
    }

    return (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid flex-1 gap-2">
                <Label htmlFor="trade-search">Search</Label>
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="trade-search"
                        placeholder="Instrument..."
                        className="pl-8"
                        value={value.search}
                        onChange={(event) => patch({ search: event.target.value })}
                    />
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="trade-direction">Direction</Label>
                <Select
                    items={DIRECTION_ITEMS}
                    value={value.direction}
                    onValueChange={(next) => patch({ direction: String(next) })}
                >
                    <SelectTrigger id="trade-direction" className="w-full lg:w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{DIRECTION_ITEMS.all}</SelectItem>
                        <SelectItem value={String(Direction.Long)}>
                            {DIRECTION_LABELS[Direction.Long]}
                        </SelectItem>
                        <SelectItem value={String(Direction.Short)}>
                            {DIRECTION_LABELS[Direction.Short]}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="trade-from">From</Label>
                <Input
                    id="trade-from"
                    type="date"
                    value={value.from}
                    onChange={(event) => patch({ from: event.target.value })}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="trade-to">To</Label>
                <Input
                    id="trade-to"
                    type="date"
                    value={value.to}
                    onChange={(event) => patch({ to: event.target.value })}
                />
            </div>

            <Button
                variant="ghost"
                disabled={!hasFilters}
                onClick={() => onChange(EMPTY_FILTERS)}
                className="lg:mb-px"
            >
                <X />
                Clear
            </Button>
        </div>
    );
}
