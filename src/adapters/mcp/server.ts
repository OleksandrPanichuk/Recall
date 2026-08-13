import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AddQuestions } from "@/application/use-cases/quiz-sets/add-questions";
import type { ArchiveQuizSet } from "@/application/use-cases/quiz-sets/archive-quiz-set";
import type { CreateQuizSet } from "@/application/use-cases/quiz-sets/create-quiz-set";
import type { GetQuizSet } from "@/application/use-cases/quiz-sets/get-quiz-set";
import type { ListQuizSets } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import type { PublishQuizSet } from "@/application/use-cases/quiz-sets/publish-quiz-set";
import type { UpdateQuizSet } from "@/application/use-cases/quiz-sets/update-quiz-set";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	describeQuizSet,
	describeSummaries,
	failure,
	ok,
	type ToolResult,
} from "./presenters/tool-result.presenter";
import {
	addQuestionsShape,
	createSetShape,
	listSetsShape,
	quizSetIdShape,
	updateSetShape,
} from "./schemas/quiz-set.schema";

export interface McpUseCases {
	readonly createQuizSet: CreateQuizSet;
	readonly updateQuizSet: UpdateQuizSet;
	readonly addQuestions: AddQuestions;
	readonly publishQuizSet: PublishQuizSet;
	readonly archiveQuizSet: ArchiveQuizSet;
	readonly getQuizSet: GetQuizSet;
	readonly listQuizSets: ListQuizSets;
}

export const MCP_SERVER_NAME = "recall-quiz";
export const MCP_SERVER_VERSION = "0.1.0";

/**
 * Tool names use underscores rather than the dots the development plan sketched:
 * MCP clients constrain names to `[A-Za-z0-9_-]`, so `quiz.create_set` would be
 * rejected at registration.
 */
const guard = async (run: () => Promise<ToolResult>): Promise<ToolResult> => {
	try {
		return await run();
	} catch (error) {
		return failure(error);
	}
};

export function createMcpServer(useCases: McpUseCases): McpServer {
	const server = new McpServer({
		name: MCP_SERVER_NAME,
		version: MCP_SERVER_VERSION,
	});

	server.registerTool(
		"quiz_create_set",
		{
			title: "Create a draft quiz set",
			description:
				"Creates an empty draft quiz set and returns its id. Add questions with quiz_add_questions, then publish with quiz_publish_set.",
			inputSchema: createSetShape,
		},
		async (args) =>
			guard(async () => {
				const { quizSetId } = await useCases.createQuizSet.execute(args);

				return ok(`Created draft quiz set ${quizSetId} — "${args.title}".`, {
					quizSetId,
				});
			}),
	);

	server.registerTool(
		"quiz_add_questions",
		{
			title: "Add questions to a draft",
			description:
				"Appends a batch of questions to a draft set. The whole batch is applied atomically. Re-sending an identical batch is a safe no-op, so a retry after an uncertain response cannot duplicate content.",
			inputSchema: addQuestionsShape,
		},
		async (args) =>
			guard(async () => {
				const result = await useCases.addQuestions.execute({
					quizSetId: toQuizSetId(args.quizSetId),
					questions: args.questions,
				});

				if (result.alreadyPresent) {
					return ok(
						`No change: all ${args.questions.length} questions are already in ${args.quizSetId}.`,
						{ quizSetId: args.quizSetId, addedQuestionIds: [] },
					);
				}

				// Leaving a finished set as a draft is the easy mistake: the tool call
				// succeeded, so nothing looks wrong, and the bot lists published sets
				// only — so the questions simply never appear.
				return ok(
					`Added ${result.addedQuestionIds.length} questions to ${args.quizSetId}. The set is still a DRAFT and will not appear in Telegram until you call quiz_publish_set.`,
					{
						quizSetId: args.quizSetId,
						addedQuestionIds: [...result.addedQuestionIds],
						status: "draft",
						nextStep: "quiz_publish_set",
					},
				);
			}),
	);

	server.registerTool(
		"quiz_update_set",
		{
			title: "Update draft metadata",
			description:
				"Changes the metadata of a draft set. Omitted fields keep their current value. Published sets cannot be edited.",
			inputSchema: updateSetShape,
		},
		async (args) =>
			guard(async () => {
				await useCases.updateQuizSet.execute({
					...args,
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(`Updated quiz set ${args.quizSetId}.`, {
					quizSetId: args.quizSetId,
				});
			}),
	);

	server.registerTool(
		"quiz_publish_set",
		{
			title: "Publish a quiz set",
			description:
				"Publishes a draft so it can be taken in Telegram. Requires at least one question. Publishing an already-published set is a no-op.",
			inputSchema: quizSetIdShape,
		},
		async (args) =>
			guard(async () => {
				await useCases.publishQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(`Published quiz set ${args.quizSetId}.`, {
					quizSetId: args.quizSetId,
				});
			}),
	);

	server.registerTool(
		"quiz_archive_set",
		{
			title: "Archive a quiz set",
			description:
				"Archives a set so it no longer appears in the Telegram menu. Existing attempt history is kept.",
			inputSchema: quizSetIdShape,
		},
		async (args) =>
			guard(async () => {
				await useCases.archiveQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(`Archived quiz set ${args.quizSetId}.`, {
					quizSetId: args.quizSetId,
				});
			}),
	);

	server.registerTool(
		"quiz_get_set",
		{
			title: "Read a quiz set",
			description:
				"Returns a set with every question and option, correct answers marked with *. Use this to review a draft before publishing.",
			inputSchema: quizSetIdShape,
		},
		async (args) =>
			guard(async () => {
				const quizSet = await useCases.getQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(describeQuizSet(quizSet), {
					quizSetId: quizSet.id,
					status: quizSet.status,
					questionCount: quizSet.questions.length,
				});
			}),
	);

	server.registerTool(
		"quiz_list_sets",
		{
			title: "List quiz sets",
			description:
				"Lists published sets, or every set including drafts and archived ones when includeUnpublished is true.",
			inputSchema: listSetsShape,
		},
		async (args) =>
			guard(async () => {
				const sets = await useCases.listQuizSets.execute(args);

				if (args.includeUnpublished === true) {
					return ok(describeSummaries(sets), { count: sets.length });
				}

				// A draft is invisible here by design, but silently invisible is how a
				// finished set gets forgotten. Say it exists without listing it.
				const all = await useCases.listQuizSets.execute({
					includeUnpublished: true,
				});
				const unpublished = all.length - sets.length;

				return ok(
					unpublished === 0
						? describeSummaries(sets)
						: `${describeSummaries(sets)}\n\n(${unpublished} unpublished set(s) not shown — call quiz_list_sets with includeUnpublished to see them.)`,
					{ count: sets.length, unpublishedCount: unpublished },
				);
			}),
	);

	return server;
}
