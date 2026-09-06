import type { PageTreeNode } from "@recall/contracts";

export interface PageChoice {
	readonly id: string | undefined;
	readonly name: string;
	readonly depth: number;
}

export function pageChoices(
	pages: readonly PageTreeNode[],
	folderId: string | undefined,
): readonly PageChoice[] {
	const library: readonly PageChoice[] =
		folderId === undefined
			? []
			: [{ id: undefined, name: "Outside any page", depth: 0 }];

	return [
		...library,
		...pages
			.filter((node) => node.id !== folderId)
			.map((node) => ({
				id: node.id,
				name: node.name,
				depth: node.depth + (folderId === undefined ? 0 : 1),
			})),
	];
}
