export interface TradeFiltersState {
    search: string;
    direction: string;
    from: string;
    to: string;
}

export const EMPTY_FILTERS: TradeFiltersState = {
    search: "",
    direction: "all",
    from: "",
    to: "",
};
