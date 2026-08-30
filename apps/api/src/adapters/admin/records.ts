import type { FolderTreeNode } from "@/application/use-cases/folders/list-folder-tree";
import type { QuestionRow } from "@/application/use-cases/quiz-sets/list-questions";
import type { VocabularyItemView } from "@/application/use-cases/quiz-sets/list-vocabulary";
import type { QuizSet } from "@/domain/quiz-set/quiz-set";
import type { ListShape } from "./query";

export interface SetRecord {
	readonly id: string;
	readonly title: string;
	readonly language: string;
	readonly description: string;
	readonly source: string;
	readonly sourceChapters: string;
	readonly tags: readonly string[];
	readonly status: string;
	readonly folderId: string | null;
	readonly questionCount: number;
	readonly updatedAt: string;
}

export interface QuestionRecord {
	readonly id: string;
	readonly quizSetId: string;
	readonly setTitle: string;
	readonly setStatus: string;
	readonly position: number;
	readonly type: string;
	readonly prompt: string;
	readonly difficulty: string;
	readonly topic: string;
	readonly hint: string;
	readonly explanation: string;
	readonly options: readonly {
		readonly text: string;
		readonly isCorrect: boolean;
		readonly matchKey: string;
	}[];
	readonly vocabularyItemId: string | null;
	readonly answerCount: number;
	readonly editable: boolean;
}

export interface FolderRecord {
	readonly id: string;
	readonly name: string;
	readonly parentId: string | null;
	readonly depth: number;
	readonly setCount: number;
	readonly unpublishedCount: number;
}

export interface VocabularyRecord {
	readonly id: string;
	readonly quizSetId: string;
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription: string;
	readonly example: string;
	readonly topic: string;
	readonly questionCount: number;
}

export interface SettingsRecord {
	readonly id: string;
	readonly quizSetId: string | null;
	readonly source: string;
	readonly shuffleOptions: boolean;
	readonly shuffleQuestions: boolean;
	readonly examMode: boolean;
	readonly intervalsDays: readonly number[];
	readonly maxIntervalDays: number;
	readonly maxRepetitions: number;
}

const text = (value: string | undefined): string => value ?? "";

export const setRecordOf = (quizSet: QuizSet): SetRecord => ({
	id: String(quizSet.id),
	title: quizSet.title,
	language: quizSet.language,
	description: text(quizSet.description),
	source: text(quizSet.source),
	sourceChapters: text(quizSet.sourceChapters),
	tags: [...quizSet.tags],
	status: quizSet.status,
	folderId: quizSet.folderId === undefined ? null : String(quizSet.folderId),
	questionCount: quizSet.questions.length,
	updatedAt: quizSet.updatedAt.toISOString(),
});

export const questionRecordOf = (row: QuestionRow): QuestionRecord => ({
	id: String(row.question.id),
	quizSetId: String(row.quizSetId),
	setTitle: row.setTitle,
	setStatus: row.setStatus,
	position: row.question.position,
	type: row.question.type,
	prompt: row.question.prompt,
	difficulty: row.question.difficulty,
	topic: text(row.question.topic),
	hint: text(row.question.hint),
	explanation: text(row.question.explanation),
	options: row.question.options.map((option) => ({
		text: option.text,
		isCorrect: option.isCorrect,
		matchKey: text(option.matchKey),
	})),
	vocabularyItemId:
		row.question.vocabularyItemId === undefined
			? null
			: String(row.question.vocabularyItemId),
	answerCount: row.answerCount,
	editable: row.setStatus !== "archived",
});

export const folderRecordOf = (node: FolderTreeNode): FolderRecord => ({
	id: String(node.id),
	name: node.name,
	parentId: node.parentId === undefined ? null : String(node.parentId),
	depth: node.depth,
	setCount: node.setCount,
	unpublishedCount: node.unpublishedCount,
});

export const vocabularyRecordOf = (
	item: VocabularyItemView,
	quizSetId: string,
): VocabularyRecord => ({
	id: String(item.itemId),
	quizSetId,
	terms: [...item.terms],
	translations: [...item.translations],
	transcription: text(item.transcription),
	example: text(item.example),
	topic: text(item.topic),
	questionCount: item.questionIds.length,
});

const field = <TRecord>(row: TRecord, name: string): unknown =>
	(row as Record<string, unknown>)[name];

export const SET_SHAPE: ListShape<SetRecord> = {
	searchIn: (row) => [
		row.title,
		row.description,
		row.source,
		row.sourceChapters,
		...row.tags,
	],
	value: field,
};

export const QUESTION_SHAPE: ListShape<QuestionRecord> = {
	searchIn: (row) => [
		row.prompt,
		row.topic,
		row.hint,
		row.explanation,
		row.setTitle,
		...row.options.map((option) => option.text),
	],
	value: field,
};

export const FOLDER_SHAPE: ListShape<FolderRecord> = {
	searchIn: (row) => [row.name],
	value: field,
};

export const VOCABULARY_SHAPE: ListShape<VocabularyRecord> = {
	searchIn: (row) => [
		...row.terms,
		...row.translations,
		row.example,
		row.topic,
	],
	value: field,
};
