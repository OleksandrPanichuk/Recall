import { RETENTIONS } from "@/features/settings/constants/scheduler";
import { cn } from "@/shared/lib/utils";

interface Props {
	readonly value: number;
	readonly onChange: (desiredRetention: number) => void;
}

export function RetentionChoice({ value, onChange }: Props) {
	return (
		<div className="flex flex-wrap gap-2">
			{RETENTIONS.map((retention) => (
				<button
					key={retention}
					type="button"
					aria-pressed={Math.abs(value - retention) < 0.001}
					onClick={() => onChange(retention)}
					className={cn(
						"rounded-md border px-3 py-1.5 text-sm transition-colors",
						Math.abs(value - retention) < 0.001
							? "border-primary bg-primary/5 font-medium"
							: "border-border hover:bg-muted/50",
					)}
				>
					{Math.round(retention * 100)}%
				</button>
			))}
		</div>
	);
}
