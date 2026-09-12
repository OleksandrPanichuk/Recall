import { z } from "zod";
import { PageEntity } from "@/modules/pages";

const folderName = z.string().trim().min(1).max(PageEntity.MAX_NAME);

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
	summary: z.string().max(PageEntity.MAX_SUMMARY),
};

export const readSummaryShape = { path: folderPath };

export const appendSummaryShape = {
	path: folderPath,
	summary: z.string().min(1).max(PageEntity.MAX_SUMMARY),
};

export const summaryHistoryShape = {
	path: folderPath,
	limit: z.number().int().min(1).max(50).optional(),
};

export const attachSetShape = {
	path: folderPath,
	quizSetId: z.string().trim().min(1).max(64),
};

export const setPageIconShape = {
	path: folderPath,
	icon: z.string().trim().max(PageEntity.MAX_ICON).optional(),
};

export const searchPagesShape = {
	query: z.string().trim().min(1).max(200),
	limit: z.number().int().min(1).max(50).optional(),
};

export const listFoldersShape = {};
