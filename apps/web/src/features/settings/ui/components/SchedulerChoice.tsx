import { SCHEDULERS } from "@/features/settings/constants/scheduler";
import { cn } from "@/shared/lib/utils";

interface Props {
	readonly value: "ladder" | "fsrs";
	readonly onChange: (scheduler: "ladder" | "fsrs") => void;
}

export function SchedulerChoice({ value, onChange }: Props) {
	return (
		<div className="grid gap-2 sm:grid-cols-2">
			{SCHEDULERS.map((option) => (
				<button
					key={option.kind}
					type="button"
					aria-pressed={value === option.kind}
					onClick={() => onChange(option.kind)}
					className={cn(
						"rounded-lg border p-3 text-left transition-colors",
						value === option.kind
							? "border-primary bg-primary/5"
							: "border-border hover:bg-muted/50",
					)}
				>
					<span className="block text-sm font-medium">{option.title}</span>
					<span className="mt-0.5 block text-xs text-muted-foreground">
						{option.hint}
					</span>
				</button>
			))}
		</div>
	);
}
