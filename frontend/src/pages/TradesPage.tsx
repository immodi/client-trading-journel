import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import type { Trade } from "@/types/models";
import { useTrades } from "@/hooks/useTrades";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    EMPTY_FILTERS,
    type TradeFiltersState,
} from "@/components/trades/tradeFilters";
import { TradeFilters } from "@/components/trades/TradeFilters";
import { TradesTable } from "@/components/trades/TradesTable";
import { TradeFormDialog } from "@/components/trades/TradeFormDialog";
import { ImportTradesDialog } from "@/components/trades/ImportTradesDialog";
import { DeleteTradeDialog } from "@/components/trades/DeleteTradeDialog";

function localDate(iso: string): string {
    const date = new Date(iso);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export default function TradesPage() {
    const { data: trades = [], isLoading, isError, error } = useTrades();

    const [filters, setFilters] = useState<TradeFiltersState>(EMPTY_FILTERS);
    const [formOpen, setFormOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editing, setEditing] = useState<Trade | null>(null);
    const [deleting, setDeleting] = useState<Trade | null>(null);

    const filteredTrades = useMemo(() => {
        const search = filters.search.trim().toLowerCase();

        return trades.filter((trade) => {
            if (search && !trade.instrument.toLowerCase().includes(search)) return false;

            if (filters.direction !== "all" && trade.direction !== Number(filters.direction)) {
                return false;
            }

            const tradeDate = localDate(trade.exitTime);

            if (filters.from && tradeDate < filters.from) return false;
            if (filters.to && tradeDate > filters.to) return false;

            return true;
        });
    }, [trades, filters]);

    function openCreate() {
        setEditing(null);
        setFormOpen(true);
    }

    function openEdit(trade: Trade) {
        setEditing(trade);
        setFormOpen(true);
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                title="Trades"
                description="Every trade you have logged, with its result and duration."
                action={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setImportOpen(true)}>
                            <Upload />
                            Import
                        </Button>
                        <Button onClick={openCreate}>
                            <Plus />
                            Add trade
                        </Button>
                    </div>
                }
            />

            <Card>
                <CardContent>
                    <TradeFilters value={filters} onChange={setFilters} />
                </CardContent>
            </Card>

            {isError ? (
                <Alert variant="destructive">
                    <AlertDescription>{getErrorMessage(error)}</AlertDescription>
                </Alert>
            ) : isLoading ? (
                <Card>
                    <CardContent className="grid gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} className="h-10 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : trades.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <h2 className="font-heading text-lg font-medium">
                            No trades yet
                        </h2>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            Log your first trade to start tracking performance, win rate,
                            and profit factor.
                        </p>
                        <Button onClick={openCreate}>
                            <Plus />
                            Add your first trade
                        </Button>
                    </CardContent>
                </Card>
            ) : filteredTrades.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            No trades match your filters.
                        </p>
                        <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                            Clear filters
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent>
                        <TradesTable
                            trades={filteredTrades}
                            onEdit={openEdit}
                            onDelete={setDeleting}
                        />
                    </CardContent>
                </Card>
            )}

            {formOpen && (
                <TradeFormDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setFormOpen(false);
                            setEditing(null);
                        }
                    }}
                    trade={editing}
                />
            )}

            {importOpen && (
                <ImportTradesDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) setImportOpen(false);
                    }}
                />
            )}

            {deleting && (
                <DeleteTradeDialog
                    trade={deleting}
                    open
                    onOpenChange={(open) => {
                        if (!open) setDeleting(null);
                    }}
                />
            )}
        </div>
    );
}
