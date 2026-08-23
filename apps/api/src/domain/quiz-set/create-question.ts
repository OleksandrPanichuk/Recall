import { trimmedOrUndefined } from "@/shared/utils/text";
import type { QuestionDraft } from "./create-question.types";
import {
	collectQuestionIssues,
	collectQuestionValueIssues,
} from "./create-question.validation";
import { type Question, QuestionType } from "./question";
import { QuestionValidationError } from "./quiz-set.errors";

const normalisePosition = (value: number): number => (value === 0 ? 0 : value);

export function createQuestion(draft: QuestionDraft): Question {
	const unsupportedValueIssues = collectQuestionValueIssues(draft);

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
	const issues = collectQuestionIssues(draft, prompt, options);

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
		vocabularyItemId: draft.vocabularyItemId,
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
