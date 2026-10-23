import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import type { Market } from "@/types/models";
import { useCreateMarket, useUpdateMarket } from "@/hooks/useMarkets";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_MARKET_NAME_LENGTH } from "@/lib/validation";

interface MarketFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided the dialog edits the market, otherwise it creates a new one. */
    market?: Market | null;
}

interface FormState {
    name: string;
    currency: string;
}

function initialForm(market?: Market | null): FormState {
    return market
        ? { name: market.name, currency: market.currency }
        : { name: "", currency: "" };
}

export function MarketFormDialog({ open, onOpenChange, market }: MarketFormDialogProps) {
    const isEditing = Boolean(market);
    const createMarket = useCreateMarket();
    const updateMarket = useUpdateMarket();
    const isSaving = createMarket.isPending || updateMarket.isPending;

    const [form, setForm] = useState<FormState>(() => initialForm(market));
    const [error, setError] = useState("");

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((previous) => ({ ...previous, [key]: value }));
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const name = form.name.trim();
        const currency = form.currency.trim().toUpperCase();

        if (!name) {
            setError("Market name is required.");
            return;
        }
        if (!/^[A-Z]{3}$/.test(currency)) {
            setError("Currency must be a 3-letter ISO code, for example USD.");
            return;
        }

        try {
            if (market) {
                await updateMarket.mutateAsync({ id: market.id, input: { name, currency } });
            } else {
                await createMarket.mutateAsync({ name, currency });
            }

            onOpenChange(false);
        } catch (submitError) {
            setError(getErrorMessage(submitError));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit market" : "New market"}</DialogTitle>
                    <DialogDescription>
                        Every trade in this market inherits its currency.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="marketName">Name</Label>
                        <Input
                            id="marketName"
                            placeholder="US Equities"
                            maxLength={MAX_MARKET_NAME_LENGTH}
                            value={form.name}
                            onChange={(event) => update("name", event.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="marketCurrency">Currency</Label>
                        <Input
                            id="marketCurrency"
                            placeholder="USD"
                            maxLength={3}
                            value={form.currency}
                            onChange={(event) => update("currency", event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            A 3-letter ISO 4217 code, for example USD, EUR, or GBP.
                        </p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="animate-spin" />}
                            {isEditing ? "Save changes" : "Add market"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
