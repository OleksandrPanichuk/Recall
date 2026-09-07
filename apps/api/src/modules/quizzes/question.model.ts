import type {
	Question as WireQuestion,
	QuestionRow as WireQuestionRow,
} from "@recall/contracts";
import type { QuestionEntity } from "./question.entity";
import type { QuestionRow } from "./use-cases";

const text = (value: string | undefined): string | undefined =>
	value === undefined ? undefined : value;

export const questionToWire = (question: QuestionEntity): WireQuestion => ({
	id: String(question.id),
	type: question.type,
	prompt: question.prompt,
	options: question.options.map((option) => ({
		id: String(option.id),
		text: option.text,
		isCorrect: option.isCorrect,
		position: option.position,
		matchKey: text(option.matchKey),
	})),
	difficulty: question.difficulty,
	position: question.position,
	explanation: text(question.explanation),
	sourceReference: text(question.sourceReference),
	topic: text(question.topic),
	hint: text(question.hint),
	vocabularyItemId: text(question.vocabularyItemId),
});

export const questionRowToWire = (row: QuestionRow): WireQuestionRow => ({
	question: questionToWire(row.question),
	quizSetId: String(row.quizSetId),
	setTitle: row.setTitle,
	setStatus: row.setStatus,
	answerCount: row.answerCount,
});
