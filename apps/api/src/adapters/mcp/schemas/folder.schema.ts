import { z } from "zod";
import { MAX_FOLDER_NAME, MAX_SUMMARY_LENGTH } from "@/domain/folder/folder";

const folderName = z.string().trim().min(1).max(MAX_FOLDER_NAME);

export const folderPathInput = z.array(folderName).min(1).max(20);

const folderPath = folderPathInput;

export const folderPathShape = { path: folderPath };

export const renameFolderShape = {
	path: folderPath,
	name: folderName,
};

export const moveSetShape = {
	quizSetId: z.string().trim().min(1).max(64),
	folderPath: folderPath.optional(),
};

export const writeSummaryShape = {
	path: folderPath,
	summary: z.string().max(MAX_SUMMARY_LENGTH),
};

export const readSummaryShape = { path: folderPath };

export const attachSetShape = {
	path: folderPath,
	quizSetId: z.string().trim().min(1).max(64),
};

export const listFoldersShape = {};
