import { useState } from "react";
import { Plus } from "lucide-react";
import type { Market } from "@/types/models";
import { useMarkets } from "@/hooks/useMarkets";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketsTable } from "@/components/markets/MarketsTable";
import { MarketFormDialog } from "@/components/markets/MarketFormDialog";
import { DeleteMarketDialog } from "@/components/markets/DeleteMarketDialog";

export default function MarketsPage() {
    const { data: markets = [], isLoading, isError, error } = useMarkets();

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Market | null>(null);
    const [deleting, setDeleting] = useState<Market | null>(null);

    function openCreate() {
        setEditing(null);
        setFormOpen(true);
    }

    function openEdit(market: Market) {
        setEditing(market);
        setFormOpen(true);
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                title="Markets"
                description="Group your trades by market. Each market sets the currency for its trades."
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        Add market
                    </Button>
                }
            />

            {isError ? (
                <Alert variant="destructive">
                    <AlertDescription>{getErrorMessage(error)}</AlertDescription>
                </Alert>
            ) : isLoading ? (
                <Card>
                    <CardContent className="grid gap-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-10 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : markets.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <h2 className="font-heading text-lg font-medium">No markets yet</h2>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            Create a market before logging trades so each trade inherits its
                            currency.
                        </p>
                        <Button onClick={openCreate}>
                            <Plus />
                            Add your first market
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent>
                        <MarketsTable
                            markets={markets}
                            onEdit={openEdit}
                            onDelete={setDeleting}
                        />
                    </CardContent>
                </Card>
            )}

            {formOpen && (
                <MarketFormDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setFormOpen(false);
                            setEditing(null);
                        }
                    }}
                    market={editing}
                />
            )}

            {deleting && (
                <DeleteMarketDialog
                    market={deleting}
                    open
                    onOpenChange={(open) => {
                        if (!open) setDeleting(null);
                    }}
                />
            )}
        </div>
    );
}
