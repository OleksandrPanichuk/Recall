import { hasDuplicates } from "@/shared/duplicates";
import { trimmedOrUndefined } from "@/shared/text";
import {
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

	if (draft.type !== QuestionType.TrueFalse && options.length < 2) {
		issues.push(`${draft.type} requires at least two options`);
	}

	if (draft.type === QuestionType.TrueFalse && options.length !== 2) {
		issues.push("true_false requires exactly two options");
	}

	const correctCount = options.filter((option) => option.isCorrect).length;

	if (draft.type !== QuestionType.MultipleChoice && correctCount !== 1) {
		issues.push(`${draft.type} requires exactly one correct option`);
	}

	if (draft.type === QuestionType.MultipleChoice && correctCount === 0) {
		issues.push("multiple_choice requires at least one correct option");
	}

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
		case QuestionType.TrueFalse:
			return Object.freeze({ ...fields, type: QuestionType.TrueFalse });
		default:
			throw new QuestionValidationError([
				"type must be a supported question type",
			]);
	}
}
