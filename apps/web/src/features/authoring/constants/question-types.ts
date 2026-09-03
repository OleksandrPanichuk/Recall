import { QuestionType } from "@recall/contracts";

export const TYPE_LABELS: Readonly<Record<string, string>> = {
	[QuestionType.SingleChoice]: "Одна відповідь",
	[QuestionType.MultipleChoice]: "Кілька відповідей",
	[QuestionType.TrueFalse]: "Так або ні",
	[QuestionType.TypedAnswer]: "Ввести відповідь",
	[QuestionType.Cloze]: "Пропуск у тексті",
	[QuestionType.Ordering]: "Розставити по порядку",
	[QuestionType.Matching]: "Знайти пари",
};

export const DIFFICULTY_LABELS: Readonly<Record<string, string>> = {
	easy: "Легко",
	medium: "Середньо",
	hard: "Складно",
};

export const STATUS_LABELS: Readonly<Record<string, string>> = {
	draft: "Чернетка",
	published: "Опубліковано",
	archived: "В архіві",
};

export const ANSWER_SHAPE: Readonly<
	Record<string, "options" | "accepted" | "ordered" | "pairs">
> = {
	[QuestionType.SingleChoice]: "options",
	[QuestionType.MultipleChoice]: "options",
	[QuestionType.TrueFalse]: "options",
	[QuestionType.TypedAnswer]: "accepted",
	[QuestionType.Cloze]: "accepted",
	[QuestionType.Ordering]: "ordered",
	[QuestionType.Matching]: "pairs",
};
