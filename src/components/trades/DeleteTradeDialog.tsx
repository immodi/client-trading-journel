import { Loader2 } from "lucide-react";
import type { Trade } from "@/types/models";
import { useDeleteTrade } from "@/hooks/useTrades";
import { getErrorMessage } from "@/lib/errors";
import { formatSignedCurrency } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

interface DeleteTradeDialogProps {
    trade: Trade | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeleteTradeDialog({ trade, open, onOpenChange }: DeleteTradeDialogProps) {
    const deleteTrade = useDeleteTrade();
    const [error, setError] = useState("");

    async function handleDelete() {
        if (!trade) return;

        setError("");

        try {
            await deleteTrade.mutateAsync(trade.id);
            onOpenChange(false);
        } catch (deleteError) {
            setError(getErrorMessage(deleteError));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Delete trade</DialogTitle>
                    <DialogDescription>
                        {trade
                            ? `This permanently removes the ${trade.instrument} trade (${formatSignedCurrency(trade.profitLoss, trade.currency)}). This cannot be undone.`
                            : "This action cannot be undone."}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleteTrade.isPending}
                    >
                        {deleteTrade.isPending && <Loader2 className="animate-spin" />}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
