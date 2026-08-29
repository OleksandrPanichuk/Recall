import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
	return (
		<textarea
			className={cn(
				"min-h-48 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}
