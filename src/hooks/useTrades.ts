import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createTrade,
    deleteTrade,
    importTrades,
    listTrades,
    updateTrade,
} from "@/db/trades";
import { marketKeys } from "@/hooks/useMarkets";
import type { CreateTradeInput, ImportTradesInput, UpdateTradeInput } from "@/types/models";

export const tradeKeys = {
    all: ["trades"] as const,
    detail: (id: number) => ["trades", id] as const,
};

export function useTrades() {
    return useQuery({
        queryKey: tradeKeys.all,
        queryFn: listTrades,
    });
}

function useRefreshJournal() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: tradeKeys.all });
        // Trade counts shown on the markets page change with the journal.
        queryClient.invalidateQueries({ queryKey: marketKeys.all });
    };
}

export function useCreateTrade() {
    const refresh = useRefreshJournal();

    return useMutation({
        mutationFn: (input: CreateTradeInput) => createTrade(input),
        onSuccess: refresh,
    });
}

export function useUpdateTrade() {
    const refresh = useRefreshJournal();

    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: UpdateTradeInput }) =>
            updateTrade(id, input),
        onSuccess: refresh,
    });
}

export function useDeleteTrade() {
    const refresh = useRefreshJournal();

    return useMutation({
        mutationFn: (id: number) => deleteTrade(id),
        onSuccess: refresh,
    });
}

export function useImportTrades() {
    const refresh = useRefreshJournal();

    return useMutation({
        mutationFn: (input: ImportTradesInput) => importTrades(input),
        onSuccess: refresh,
    });
}
