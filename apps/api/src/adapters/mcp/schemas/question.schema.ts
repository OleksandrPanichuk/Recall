import {
	AUTHORABLE_TYPES,
	MAX_OPTIONS_PER_QUESTION,
	questionDraftOptionSchema,
	questionDraftSchema,
} from "@recall/contracts";

export { AUTHORABLE_TYPES, MAX_OPTIONS_PER_QUESTION };
export const questionOptionSchema = questionDraftOptionSchema;
export const questionSchema = questionDraftSchema;
export type QuestionSchemaInput = typeof questionDraftSchema._output;
