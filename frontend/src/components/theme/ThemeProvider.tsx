import type { ReactNode } from "react";
import { ThemeContext, useThemeProviderValue } from "@/hooks/useTheme";

export function ThemeProvider({ children }: { children: ReactNode }) {
    const value = useThemeProviderValue();

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
