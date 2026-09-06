import type { BrowseView } from "@recall/contracts";
import { pages, quizzes } from "@/shared/lib/plural";

export const libraryCaption = (view: BrowseView): string => {
	const sets = view.sets.length + view.attached.length;
	const folders = view.children.length;

	if (sets === 0 && folders === 0) {
		return "Nothing here yet";
	}

	return [sets > 0 ? quizzes(sets) : "", folders > 0 ? pages(folders) : ""]
		.filter((part) => part.length > 0)
		.join(", ");
};
