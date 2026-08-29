import { HttpStatus } from "@nestjs/common";

const byName: Readonly<Record<string, HttpStatus>> = {
	QuizSetNotFoundError: HttpStatus.NOT_FOUND,
	QuestionNotFoundError: HttpStatus.NOT_FOUND,
	FolderNotFoundError: HttpStatus.NOT_FOUND,
	FolderPathNotFoundError: HttpStatus.NOT_FOUND,
	AttemptNotFoundError: HttpStatus.NOT_FOUND,
	VocabularyItemNotFoundError: HttpStatus.NOT_FOUND,
	NoActiveAttemptError: HttpStatus.NOT_FOUND,
	QuizSetTransitionError: HttpStatus.CONFLICT,
	AttemptAlreadyInProgressError: HttpStatus.CONFLICT,
	AttemptAlreadyFinishedError: HttpStatus.CONFLICT,
	AttemptNotActiveError: HttpStatus.CONFLICT,
	QuestionNotInAttemptError: HttpStatus.CONFLICT,
	FolderNotEmptyError: HttpStatus.CONFLICT,
	AnsweredQuestionError: HttpStatus.CONFLICT,
	QuizSetNotPublishedError: HttpStatus.CONFLICT,
	QuizSetValidationError: HttpStatus.BAD_REQUEST,
	QuestionValidationError: HttpStatus.BAD_REQUEST,
	QuizAttemptValidationError: HttpStatus.BAD_REQUEST,
	VocabularyItemValidationError: HttpStatus.BAD_REQUEST,
	RepetitionSettingsValidationError: HttpStatus.BAD_REQUEST,
	FolderValidationError: HttpStatus.BAD_REQUEST,
	EmptyQuestionBatchError: HttpStatus.BAD_REQUEST,
	QuestionBatchTooLargeError: HttpStatus.BAD_REQUEST,
	NothingDueError: HttpStatus.BAD_REQUEST,
	NothingToPracticeError: HttpStatus.BAD_REQUEST,
	EmptyQuizSetError: HttpStatus.BAD_REQUEST,
};

export function statusOf(error: Error): HttpStatus | undefined {
	return byName[error.name];
}

const DETAIL_KEYS = [
	"mode",
	"folderId",
	"quizSetId",
	"questionId",
	"attemptId",
] as const;

export function detailsOf(
	error: Error,
): Readonly<Record<string, string>> | undefined {
	const carrier = error as unknown as Record<string, unknown>;
	const entries = DETAIL_KEYS.flatMap((key) => {
		const value = carrier[key];

		return value === undefined || value === null
			? []
			: [[key, String(value)] as const];
	});

	return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
