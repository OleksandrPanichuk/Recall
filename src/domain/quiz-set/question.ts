import { brandedId } from "../branded-id";
import { QuestionType } from "./question.constants";
import type {
	MatchingSides,
	Question,
	QuestionId,
	QuestionOptionId,
} from "./question.types";

export {
	CLOZE_BLANK,
	Difficulty,
	isDifficulty,
	isQuestionType,
	QuestionType,
} from "./question.constants";
export type {
	ClozeQuestion,
	MatchingQuestion,
	MatchingSides,
	MultipleChoiceQuestion,
	OrderingQuestion,
	Question,
	QuestionId,
	QuestionOption,
	QuestionOptionId,
	SingleChoiceQuestion,
	TrueFalseQuestion,
	TypedAnswerQuestion,
} from "./question.types";

export const toQuestionId = (value: string): QuestionId =>
	brandedId<"QuestionId">(value, "QuestionId");

export const toQuestionOptionId = (value: string): QuestionOptionId =>
	brandedId<"QuestionOptionId">(value, "QuestionOptionId");

export function expectsTypedAnswer(question: Question): boolean {
	return (
		question.type === QuestionType.TypedAnswer ||
		question.type === QuestionType.Cloze
	);
}

// Options are stored as every left in position order, then every right. The
// matchKey pairs them; position decides which column each one belongs to.
export function matchingSides(question: Question): MatchingSides {
	const ordered = question.options.toSorted(
		(left, right) => left.position - right.position,
	);
	const half = ordered.length / 2;

	return { left: ordered.slice(0, half), right: ordered.slice(half) };
}
