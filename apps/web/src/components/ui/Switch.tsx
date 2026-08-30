import { cn } from "@/shared/lib/utils";

interface Props {
	readonly checked: boolean;
	readonly label: string;
	readonly hint?: string;
	readonly disabled?: boolean;
	readonly onChange: (checked: boolean) => void;
}

export function Switch({
	checked,
	label,
	hint,
	disabled = false,
	onChange,
}: Props) {
	return (
		<label className="flex cursor-pointer items-start justify-between gap-4 py-3">
			<span className="min-w-0">
				<span className="block text-sm font-medium">{label}</span>
				{hint === undefined ? null : (
					<span className="mt-0.5 block text-xs text-muted-foreground">
						{hint}
					</span>
				)}
			</span>
			<input
				type="checkbox"
				aria-label={label}
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
				className="peer sr-only"
			/>
			<span
				aria-hidden="true"
				className={cn(
					"relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
					checked ? "bg-primary" : "bg-input",
					disabled ? "opacity-50" : "",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 size-5 rounded-full bg-background shadow transition-all",
						checked ? "left-[1.375rem]" : "left-0.5",
					)}
				/>
			</span>
		</label>
	);
}
