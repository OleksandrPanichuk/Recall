import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEY, type Theme } from "./use-theme.constants";

const systemPrefersDark = (): boolean =>
	globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

const stored = (): Theme | null => {
	try {
		const value = globalThis.localStorage?.getItem(STORAGE_KEY);

		return value === "dark" || value === "light" ? value : null;
	} catch {
		return null;
	}
};

export const applyTheme = (theme: Theme): void => {
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

		try {
			globalThis.localStorage?.setItem(STORAGE_KEY, next);
		} catch {
			// a browser that refuses storage still gets the theme for this visit
		}
	}, []);

	return { theme, choose };
}
