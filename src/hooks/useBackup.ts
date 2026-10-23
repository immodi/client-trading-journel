import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readBackup, restoreBackup } from "@/db/backup";

export function useExportBackup() {
    return useMutation({
        mutationFn: readBackup,
    });
}

export function useRestoreBackup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: restoreBackup,
        onSuccess: () => {
            // Markets and trades are replaced wholesale; every cached view
            // must be rebuilt from the restored records.
            queryClient.invalidateQueries();
        },
    });
}
