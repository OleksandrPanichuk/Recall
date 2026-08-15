import { hasDuplicates } from "@/shared/utils/duplicates";
import { trimmedOrUndefined } from "@/shared/utils/text";
import {
	CLOZE_BLANK,
	type Difficulty,
	isDifficulty,
	isQuestionType,
	type Question,
	type QuestionId,
	type QuestionOption,
	QuestionType,
} from "./question";
import { QuestionValidationError } from "./quiz-set.errors";

interface QuestionDraft {
	readonly id: QuestionId;
	readonly type: QuestionType;
	readonly prompt: string;
	readonly difficulty: Difficulty;
	readonly position: number;
	readonly options: readonly QuestionOption[];
	readonly explanation?: string;
	readonly sourceReference?: string;
	readonly topic?: string;
	readonly hint?: string;
}

const normalisePosition = (value: number): number => (value === 0 ? 0 : value);

const collectUnsupportedValueIssues = (
	draft: QuestionDraft,
): readonly string[] => {
	const issues: string[] = [];

	if (!isQuestionType(draft.type)) {
		issues.push("type must be a supported question type");
	}

	if (!isDifficulty(draft.difficulty)) {
		issues.push("difficulty must be a supported difficulty");
	}

	return issues;
};

const ANSWER_ONLY_TYPES: readonly QuestionType[] = [
	QuestionType.TypedAnswer,
	QuestionType.Cloze,
	QuestionType.Ordering,
	QuestionType.Matching,
];

const collectShapeIssues = (
	draft: QuestionDraft,
	prompt: string,
	options: readonly QuestionOption[],
): readonly string[] => {
	const issues: string[] = [];
	const correctCount = options.filter((option) => option.isCorrect).length;

	if (
		ANSWER_ONLY_TYPES.includes(draft.type) &&
		correctCount !== options.length
	) {
		issues.push(`${draft.type} options must all be correct answers`);
	}

	switch (draft.type) {
		case QuestionType.TrueFalse:
			if (options.length !== 2) {
				issues.push("true_false requires exactly two options");
			}

			if (correctCount !== 1) {
				issues.push("true_false requires exactly one correct option");
			}

			break;
		case QuestionType.SingleChoice:
			if (options.length < 2) {
				issues.push("single_choice requires at least two options");
			}

			if (correctCount !== 1) {
				issues.push("single_choice requires exactly one correct option");
			}

			break;
		case QuestionType.MultipleChoice:
			if (options.length < 2) {
				issues.push("multiple_choice requires at least two options");
			}

			if (correctCount === 0) {
				issues.push("multiple_choice requires at least one correct option");
			}

			break;
		case QuestionType.TypedAnswer:
		case QuestionType.Cloze:
			if (options.length === 0) {
				issues.push(`${draft.type} requires at least one accepted answer`);
			}

			if (draft.type === QuestionType.Cloze && !prompt.includes(CLOZE_BLANK)) {
				issues.push(`cloze prompt must contain ${CLOZE_BLANK}`);
			}

			break;
		case QuestionType.Ordering:
			if (options.length < 2) {
				issues.push("ordering requires at least two items");
			}

			break;
		case QuestionType.Matching:
			issues.push(...collectMatchingIssues(options));

			break;
	}

	return issues;
};

const collectMatchingIssues = (
	options: readonly QuestionOption[],
): readonly string[] => {
	if (options.some((option) => option.matchKey === undefined)) {
		return ["matching options must each carry a matchKey"];
	}

	const sizes = new Map<string, number>();

	for (const option of options) {
		const key = option.matchKey ?? "";

		sizes.set(key, (sizes.get(key) ?? 0) + 1);
	}

	if ([...sizes.values()].some((size) => size !== 2)) {
		return ["each matchKey must appear on exactly two options"];
	}

	return sizes.size < 2 ? ["matching requires at least two pairs"] : [];
};

const collectIssues = (
	draft: QuestionDraft,
	prompt: string,
	options: readonly QuestionOption[],
): readonly string[] => {
	const issues: string[] = [];

	if (prompt.length === 0) {
		issues.push("prompt must not be empty");
	}

	if (!Number.isSafeInteger(draft.position) || draft.position < 0) {
		issues.push("position must be a non-negative integer");
	}

	if (options.some((option) => option.text.length === 0)) {
		issues.push("option text must not be empty");
	}

	const positions = options
		.map((option) => option.position)
		.toSorted((left, right) => left - right);

	if (!positions.every((position, index) => position === index)) {
		issues.push("option positions must be unique and start at 0");
	}

	if (hasDuplicates(options.map((option) => option.id))) {
		issues.push("option ids must be unique");
	}

	issues.push(...collectShapeIssues(draft, prompt, options));

	return issues;
};

export function createQuestion(draft: QuestionDraft): Question {
	const unsupportedValueIssues = collectUnsupportedValueIssues(draft);

	if (unsupportedValueIssues.length > 0) {
		throw new QuestionValidationError(unsupportedValueIssues);
	}

	const prompt = draft.prompt.trim();
	const options = draft.options.map((option) =>
		Object.freeze({
			...option,
			text: option.text.trim(),
			position: normalisePosition(option.position),
		}),
	);
	const issues = collectIssues(draft, prompt, options);

	if (issues.length > 0) {
		throw new QuestionValidationError(issues);
	}

	const fields = {
		id: draft.id,
		prompt,
		options: Object.freeze(options),
		difficulty: draft.difficulty,
		position: normalisePosition(draft.position),
		explanation: trimmedOrUndefined(draft.explanation),
		sourceReference: trimmedOrUndefined(draft.sourceReference),
		topic: trimmedOrUndefined(draft.topic),
		hint: trimmedOrUndefined(draft.hint),
	};

	switch (draft.type) {
		case QuestionType.SingleChoice:
			return Object.freeze({ ...fields, type: QuestionType.SingleChoice });
		case QuestionType.MultipleChoice:
			return Object.freeze({ ...fields, type: QuestionType.MultipleChoice });
		case QuestionType.TypedAnswer:
			return Object.freeze({ ...fields, type: QuestionType.TypedAnswer });
		case QuestionType.Cloze:
			return Object.freeze({ ...fields, type: QuestionType.Cloze });
		case QuestionType.Ordering:
			return Object.freeze({ ...fields, type: QuestionType.Ordering });
		case QuestionType.Matching:
			return Object.freeze({ ...fields, type: QuestionType.Matching });
		case QuestionType.TrueFalse:
			return Object.freeze({ ...fields, type: QuestionType.TrueFalse });
		default:
			throw new QuestionValidationError([
				"type must be a supported question type",
			]);
	}
}
