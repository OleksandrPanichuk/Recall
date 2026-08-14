import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeleteFolder } from "@/application/use-cases/folders/delete-folder";
import type { EnsureFolderPath } from "@/application/use-cases/folders/ensure-folder-path";
import type { ListFolderTree } from "@/application/use-cases/folders/list-folder-tree";
import type { RenameFolder } from "@/application/use-cases/folders/rename-folder";
import type { ResolveFolderPath } from "@/application/use-cases/folders/resolve-folder-path";
import type { AddQuestions } from "@/application/use-cases/quiz-sets/add-questions";
import type { ArchiveQuizSet } from "@/application/use-cases/quiz-sets/archive-quiz-set";
import type { CreateQuizSet } from "@/application/use-cases/quiz-sets/create-quiz-set";
import type { GetQuizSet } from "@/application/use-cases/quiz-sets/get-quiz-set";
import type { ListQuizSets } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import type { MoveQuizSet } from "@/application/use-cases/quiz-sets/move-quiz-set";
import type { PublishQuizSet } from "@/application/use-cases/quiz-sets/publish-quiz-set";
import type { UpdateQuizSet } from "@/application/use-cases/quiz-sets/update-quiz-set";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	describeFolderTree,
	describeQuizSet,
	describeSummaries,
	failure,
	ok,
	type ToolResult,
} from "./presenters/tool-result.presenter";
import {
	folderPathShape,
	listFoldersShape,
	moveSetShape,
	renameFolderShape,
} from "./schemas/folder.schema";
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
	readonly moveQuizSet: MoveQuizSet;
	readonly ensureFolderPath: EnsureFolderPath;
	readonly resolveFolderPath: ResolveFolderPath;
	readonly renameFolder: RenameFolder;
	readonly deleteFolder: DeleteFolder;
	readonly listFolderTree: ListFolderTree;
}

export const MCP_SERVER_NAME = "recall-quiz";
export const MCP_SERVER_VERSION = "0.1.0";

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
				const { folderPath, ...metadata } = args;
				const folder =
					folderPath === undefined
						? undefined
						: await useCases.ensureFolderPath.execute({ path: folderPath });
				const { quizSetId } = await useCases.createQuizSet.execute({
					...metadata,
					folderId: folder?.folderId,
				});

				return ok(
					folderPath === undefined
						? `Created draft quiz set ${quizSetId} — "${args.title}".`
						: `Created draft quiz set ${quizSetId} — "${args.title}" in ${folderPath.join(" / ")}.`,
					{ quizSetId, folderId: folder?.folderId },
				);
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

	registerFolderTools(server, useCases);

	return server;
}

function registerFolderTools(server: McpServer, useCases: McpUseCases): void {
	server.registerTool(
		"quiz_list_folders",
		{
			title: "List the folder tree",
			description:
				"Renders the whole folder tree, indented by depth, with the number of published sets filed directly in each folder. Counts are not recursive.",
			inputSchema: listFoldersShape,
		},
		async () =>
			guard(async () => {
				const nodes = await useCases.listFolderTree.execute({});

				return ok(describeFolderTree(nodes), {
					folders: nodes.map((node) => ({
						id: node.id,
						name: node.name,
						parentId: node.parentId,
						setCount: node.setCount,
						unpublishedCount: node.unpublishedCount,
					})),
					count: nodes.length,
				});
			}),
	);

	server.registerTool(
		"quiz_ensure_folder_path",
		{
			title: "Create a folder path",
			description:
				'Creates every missing folder along a path such as ["English","Vocabulary","By levels","A1"] and returns the id of the last one. Existing folders are reused, matching names case-insensitively, so calling this twice is safe.',
			inputSchema: folderPathShape,
		},
		async (args) =>
			guard(async () => {
				const result = await useCases.ensureFolderPath.execute(args);

				return ok(
					result.created.length === 0
						? `${args.path.join(" / ")} already exists.`
						: `${args.path.join(" / ")} is ready. Created: ${result.created.join(", ")}.`,
					{ folderId: result.folderId, created: [...result.created] },
				);
			}),
	);

	server.registerTool(
		"quiz_move_set",
		{
			title: "File a quiz set",
			description:
				"Files a set into a folder path, creating the path if it does not exist. Omit folderPath to return the set to the root. Works on published sets — filing is not content.",
			inputSchema: moveSetShape,
		},
		async (args) =>
			guard(async () => {
				await useCases.getQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				const folder =
					args.folderPath === undefined
						? undefined
						: await useCases.ensureFolderPath.execute({
								path: args.folderPath,
							});

				await useCases.moveQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
					folderId: folder?.folderId,
				});

				return ok(
					args.folderPath === undefined
						? `Moved ${args.quizSetId} back to the root.`
						: `Moved ${args.quizSetId} into ${args.folderPath.join(" / ")}.`,
					{ quizSetId: args.quizSetId, folderId: folder?.folderId },
				);
			}),
	);

	server.registerTool(
		"quiz_rename_folder",
		{
			title: "Rename a folder",
			description:
				"Renames the folder at the given path. The sets and subfolders inside it are untouched.",
			inputSchema: renameFolderShape,
		},
		async (args) =>
			guard(async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});

				await useCases.renameFolder.execute({ folderId, name: args.name });

				return ok(`Renamed ${args.path.join(" / ")} to "${args.name}".`, {
					folderId,
					name: args.name,
				});
			}),
	);

	server.registerTool(
		"quiz_delete_folder",
		{
			title: "Delete an empty folder",
			description:
				"Deletes the folder at the given path. Refuses while it still holds subfolders or sets, so no quiz set is ever destroyed by a folder operation.",
			inputSchema: folderPathShape,
		},
		async (args) =>
			guard(async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});

				await useCases.deleteFolder.execute({ folderId });

				return ok(`Deleted ${args.path.join(" / ")}.`, { folderId });
			}),
	);
}
