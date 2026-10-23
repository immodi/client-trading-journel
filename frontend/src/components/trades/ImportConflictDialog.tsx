import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ImportTradeItem } from "@/types/models";
import type {
    ImportConflict,
    ImportConflictDecision,
} from "@/lib/importConflicts";
import {
    formatDateTime,
    formatDuration,
    formatPrice,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DirectionBadge } from "@/components/trades/DirectionBadge";

interface ImportConflictDialogProps {
    conflicts: ImportConflict[];
    importedTrades: ImportTradeItem[];
    isImporting: boolean;
    onResolve: (decisions: Record<number, ImportConflictDecision>) => void;
    onCancel: () => void;
}

type ComparableTrade = Pick<
    ImportTradeItem,
    | "instrument"
    | "direction"
    | "quantity"
    | "entryPrice"
    | "exitPrice"
    | "entryTime"
    | "exitTime"
>;

interface TradeSnapshotProps {
    title: string;
    source: string;
    trade: ComparableTrade;
    highlight?: boolean;
}

function TradeSnapshot({ title, source, trade, highlight }: TradeSnapshotProps) {
    return (
        <div
            className={
                highlight
                    ? "grid gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3"
                    : "grid gap-3 rounded-lg border bg-muted/30 p-3"
            }
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{title}</span>
                <Badge variant={highlight ? "default" : "secondary"}>{source}</Badge>
            </div>

            <div className="flex items-center gap-2">
                <span className="font-heading text-lg font-medium">
                    {trade.instrument}
                </span>
                <DirectionBadge direction={trade.direction} />
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Quantity</dt>
                <dd className="text-right font-medium tabular-nums">
                    {trade.quantity}
                </dd>

                <dt className="text-muted-foreground">Entry</dt>
                <dd className="text-right font-medium tabular-nums">
                    {formatPrice(trade.entryPrice)}
                </dd>

                <dt className="text-muted-foreground">Exit</dt>
                <dd className="text-right font-medium tabular-nums">
                    {formatPrice(trade.exitPrice)}
                </dd>

                <dt className="text-muted-foreground">Entry time</dt>
                <dd className="text-right font-medium">
                    {formatDateTime(trade.entryTime)}
                </dd>

                <dt className="text-muted-foreground">Exit time</dt>
                <dd className="text-right font-medium">
                    {formatDateTime(trade.exitTime)}
                </dd>

                <dt className="text-muted-foreground">Duration</dt>
                <dd className="text-right font-medium">
                    {formatDuration(trade.entryTime, trade.exitTime)}
                </dd>
            </dl>
        </div>
    );
}

export function ImportConflictDialog({
    conflicts,
    importedTrades,
    isImporting,
    onResolve,
    onCancel,
}: ImportConflictDialogProps) {
    const [workingTrades, setWorkingTrades] = useState(importedTrades);
    const [decisions, setDecisions] = useState<
        Record<number, ImportConflictDecision>
    >({});
    const [cursor, setCursor] = useState(0);

    const conflict = conflicts[Math.min(cursor, conflicts.length - 1)];

    if (!conflict) return null;

    const newTrade = workingTrades[conflict.importedIndex];
    const oldTrade: ComparableTrade | undefined =
        conflict.kind === "existing"
            ? conflict.existingTrade
            : workingTrades[conflict.previousIndex];

    if (!newTrade || !oldTrade) return null;

    function commit(decision: ImportConflictDecision) {
        const nextDecisions = {
            ...decisions,
            [conflict.importedIndex]: decision,
        };

        setDecisions(nextDecisions);

        if (decision === "overwrite" && conflict.kind === "file") {
            setWorkingTrades((previous) => {
                const next = [...previous];
                next[conflict.previousIndex] = previous[conflict.importedIndex];
                return next;
            });
        }

        if (cursor + 1 < conflicts.length) {
            setCursor(cursor + 1);
        } else {
            onResolve(nextDecisions);
        }
    }

    function resolveAll(decision: ImportConflictDecision) {
        const nextDecisions = { ...decisions };
        const nextWorking = [...workingTrades];

        for (let index = cursor; index < conflicts.length; index += 1) {
            const pending = conflicts[index];
            nextDecisions[pending.importedIndex] = decision;

            if (decision === "overwrite" && pending.kind === "file") {
                nextWorking[pending.previousIndex] =
                    nextWorking[pending.importedIndex];
            }
        }

        setDecisions(nextDecisions);
        setWorkingTrades(nextWorking);
        onResolve(nextDecisions);
    }

    const matchesExisting = conflict.kind === "existing";

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !isImporting) onCancel();
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Resolve duplicate trades</DialogTitle>
                    <DialogDescription>
                        {matchesExisting
                            ? "This imported trade matches a trade already in your journal."
                            : "This imported trade appears more than once in the file."}{" "}
                        Conflict {cursor + 1} of {conflicts.length}.
                    </DialogDescription>
                </DialogHeader>

                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                            width: `${((cursor + 1) / conflicts.length) * 100}%`,
                        }}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <TradeSnapshot
                        title="Old trade"
                        source={
                            matchesExisting ? "In journal" : "Earlier in file"
                        }
                        trade={oldTrade}
                    />
                    <TradeSnapshot
                        title="New trade"
                        source="From this file"
                        trade={newTrade}
                        highlight
                    />
                </div>

                <p className="text-xs text-muted-foreground">
                    Duplicates are matched on instrument, entry time, and exit
                    time. Overwrite replaces the old trade with the new one;
                    discard keeps the old trade and skips the new one.
                </p>

                <DialogFooter className="flex-wrap">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onCancel}
                        disabled={isImporting}
                    >
                        Cancel import
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => commit("discard")}
                        disabled={isImporting}
                    >
                        Discard this one trade
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => resolveAll("discard")}
                        disabled={isImporting}
                    >
                        Discard all
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => commit("overwrite")}
                        disabled={isImporting}
                    >
                        Overwrite this one trade
                    </Button>
                    <Button
                        type="button"
                        onClick={() => resolveAll("overwrite")}
                        disabled={isImporting}
                    >
                        {isImporting && <Loader2 className="animate-spin" />}
                        Overwrite all
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
