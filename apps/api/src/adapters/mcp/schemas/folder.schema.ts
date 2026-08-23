import { z } from "zod";
import { MAX_FOLDER_NAME } from "@/domain/folder/folder";

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

export const listFoldersShape = {};
