import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Direction, DIRECTION_LABELS, type CreateTradeInput, type Trade } from "@/types/models";
import { useCreateTrade, useUpdateTrade } from "@/hooks/useTrades";
import { useMarkets } from "@/hooks/useMarkets";
import { getErrorMessage } from "@/lib/errors";
import { fromDateTimeLocal, nowAsDateTimeLocal, toDateTimeLocal } from "@/lib/datetime";
import { formatCurrency } from "@/lib/format";
import {
    COMMISSION_SIDES_PER_ROUND_TRIP,
    roundToFour,
} from "@/lib/tradeMath";
import { MAX_INSTRUMENT_LENGTH } from "@/lib/validation";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface TradeFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided the dialog edits the trade, otherwise it creates a new one. */
    trade?: Trade | null;
}

interface FormState {
    marketId: string;
    instrument: string;
    direction: number;
    quantity: string;
    entryPrice: string;
    exitPrice: string;
    pointValue: string;
    entryTime: string;
    exitTime: string;
    commissionPerSide: string;
}

const DIRECTION_ITEMS = {
    [Direction.Long]: DIRECTION_LABELS[Direction.Long],
    [Direction.Short]: DIRECTION_LABELS[Direction.Short],
};

const DEFAULT_COMMISSION_PER_SIDE = "0";

/** Shares move one currency unit per point; futures override this (e.g. 2 for MNQ). */
const DEFAULT_POINT_VALUE = "1";

/**
 * A round trip pays commission on both the entry and the exit, so the total is
 * `per side × 2 × quantity`.
 */
const COMMISSION_SIDES = COMMISSION_SIDES_PER_ROUND_TRIP;

/** Round to 4 decimals to keep stored money values consistent. */
function round4(value: number): number {
    return roundToFour(value);
}

function initialForm(trade?: Trade | null): FormState {
    if (!trade) {
        return {
            marketId: "",
            instrument: "",
            direction: Direction.Long,
            quantity: "1",
            entryPrice: "",
            exitPrice: "",
            pointValue: DEFAULT_POINT_VALUE,
            entryTime: nowAsDateTimeLocal(),
            exitTime: nowAsDateTimeLocal(),
            commissionPerSide: DEFAULT_COMMISSION_PER_SIDE,
        };
    }

    return {
        marketId: String(trade.marketId),
        instrument: trade.instrument,
        direction: trade.direction,
        quantity: String(trade.quantity),
        entryPrice: String(trade.entryPrice),
        exitPrice: String(trade.exitPrice),
        pointValue: String(round4(trade.pointValue)),
        entryTime: toDateTimeLocal(trade.entryTime),
        exitTime: toDateTimeLocal(trade.exitTime),
        commissionPerSide: String(round4(trade.commissionPerUnit / COMMISSION_SIDES)),
    };
}

