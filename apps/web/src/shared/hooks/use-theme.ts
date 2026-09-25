import { useCallback, useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/shared/constants/theme";

const systemPrefersDark = (): boolean =>
	globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

const stored = (): Theme | null => {
	try {
		const value = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);

		return value === "dark" || value === "light" ? value : null;
	} catch {
		return null;
	}
};

const remember = (theme: Theme): void => {
	try {
		globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		return;
	}
};

const applyTheme = (theme: Theme): void => {
	document.documentElement.classList.toggle("dark", theme === "dark");
};

export function useTheme() {
	const [theme, setTheme] = useState<Theme | null>(null);

	useEffect(() => {
		setTheme(stored() ?? (systemPrefersDark() ? "dark" : "light"));
	}, []);

	const choose = useCallback((next: Theme) => {
		setTheme(next);
		applyTheme(next);
		remember(next);
	}, []);

	return { theme, choose };
}
