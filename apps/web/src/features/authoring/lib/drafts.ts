import {
	CLOZE_BLANK,
	type Question,
	type QuestionDraft,
	QuestionType,
} from "@recall/contracts";
import { ANSWER_SHAPE } from "../constants/question-types";

export interface DraftForm {
	readonly type: QuestionDraft["type"];
	readonly prompt: string;
	readonly difficulty: QuestionDraft["difficulty"];
	readonly answers: readonly string[];
	readonly correct: readonly number[];
	readonly rights: readonly string[];
	readonly explanation: string;
	readonly hint: string;
}

export const emptyForm = (): DraftForm => ({
	type: QuestionType.SingleChoice,
	prompt: "",
	difficulty: "easy",
	answers: ["", ""],
	correct: [],
	rights: ["", ""],
	explanation: "",
	hint: "",
});

const filled = (values: readonly string[]): readonly string[] =>
	values.map((value) => value.trim()).filter((value) => value.length > 0);

const optional = (value: string): string | undefined => {
	const trimmed = value.trim();

	return trimmed.length === 0 ? undefined : trimmed;
};

export function problemsWith(form: DraftForm): readonly string[] {
	const problems: string[] = [];
	const answers = filled(form.answers);
	const shape = ANSWER_SHAPE[form.type];

	if (form.prompt.trim().length === 0) {
		problems.push("Питання не може бути порожнім");
	}

	if (form.type === QuestionType.Cloze && !form.prompt.includes(CLOZE_BLANK)) {
		problems.push(`Пропуск позначається як ${CLOZE_BLANK}`);
	}

	if (shape === "pairs") {
		const rights = filled(form.rights);

		if (answers.length < 2 || rights.length !== answers.length) {
			problems.push("Потрібно щонайменше дві повні пари");
		}
	} else if (shape === "accepted") {
		if (answers.length === 0) {
			problems.push("Потрібна щонайменше одна прийнятна відповідь");
		}
	} else if (answers.length < 2) {
		problems.push("Потрібно щонайменше два варіанти");
	}

	if (
		shape === "options" &&
		!form.correct.some((index) => (form.answers[index] ?? "").trim().length > 0)
	) {
		problems.push("Позначте правильну відповідь");
	}

	return problems;
}

export function toDraft(form: DraftForm): QuestionDraft {
	const answers = filled(form.answers);
	const base = {
		type: form.type,
		prompt: form.prompt.trim(),
		difficulty: form.difficulty,
		explanation: optional(form.explanation),
		hint: optional(form.hint),
	};

	switch (ANSWER_SHAPE[form.type]) {
		case "accepted":
			return { ...base, acceptedAnswers: answers } as QuestionDraft;
		case "ordered":
			return { ...base, orderedItems: answers } as QuestionDraft;
		case "pairs":
			return {
				...base,
				pairs: answers.map((left, index) => ({
					left,
					right: (form.rights[index] ?? "").trim(),
				})),
			} as QuestionDraft;
		default:
			return {
				...base,
				options: form.answers
					.map((text, index) => ({
						text: text.trim(),
						isCorrect: form.correct.includes(index),
					}))
					.filter((option) => option.text.length > 0),
			} as QuestionDraft;
	}
}

export function formFor(question: Question): DraftForm {
	const ordered = [...question.options].sort(
		(left, right) => left.position - right.position,
	);
	const base = {
		type: question.type,
		prompt: question.prompt,
		difficulty: question.difficulty,
		explanation: question.explanation ?? "",
		hint: question.hint ?? "",
	};

	if (ANSWER_SHAPE[question.type] === "pairs") {
		const sides = new Map<string, string[]>();

		for (const option of ordered) {
			const key = option.matchKey ?? option.id;

			sides.set(key, [...(sides.get(key) ?? []), option.text]);
		}

		const pairs = [...sides.values()];

		return {
			...base,
			answers: pairs.map((side) => side[0] ?? ""),
			rights: pairs.map((side) => side[1] ?? ""),
			correct: [],
		};
	}

	return {
		...base,
		answers: ordered.map((option) => option.text),
		rights: ordered.map(() => ""),
		correct: ordered
			.map((option, index) => (option.isCorrect ? index : -1))
			.filter((index) => index >= 0),
	};
}

export function changesFrom(form: DraftForm): Record<string, unknown> {
	const draft = toDraft(form) as Record<string, unknown>;
	const { type: _type, ...rest } = draft;

	return {
		...rest,
		explanation: draft.explanation ?? "",
		hint: draft.hint ?? "",
	};
}
