import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends ComponentProps<"div"> {
	readonly value: number;
}

export function Progress({ value, className, ...props }: ProgressProps) {
	const clamped = Math.min(100, Math.max(0, value));

	return (
		<div
			role="progressbar"
			aria-valuenow={clamped}
			aria-valuemin={0}
			aria-valuemax={100}
			className={cn(
				"h-1.5 w-full overflow-hidden rounded-full bg-secondary",
				className,
			)}
			{...props}
		>
			<div
				className="h-full rounded-full bg-primary transition-[width] duration-300"
				style={{ width: `${clamped}%` }}
			/>
		</div>
	);
}
