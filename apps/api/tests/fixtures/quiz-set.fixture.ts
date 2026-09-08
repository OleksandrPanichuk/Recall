import {
	createQuestion,
	Difficulty,
	QuestionEntity,
	type QuestionOption,
	QuestionType,
	QuizSetEntity,
	toQuestionId,
	toQuestionOptionId,
	toQuizSetId,
} from "@/modules/quizzes";

interface OptionOverrides {
	readonly id?: string;
	readonly text?: string;
	readonly isCorrect?: boolean;
	readonly position?: number;
	readonly matchKey?: string;
}

export function anOption(overrides: OptionOverrides = {}): QuestionOption {
	const position = overrides.position ?? 0;
	const id = overrides.id ?? `option-${position}`;

	return {
		id: toQuestionOptionId(id),
		text: overrides.text ?? `Option ${id}`,
		isCorrect: overrides.isCorrect ?? position === 0,
		position,
		matchKey: overrides.matchKey,
	};
}

interface QuestionOverrides {
	readonly id?: string;
	readonly type?: QuestionType;
	readonly prompt?: string;
	readonly difficulty?: Difficulty;
	readonly position?: number;
	readonly options?: readonly QuestionOption[];
	readonly explanation?: string;
	readonly sourceReference?: string;
	readonly topic?: string;
	readonly hint?: string;
}

export function aQuestion(overrides: QuestionOverrides = {}): QuestionEntity {
	const id = overrides.id ?? "question-1";

	return createQuestion({
		id: toQuestionId(id),
		type: overrides.type ?? QuestionType.SingleChoice,
		prompt: overrides.prompt ?? `Prompt for ${id}`,
		difficulty: overrides.difficulty ?? Difficulty.Medium,
		position: overrides.position ?? 0,
		options: overrides.options ?? [
			anOption({
				id: `${id}-a`,
				text: `Correct answer for ${id}`,
				isCorrect: true,
				position: 0,
			}),
			anOption({
				id: `${id}-b`,
				text: `Wrong answer for ${id}`,
				isCorrect: false,
				position: 1,
			}),
		],
		explanation: overrides.explanation,
		sourceReference: overrides.sourceReference,
		topic: overrides.topic,
		hint: overrides.hint,
	});
}

interface QuizSetOverrides {
	readonly id?: string;
	readonly title?: string;
	readonly language?: string;
	readonly createdAt?: Date;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags?: readonly string[];
	readonly questions?: readonly QuestionEntity[];
}

export function aQuizSet(overrides: QuizSetOverrides = {}): QuizSetEntity {
	const id = overrides.id ?? "set-1";
	const createdAt = overrides.createdAt ?? new Date("2026-08-01T00:00:00.000Z");
	const draft = QuizSetEntity.create({
		id: toQuizSetId(id),
		title: overrides.title ?? `Quiz set ${id}`,
		language: overrides.language ?? "uk",
		createdAt,
		description: overrides.description,
		source: overrides.source,
		sourceChapters: overrides.sourceChapters,
		tags: overrides.tags,
	});
	const questions = overrides.questions ?? [];

	return questions.length === 0
		? draft
		: QuizSetEntity.addQuestions(draft, questions, createdAt);
}
