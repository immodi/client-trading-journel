import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import type { ImportTradeItem } from "@/types/models";
import { useImportTrades } from "@/hooks/useTrades";
import { useMarkets } from "@/hooks/useMarkets";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency, formatInteger } from "@/lib/format";
import { COMMISSION_SIDES_PER_ROUND_TRIP } from "@/lib/tradeMath";
import { parseTradeExport, TradeImportError } from "@/lib/tradeImport";
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

interface ImportTradesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ParsedFile {
    fileName: string;
    trades: ImportTradeItem[];
    instrument: string;
    pointValue: number;
    commissionPerSide: number;
}

/** A round trip pays commission on both the entry and the exit. */
const COMMISSION_SIDES = COMMISSION_SIDES_PER_ROUND_TRIP;

/** Shape shown under the file picker so users know what to upload. */
const SCHEMA_EXAMPLE = `{
  "meta": {
    "instrument": "MNQ",
    "pointValue": 2,
    "commissionPerSide": 1
  },
  "summary": {
    "tradeCount": 1,
    "totalCommission": 2
  },
  "trades": [
    {
      "instrument": "MNQ",
      "direction": "long",
      "quantity": 1,
      "entryPrice": 14824.98,
      "exitPrice": 14844.98,
      "entryTime": "2021-07-11T22:00:00.000Z",
      "exitTime": "2021-07-11T22:05:00.000Z"
    }
  ]
}`;

export function ImportTradesDialog({ open, onOpenChange }: ImportTradesDialogProps) {
    const importTrades = useImportTrades();
    const { data: markets = [] } = useMarkets();

    const [marketId, setMarketId] = useState("");
    const [parsed, setParsed] = useState<ParsedFile | null>(null);
    const [fileError, setFileError] = useState("");
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

    // Default to the first market once the list is available, without syncing
    // it into state (which would trigger a cascading render).
    const effectiveMarketId =
        marketId || (markets.length > 0 ? String(markets[0].id) : "");

    const selectedMarket = markets.find(
        (market) => String(market.id) === effectiveMarketId
    );

    const totalCommission = parsed
        ? parsed.commissionPerSide * COMMISSION_SIDES * parsed.trades.reduce(
              (sum, trade) => sum + trade.quantity,
              0
          )
        : 0;

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        setError("");
        setFileError("");
        setParsed(null);

        if (!file) return;

        try {
            const text = await file.text();

            let json: unknown;
            try {
                json = JSON.parse(text);
            } catch {
                throw new TradeImportError("The selected file is not valid JSON.");
            }

            const preview = parseTradeExport(json);

            setParsed({
                fileName: file.name,
                trades: preview.trades,
                instrument: preview.instrument,
                pointValue: preview.pointValue,
                commissionPerSide: preview.commissionPerSide,
            });
        } catch (parseError) {
            setFileError(
                parseError instanceof TradeImportError
                    ? parseError.message
                    : "The selected file could not be read."
            );
        }
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const market = Number(effectiveMarketId);

        if (!parsed) {
            setFileError("Choose a .json export to import.");
            return;
        }
        if (!effectiveMarketId || !Number.isInteger(market)) {
            setError("Select a market to import the trades into.");
            return;
        }

        try {
            await importTrades.mutateAsync({
                marketId: market,
                pointValue: parsed.pointValue,
                commissionPerSide: parsed.commissionPerSide,
                trades: parsed.trades,
            });
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
                    <DialogTitle>Import trades</DialogTitle>
                    <DialogDescription>
                        Bring trades in from a JSON export. They are added under the market
                        you choose here.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4">
                    {noMarkets && (
                        <Alert>
                            <AlertDescription>
                                You need a market before importing trades. Create one from the
                                Markets page.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="importMarket">Market</Label>
                        <Select
                            items={marketItems}
                            value={effectiveMarketId}
                            onValueChange={(value) => setMarketId(value as string)}
                        >
                            <SelectTrigger id="importMarket" className="w-full">
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
                        <p className="text-xs text-muted-foreground">
                            Every imported trade is filed under this market and inherits its
                            currency.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="importFile">Export file (.json)</Label>
                        <Input
                            id="importFile"
                            type="file"
                            accept="application/json,.json"
                            onChange={handleFileChange}
                        />
                        {fileError && (
                            <p className="text-xs text-destructive">{fileError}</p>
                        )}

                        <details open className="group rounded-lg border bg-muted/40 text-xs">
                            <summary className="cursor-pointer list-none px-3 py-2 font-medium text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
                                Expected JSON format
                            </summary>
                            <pre className="max-h-48 overflow-auto border-t px-3 py-2 text-[11px] leading-relaxed">
                                <code>{SCHEMA_EXAMPLE}</code>
                            </pre>
                        </details>
                    </div>

                    {parsed && (
                        <div className="grid gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
                            <p className="flex items-center gap-2 font-medium">
                                <Upload className="size-4 text-muted-foreground" />
                                {parsed.fileName}
                            </p>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                                <span>Instrument</span>
                                <span className="font-medium text-foreground">
                                    {parsed.instrument}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                                <span>Point value</span>
                                <span className="font-medium text-foreground">
                                    {parsed.pointValue}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                                <span>Trades</span>
                                <span className="font-medium text-foreground">
                                    {formatInteger(parsed.trades.length)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                                <span>Total commission</span>
                                <span className="font-medium text-foreground">
                                    {formatCurrency(
                                        totalCommission,
                                        selectedMarket?.currency
                                    )}
                                </span>
                            </div>
                        </div>
                    )}

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
                        <Button
                            type="submit"
                            disabled={importTrades.isPending || noMarkets || !parsed}
                        >
                            {importTrades.isPending && <Loader2 className="animate-spin" />}
                            Import trades
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
