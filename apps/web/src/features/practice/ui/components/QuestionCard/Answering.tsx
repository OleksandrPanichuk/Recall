import type { Question } from "@recall/contracts";
import { expectsTypedAnswer, QuestionType } from "@recall/contracts";
import { ChoiceOptions } from "@/features/practice/ui/components/ChoiceOptions";
import { MatchingOptions } from "@/features/practice/ui/components/MatchingOptions";
import { OrderingOptions } from "@/features/practice/ui/components/OrderingOptions";
import { TypedAnswerField } from "@/features/practice/ui/components/TypedAnswerField";
import type { QuestionAnswer } from "./QuestionCard.types";

interface Props {
	readonly question: Question;
	readonly disabled: boolean;
	readonly shuffleSeed?: string;
	onAnswer(answer: QuestionAnswer): void;
}

export function Answering({
	question,
	disabled,
	shuffleSeed,
	onAnswer,
}: Props) {
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
