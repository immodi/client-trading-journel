import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Market } from "@/types/models";
import { useDeleteMarket } from "@/hooks/useMarkets";
import { getErrorMessage } from "@/lib/errors";
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

interface DeleteMarketDialogProps {
    market: Market | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeleteMarketDialog({ market, open, onOpenChange }: DeleteMarketDialogProps) {
    const deleteMarket = useDeleteMarket();
    const [error, setError] = useState("");

    async function handleDelete() {
        if (!market) return;

        setError("");

        try {
            await deleteMarket.mutateAsync(market.id);
            onOpenChange(false);
        } catch (deleteError) {
            // A market with trades is refused by the local data layer; show why.
            setError(getErrorMessage(deleteError));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Delete market</DialogTitle>
                    <DialogDescription>
                        {market
                            ? `This permanently removes the ${market.name} market. Markets that still have trades cannot be deleted.`
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
                        disabled={deleteMarket.isPending}
                    >
                        {deleteMarket.isPending && <Loader2 className="animate-spin" />}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
