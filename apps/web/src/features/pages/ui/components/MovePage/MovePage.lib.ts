import type { PageTreeNode } from "@recall/contracts";

export interface Destination {
	readonly id: string | undefined;
	readonly name: string;
	readonly depth: number;
}

const descendantsOf = (
	pages: readonly PageTreeNode[],
	rootId: string,
): ReadonlySet<string> => {
	const inside = new Set([rootId]);
	let grew = true;

	while (grew) {
		grew = false;

		for (const node of pages) {
			if (
				node.parentId !== undefined &&
				inside.has(node.parentId) &&
				!inside.has(node.id)
			) {
				inside.add(node.id);
				grew = true;
			}
		}
	}

	return inside;
};

export function destinationsFor(
	pages: readonly PageTreeNode[],
	folderId: string,
	parentId: string | undefined,
): readonly Destination[] {
	const forbidden = descendantsOf(pages, folderId);
	const root: readonly Destination[] =
		parentId === undefined
			? []
			: [{ id: undefined, name: "Бібліотека", depth: 0 }];

	return [
		...root,
		...pages
			.filter((node) => !forbidden.has(node.id) && node.id !== parentId)
			.map((node) => ({
				id: node.id,
				name: node.name,
				depth: node.depth + (parentId === undefined ? 0 : 1),
			})),
	];
}
