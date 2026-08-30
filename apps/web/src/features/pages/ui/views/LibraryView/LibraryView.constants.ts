import type { BrowseView } from "@recall/contracts";

export const libraryCaption = (view: BrowseView): string => {
	const folders = view.children.length;

	return `${view.sets.length} набор(ів)${folders > 0 ? `, ${folders} папк(и)` : ""}`;
};
