import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/hooks/use-theme";

export function ThemeToggle() {
	const { theme, choose } = useTheme();

	if (theme === null) {
		return <span className="size-8" />;
	}

	const next = theme === "dark" ? "light" : "dark";

	return (
		<button
			type="button"
			aria-label={next === "dark" ? "Темна тема" : "Світла тема"}
			onClick={() => choose(next)}
			className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		>
			{theme === "dark" ? (
				<Sun className="size-4" />
			) : (
				<Moon className="size-4" />
			)}
		</button>
	);
}
