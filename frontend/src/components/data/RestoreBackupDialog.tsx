import { useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, FileJson, Loader2 } from "lucide-react";
import type { RestoreResult } from "@/db/backup";
import { useRestoreBackup } from "@/hooks/useBackup";
import {
    BackupError,
    parseBackup,
    type BackupDocument,
} from "@/lib/backup";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatInteger } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

interface RestoreBackupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRestored: (result: RestoreResult) => void;
}

export function RestoreBackupDialog({
    open,
    onOpenChange,
    onRestored,
}: RestoreBackupDialogProps) {
    const restoreBackup = useRestoreBackup();

    const [backup, setBackup] = useState<BackupDocument | null>(null);
    const [fileName, setFileName] = useState("");
    const [fileError, setFileError] = useState("");
    const [error, setError] = useState("");

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        setError("");
        setFileError("");
        setBackup(null);
        setFileName(file?.name ?? "");

        if (!file) return;

        try {
            const text = await file.text();

            let json: unknown;
            try {
                json = JSON.parse(text);
            } catch {
                throw new BackupError("The selected file is not valid JSON.");
            }

            setBackup(parseBackup(json));
        } catch (parseError) {
            setFileError(
                parseError instanceof BackupError
                    ? parseError.message
                    : "The selected file could not be read."
            );
        }
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        if (!backup) {
            setFileError("Choose a Trading Journal backup file.");
            return;
        }

        try {
            const result = await restoreBackup.mutateAsync(backup);
            onRestored(result);
            onOpenChange(false);
        } catch (restoreError) {
            setError(getErrorMessage(restoreError));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Restore from backup</DialogTitle>
                    <DialogDescription>
                        Replace every market and trade in this browser with the
                        contents of a full journal backup.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4">
                    <Alert variant="destructive">
                        <AlertTriangle />
                        <AlertTitle>This replaces your current journal</AlertTitle>
                        <AlertDescription>
                            All existing markets and trades are permanently
                            removed. Download a backup first if you might need
                            them.
                        </AlertDescription>
                    </Alert>

                    <div className="grid gap-2">
                        <Label htmlFor="backupFile">Backup file (.json)</Label>
                        <Input
                            id="backupFile"
                            type="file"
                            accept="application/json,.json"
                            onChange={handleFileChange}
                        />
                        <p className="text-xs text-muted-foreground">
                            Use a file created by Export backup on this page. Broker
                            trade exports are imported from the Trades page.
                        </p>
                        {fileError && (
                            <p className="text-xs text-destructive">{fileError}</p>
                        )}
                    </div>

                    {backup && (
                        <div className="grid gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
                            <p className="flex items-center gap-2 font-medium">
                                <FileJson className="size-4 text-muted-foreground" />
                                {fileName}
                            </p>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                                <span>Exported</span>
                                <span className="font-medium text-foreground">
                                    {formatDateTime(backup.exportedAt)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                                <span>Markets</span>
                                <span className="font-medium text-foreground">
                                    {formatInteger(backup.markets.length)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4 text-muted-foreground">
                                <span>Trades</span>
                                <span className="font-medium text-foreground">
                                    {formatInteger(backup.trades.length)}
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
                            variant="destructive"
                            disabled={restoreBackup.isPending || !backup}
                        >
                            {restoreBackup.isPending && (
                                <Loader2 className="animate-spin" />
                            )}
                            Replace all data
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
