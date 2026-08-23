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
	AttemptNotActiveError: HttpStatus.CONFLICT,
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
