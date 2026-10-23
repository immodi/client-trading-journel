import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "trading-journal-theme";

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error("useTheme must be used within a <ThemeProvider>.");
    }

    return context;
}

export function isTheme(value: string | null): value is Theme {
    return value === "light" || value === "dark" || value === "system";
}

export function getStoredTheme(): Theme {
    if (typeof window === "undefined") return "system";

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
}

export function systemPrefersDark(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
}

export function useThemeProviderValue(): ThemeContextValue {
    const [theme, setTheme] = useState<Theme>(getStoredTheme);
    const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

    // Track the OS preference so "system" stays live without a reload.
    useEffect(() => {
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);

        query.addEventListener("change", handleChange);
        return () => query.removeEventListener("change", handleChange);
    }, []);

    const resolvedTheme: ResolvedTheme =
        theme === "system" ? (prefersDark ? "dark" : "light") : theme;

    // Reflect the active theme on <html> (the Tailwind `dark` variant targets
    // `.dark` descendants) and remember the choice.
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", resolvedTheme === "dark");
        root.style.colorScheme = resolvedTheme;
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme, resolvedTheme]);

    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            const isDark =
                current === "dark" || (current === "system" && systemPrefersDark());
            return isDark ? "light" : "dark";
        });
    }, []);

    return useMemo(
        () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
        [theme, resolvedTheme, toggleTheme]
    );
}

export { ThemeContext };
