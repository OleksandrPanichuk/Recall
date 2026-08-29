import type { Question } from "@recall/contracts";
import { QuestionType } from "@recall/contracts";
import { shuffled } from "@recall/kit/shuffle";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/shared/lib/utils";

interface Props {
	readonly question: Question;
	readonly disabled: boolean;
	readonly shuffleSeed?: string;
	onAnswer(positions: readonly number[]): void;
}

export function ChoiceOptions({
	question,
	disabled,
	shuffleSeed,
	onAnswer,
}: Props) {
	const many = question.type === QuestionType.MultipleChoice;
	const [chosen, setChosen] = useState<readonly number[]>([]);
	const shown = useMemo(
		() =>
			shuffleSeed === undefined
				? question.options
				: shuffled(question.options, shuffleSeed),
		[question.options, shuffleSeed],
	);

	const toggle = (position: number): void => {
		if (!many) {
			onAnswer([position]);

			return;
		}

		setChosen((current) =>
			current.includes(position)
				? current.filter((entry) => entry !== position)
				: [...current, position],
		);
	};

	return (
		<div className="space-y-2">
			{shown.map((option) => {
				const picked = chosen.includes(option.position);

				return (
					<button
						key={option.id}
						type="button"
						disabled={disabled}
						onClick={() => toggle(option.position)}
						className={cn(
							"flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors",
							"hover:border-primary/60 disabled:pointer-events-none disabled:opacity-60",
							picked && "border-primary bg-primary/5",
						)}
					>
						{many ? (
							<span
								className={cn(
									"flex size-5 shrink-0 items-center justify-center rounded border border-input",
									picked && "border-primary bg-primary text-primary-foreground",
								)}
							>
								{picked ? <Check className="size-3.5" /> : null}
							</span>
						) : null}
						<span>{option.text}</span>
					</button>
				);
			})}

			{many ? (
				<Button
					className="w-full"
					disabled={disabled || chosen.length === 0}
					onClick={() => onAnswer(chosen)}
				>
					Відповісти
				</Button>
			) : null}
		</div>
	);
}
