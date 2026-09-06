import type { FeltGrade } from "@recall/contracts";
import { Button } from "@/components/ui/Button";
import { RECALL_CHOICES } from "./RecallButtons.constants";

interface Props {
	readonly chosen?: FeltGrade;
	readonly busy: boolean;
	readonly onRate: (grade: FeltGrade) => Promise<void>;
}

export function RecallButtons({ chosen, busy, onRate }: Props) {
	return (
		<div className="space-y-1.5">
			<p className="text-xs text-muted-foreground">
				Наскільки легко це згадалось? Від цього залежить наступне повторення.
			</p>
			<div className="grid grid-cols-3 gap-1.5">
				{RECALL_CHOICES.map((choice) => (
					<Button
						key={choice.grade}
						variant={chosen === choice.grade ? "default" : "outline"}
						disabled={busy}
						className="h-auto flex-col gap-0.5 py-2"
						onClick={() => onRate(choice.grade)}
					>
						<span className="text-sm font-medium">{choice.label}</span>
						<span className="text-[10px] font-normal opacity-70">
							{choice.caption}
						</span>
					</Button>
				))}
			</div>
		</div>
	);
}
