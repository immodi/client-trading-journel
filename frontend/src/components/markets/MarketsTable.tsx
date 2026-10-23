import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Market } from "@/types/models";
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

interface MarketsTableProps {
    markets: Market[];
    onEdit: (market: Market) => void;
    onDelete: (market: Market) => void;
}

export function MarketsTable({ markets, onEdit, onDelete }: MarketsTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="w-10" />
                </TableRow>
            </TableHeader>

            <TableBody>
                {markets.map((market) => (
                    <TableRow key={market.id}>
                        <TableCell className="font-medium">{market.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                            {market.currency}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {market.tradeCount}
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Actions for ${market.name}`}
                                        />
                                    }
                                >
                                    <MoreHorizontal />
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => onEdit(market)}>
                                        <Pencil />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => onDelete(market)}
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
