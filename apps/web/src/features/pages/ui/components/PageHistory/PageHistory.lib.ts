import type { PageRevision } from "@recall/contracts";
import { AUTHOR_LABELS } from "./PageHistory.constants";

export const writtenBy = (authorKind: string): string =>
	AUTHOR_LABELS[authorKind] ?? authorKind;

export const sizeOf = (summary: string | undefined): string =>
	`${(summary ?? "").length} символів`;

export const excerptOf = (summary: string | undefined, limit = 140): string => {
	const text = (summary ?? "").replace(/\s+/g, " ").trim();

	if (text.length === 0) {
		return "порожня";
	}

	return text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`;
};

export const writtenAt = (createdAt: string): string => {
	const at = new Date(createdAt);

	return Number.isNaN(at.getTime())
		? createdAt
		: at.toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" });
};

export const changedSince = (
	revision: PageRevision,
	current: string,
): boolean => (revision.summary ?? "") !== current;
