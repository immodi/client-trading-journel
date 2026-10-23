import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Trade } from "@/types/models";
import { formatCurrency, formatDateTime, formatDuration, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { DirectionBadge, ProfitLossValue } from "@/components/trades/DirectionBadge";

type SortKey = "instrument" | "exitTime" | "profitLoss";
type SortDirection = "asc" | "desc";

interface TradesTableProps {
    trades: Trade[];
    onEdit: (trade: Trade) => void;
    onDelete: (trade: Trade) => void;
}

interface SortableHeadProps {
    label: ReactNode;
    isActive: boolean;
    direction: SortDirection;
    onClick: () => void;
}

function SortableHead({ label, isActive, direction, onClick }: SortableHeadProps) {
    return (
        <TableHead>
            <button
                type="button"
                onClick={onClick}
                className="flex items-center gap-1 hover:text-foreground"
            >
                {label}
                {isActive &&
                    (direction === "asc" ? (
                        <ArrowUp className="size-3.5" />
                    ) : (
                        <ArrowDown className="size-3.5" />
                    ))}
            </button>
        </TableHead>
    );
}

export function TradesTable({ trades, onEdit, onDelete }: TradesTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("exitTime");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const sorted = useMemo(() => {
        const factor = sortDirection === "asc" ? 1 : -1;

        return [...trades].sort((a, b) => {
            switch (sortKey) {
                case "instrument":
                    return a.instrument.localeCompare(b.instrument) * factor;
                case "profitLoss":
                    return (a.profitLoss - b.profitLoss) * factor;
                case "exitTime":
                default:
                    return (
                        (new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()) *
                        factor
                    );
            }
        });
    }, [trades, sortKey, sortDirection]);

    function toggleSort(key: SortKey) {
        if (key === sortKey) {
            setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection(key === "instrument" ? "asc" : "desc");
        }
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <SortableHead
                        label="Instrument"
                        isActive={sortKey === "instrument"}
                        direction={sortDirection}
                        onClick={() => toggleSort("instrument")}
                    />
                    <TableHead>Market</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Exit</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <SortableHead
                        label="Exit time"
                        isActive={sortKey === "exitTime"}
                        direction={sortDirection}
                        onClick={() => toggleSort("exitTime")}
                    />
                    <TableHead className="text-right">Duration</TableHead>
                    <SortableHead
                        label={<span className="w-full text-right">P/L</span>}
                        isActive={sortKey === "profitLoss"}
                        direction={sortDirection}
                        onClick={() => toggleSort("profitLoss")}
                    />
                    <TableHead className="w-10" />
                </TableRow>
            </TableHeader>

            <TableBody>
                {sorted.map((trade) => (
                    <TableRow key={trade.id}>
                        <TableCell className="font-medium">{trade.instrument}</TableCell>
                        <TableCell className="text-muted-foreground">
                            {trade.marketName}
                        </TableCell>
                        <TableCell>
                            <DirectionBadge direction={trade.direction} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {trade.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {formatPrice(trade.entryPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {formatPrice(trade.exitPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatCurrency(trade.commission, trade.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                            {formatDateTime(trade.exitTime)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                            {formatDuration(trade.entryTime, trade.exitTime)}
                        </TableCell>
                        <TableCell className="text-right">
                            <ProfitLossValue
                                value={trade.profitLoss}
                                currency={trade.currency}
                            />
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Actions for ${trade.instrument} trade`}
                                        />
                                    }
                                >
                                    <MoreHorizontal />
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => onEdit(trade)}>
                                        <Pencil />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => onDelete(trade)}
                                    >
                                        <Trash2 />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
