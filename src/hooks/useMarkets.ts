import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createMarket,
    deleteMarket,
    listMarkets,
    updateMarket,
} from "@/db/markets";
import type { CreateMarketInput, UpdateMarketInput } from "@/types/models";

export const marketKeys = {
    all: ["markets"] as const,
    detail: (id: number) => ["markets", id] as const,
};

export function useMarkets() {
    return useQuery({
        queryKey: marketKeys.all,
        queryFn: listMarkets,
    });
}

export function useCreateMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateMarketInput) => createMarket(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: marketKeys.all });
            queryClient.invalidateQueries({ queryKey: ["trades"] });
        },
    });
}

export function useUpdateMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: UpdateMarketInput }) =>
            updateMarket(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: marketKeys.all });
            // Trades join their market's name and currency, so a rename or a
            // currency change must refresh the trade list too.
            queryClient.invalidateQueries({ queryKey: ["trades"] });
        },
    });
}

export function useDeleteMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => deleteMarket(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: marketKeys.all });
            queryClient.invalidateQueries({ queryKey: ["trades"] });
        },
    });
}
