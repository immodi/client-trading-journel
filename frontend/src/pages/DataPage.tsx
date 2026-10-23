import { useState } from "react";
import { Link } from "react-router-dom";
import {
    DatabaseBackup,
    Download,
    Loader2,
    Upload,
} from "lucide-react";
import type { RestoreResult } from "@/db/backup";
import { useExportBackup } from "@/hooks/useBackup";
import { useMarkets } from "@/hooks/useMarkets";
import { useTrades } from "@/hooks/useTrades";
import {
    backupFileName,
    serializeBackup,
} from "@/lib/backup";
import { getErrorMessage } from "@/lib/errors";
import { formatInteger } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { RestoreBackupDialog } from "@/components/data/RestoreBackupDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

function downloadJson(contents: string, fileName: string): void {
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    link.remove();

    // Give the browser a moment to start the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function DataPage() {
    const exportBackup = useExportBackup();
    const { data: markets = [], isLoading: marketsLoading } = useMarkets();
    const { data: trades = [], isLoading: tradesLoading } = useTrades();

    const [restoreOpen, setRestoreOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const countsReady = !marketsLoading && !tradesLoading;

    async function handleExport() {
        setMessage("");
        setError("");

        try {
            const backup = await exportBackup.mutateAsync();

            downloadJson(serializeBackup(backup), backupFileName());

            setMessage(
                `Backup downloaded with ${formatInteger(
                    backup.markets.length
                )} ${backup.markets.length === 1 ? "market" : "markets"} and ${formatInteger(
                    backup.trades.length
                )} ${backup.trades.length === 1 ? "trade" : "trades"}.`
            );
        } catch (exportError) {
            setError(getErrorMessage(exportError));
        }
    }

    function handleRestored(result: RestoreResult) {
        setError("");
        setMessage(
            `Journal restored with ${formatInteger(
                result.markets
            )} ${result.markets === 1 ? "market" : "markets"} and ${formatInteger(
                result.trades
            )} ${result.trades === 1 ? "trade" : "trades"}.`
        );
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                title="Data"
                description="Back up the whole journal or restore it from a previous backup."
            />

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {message && (
                <Alert>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <DatabaseBackup className="size-4 text-muted-foreground" />
                            <CardTitle>Backup</CardTitle>
                        </div>
                        <CardDescription>
                            Download every market and trade as one JSON file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <p className="text-sm text-muted-foreground">
                            {countsReady
                                ? `This journal currently has ${formatInteger(
                                      markets.length
                                  )} ${
                                      markets.length === 1 ? "market" : "markets"
                                  } and ${formatInteger(trades.length)} ${
                                      trades.length === 1 ? "trade" : "trades"
                                  }.`
                                : "Reading your journal…"}
                        </p>
                        <div>
                            <Button
                                onClick={handleExport}
                                disabled={exportBackup.isPending}
                            >
                                {exportBackup.isPending ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <Download />
                                )}
                                Export backup
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Upload className="size-4 text-muted-foreground" />
                            <CardTitle>Restore</CardTitle>
                        </div>
                        <CardDescription>
                            Replace the journal with the contents of a backup file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <p className="text-sm text-muted-foreground">
                            Restoring is for whole-journal backups. To add trades
                            from a broker or another journal, use{" "}
                            <Link to="/trades" className="underline underline-offset-3">
                                Import on the Trades page
                            </Link>{" "}
                            instead.
                        </p>
                        <div>
                            <Button
                                variant="outline"
                                onClick={() => setRestoreOpen(true)}
                            >
                                <Upload />
                                Restore from backup
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <p className="text-xs text-muted-foreground">
                Backups contain markets and trades only. Browser preferences such as
                the theme and last opened market are not included.
            </p>

            {restoreOpen && (
                <RestoreBackupDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) setRestoreOpen(false);
                    }}
                    onRestored={handleRestored}
                />
            )}
        </div>
    );
}