export function TradeFormDialog({ open, onOpenChange, trade }: TradeFormDialogProps) {
    const isEditing = Boolean(trade);
    const createTrade = useCreateTrade();
    const updateTrade = useUpdateTrade();
    const { data: markets = [] } = useMarkets();
    const isSaving = createTrade.isPending || updateTrade.isPending;

    const [form, setForm] = useState<FormState>(() => initialForm(trade));
    const [error, setError] = useState("");

    const marketItems = useMemo(
        () =>
            Object.fromEntries(
                markets.map((market) => [
                    String(market.id),
                    `${market.name} (${market.currency})`,
                ])
            ),
        [markets]
    );

    // Default to the first market once the list is available without needing
    // to sync it into state (which would trigger a cascading render).
    const effectiveMarketId =
        form.marketId || (markets.length > 0 ? String(markets[0].id) : "");

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((previous) => ({ ...previous, [key]: value }));
    }

    const selectedMarket = markets.find(
        (market) => String(market.id) === effectiveMarketId
    );

    const quantity = Number(form.quantity);
    const commissionPerSide = Number(form.commissionPerSide);
    const totalCommission =
        Number.isFinite(quantity) &&
        quantity > 0 &&
        Number.isFinite(commissionPerSide)
            ? round4(commissionPerSide * COMMISSION_SIDES * quantity)
            : 0;

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const quantityValue = Number(form.quantity);
        const entryPrice = Number(form.entryPrice);
        const exitPrice = Number(form.exitPrice);
        const pointValue =
            form.pointValue.trim() === "" ? NaN : Number(form.pointValue);
        const marketId = Number(effectiveMarketId);
        const perSide =
            form.commissionPerSide.trim() === "" ? 0 : Number(form.commissionPerSide);

        if (!effectiveMarketId || !Number.isInteger(marketId)) {
            setError("Select a market for this trade.");
            return;
        }
        if (!form.instrument.trim()) {
            setError("Instrument is required.");
            return;
        }
        if (!Number.isInteger(quantityValue) || quantityValue <= 0) {
            setError("Quantity must be a whole number greater than zero.");
            return;
        }
        if (!Number.isFinite(entryPrice) || entryPrice < 0) {
            setError("Entry price must be a non-negative number.");
            return;
        }
        if (!Number.isFinite(exitPrice) || exitPrice < 0) {
            setError("Exit price must be a non-negative number.");
            return;
        }
        if (!Number.isFinite(pointValue) || pointValue <= 0) {
            setError("Point value must be a number greater than zero.");
            return;
        }
        if (!Number.isFinite(perSide) || perSide < 0) {
            setError("Commission per side must be a non-negative number.");
            return;
        }
        if (!form.entryTime || !form.exitTime) {
            setError("Entry and exit times are required.");
            return;
        }
        if (new Date(form.exitTime) < new Date(form.entryTime)) {
            setError("Exit time cannot be before the entry time.");
            return;
        }

        const input: CreateTradeInput = {
            marketId,
            instrument: form.instrument.trim().toUpperCase(),
            direction: form.direction as Direction,
            quantity: quantityValue,
            entryPrice,
            exitPrice,
            pointValue: round4(pointValue),
            entryTime: fromDateTimeLocal(form.entryTime),
            exitTime: fromDateTimeLocal(form.exitTime),
            commissionPerUnit: round4(perSide * COMMISSION_SIDES),
        };

        try {
            if (trade) {
                await updateTrade.mutateAsync({ id: trade.id, input });
            } else {
                await createTrade.mutateAsync(input);
            }

            onOpenChange(false);
        } catch (submitError) {
            setError(getErrorMessage(submitError));
        }
    }

    const noMarkets = markets.length === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit trade" : "New trade"}</DialogTitle>
                    <DialogDescription>
                        Profit/loss is calculated locally from these values.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4">
                    {noMarkets && (
                        <Alert>
                            <AlertDescription>
                                You need a market before logging a trade. Create one from the
                                Markets page.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid items-start gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="market">Market</Label>
                            <Select
                                items={marketItems}
                                value={effectiveMarketId}
                                onValueChange={(value) =>
                                    update("marketId", value as string)
                                }
                            >
                                <SelectTrigger id="market" className="w-full">
                                    <SelectValue placeholder="Select a market" />
                                </SelectTrigger>
                                <SelectContent>
                                    {markets.map((market) => (
                                        <SelectItem key={market.id} value={String(market.id)}>
                                            {market.name} ({market.currency})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="instrument">Instrument</Label>
                            <Input
                                id="instrument"
                                placeholder="MNQ"
                                maxLength={MAX_INSTRUMENT_LENGTH}
                                value={form.instrument}
                                onChange={(event) => update("instrument", event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="direction">Direction</Label>
                            <Select
                                items={DIRECTION_ITEMS}
                                value={form.direction}
                                onValueChange={(value) =>
                                    update("direction", value as number)
                                }
                            >
                                <SelectTrigger id="direction" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={Direction.Long}>
                                        {DIRECTION_LABELS[Direction.Long]}
                                    </SelectItem>
                                    <SelectItem value={Direction.Short}>
                                        {DIRECTION_LABELS[Direction.Short]}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                step="1"
                                value={form.quantity}
                                onChange={(event) => update("quantity", event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="pointValue">Point value</Label>
                            <Input
                                id="pointValue"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="1"
                                value={form.pointValue}
                                onChange={(event) =>
                                    update("pointValue", event.target.value)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Value of one point per unit — 2 for MNQ, 1 for shares.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="entryPrice">Entry price</Label>
                            <Input
                                id="entryPrice"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={form.entryPrice}
                                onChange={(event) => update("entryPrice", event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="exitPrice">Exit price</Label>
                            <Input
                                id="exitPrice"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={form.exitPrice}
                                onChange={(event) => update("exitPrice", event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="entryTime">Entry time</Label>
                            <Input
                                id="entryTime"
                                type="datetime-local"
                                value={form.entryTime}
                                onChange={(event) => update("entryTime", event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="exitTime">Exit time</Label>
                            <Input
                                id="exitTime"
                                type="datetime-local"
                                value={form.exitTime}
                                onChange={(event) => update("exitTime", event.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="commissionPerSide">Commission per side</Label>
                            <Input
                                id="commissionPerSide"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={form.commissionPerSide}
                                onChange={(event) =>
                                    update("commissionPerSide", event.target.value)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Total {formatCurrency(totalCommission, selectedMarket?.currency)} —
                                calculated as per side × 2 × quantity.
                            </p>
                        </div>
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
                        <Button type="submit" disabled={isSaving || noMarkets}>
                            {isSaving && <Loader2 className="animate-spin" />}
                            {isEditing ? "Save changes" : "Add trade"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
