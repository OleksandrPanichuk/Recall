import type { CurrentQuestionView, Question } from "@recall/contracts";
import { expectsTypedAnswer, QuestionType } from "@recall/contracts";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ChoiceOptions } from "@/features/practice/ui/components/ChoiceOptions";
import { MatchingOptions } from "@/features/practice/ui/components/MatchingOptions";
import { OrderingOptions } from "@/features/practice/ui/components/OrderingOptions";
import { TypedAnswerField } from "@/features/practice/ui/components/TypedAnswerField";

interface Props {
	readonly view: CurrentQuestionView;
	readonly question: Question;
	readonly disabled: boolean;
	onAnswer(answer: {
		readonly selectedOptionPositions?: readonly number[];
		readonly typedAnswer?: string;
	}): void;
}

const hint: Readonly<Record<string, string>> = {
	[QuestionType.MultipleChoice]: "Оберіть усі правильні варіанти",
	[QuestionType.Ordering]: "Клікайте в правильному порядку",
	[QuestionType.Matching]: "Складіть пари: спершу зліва, потім справа",
	[QuestionType.TypedAnswer]: "Напишіть відповідь",
	[QuestionType.Cloze]: "Заповніть пропуск",
};

export function QuestionCard({ view, question, disabled, onAnswer }: Props) {
	return (
		<div className="space-y-5">
			<div className="space-y-3">
				<div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
					<span className="truncate">{view.quizSetTitle}</span>
					<span className="shrink-0 tabular-nums">
						{view.index + 1} / {view.total}
					</span>
				</div>
				<Progress value={((view.index + 1) / Math.max(view.total, 1)) * 100} />
			</div>

			<div className="space-y-2">
				<h1 className="text-xl font-semibold leading-snug tracking-tight">
					{question.prompt}
				</h1>
				<div className="flex flex-wrap items-center gap-2">
					{question.topic === undefined ? null : (
						<Badge variant="outline">{question.topic}</Badge>
					)}
					{hint[question.type] === undefined ? null : (
						<span className="text-xs text-muted-foreground">
							{hint[question.type]}
						</span>
					)}
				</div>
			</div>

			<Answering
				key={question.id}
				question={question}
				disabled={disabled}
				shuffleSeed={
					view.shuffleOptions ? `${view.attemptId}:${question.id}` : undefined
				}
				onAnswer={onAnswer}
			/>
		</div>
	);
}

function Answering({
	question,
	disabled,
	shuffleSeed,
	onAnswer,
}: Omit<Props, "view"> & { readonly shuffleSeed?: string }) {
	if (expectsTypedAnswer(question)) {
		return (
			<TypedAnswerField
				disabled={disabled}
				onAnswer={(typedAnswer) => onAnswer({ typedAnswer })}
			/>
		);
	}

	if (question.type === QuestionType.Ordering) {
		return (
			<OrderingOptions
				question={question}
				disabled={disabled}
				onAnswer={(selectedOptionPositions) =>
					onAnswer({ selectedOptionPositions })
				}
			/>
		);
	}

	if (question.type === QuestionType.Matching) {
		return (
			<MatchingOptions
				question={question}
				disabled={disabled}
				onAnswer={(selectedOptionPositions) =>
					onAnswer({ selectedOptionPositions })
				}
			/>
		);
	}

	return (
		<ChoiceOptions
			question={question}
			disabled={disabled}
			shuffleSeed={shuffleSeed}
			onAnswer={(selectedOptionPositions) =>
				onAnswer({ selectedOptionPositions })
			}
		/>
	);
}
