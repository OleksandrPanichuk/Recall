import type { PageTreeNode } from "@recall/contracts";

export const childrenOf = (
	nodes: readonly PageTreeNode[],
	parentId: string | undefined,
): readonly PageTreeNode[] =>
	nodes.filter((node) => node.parentId === parentId);

export interface SiblingSlot {
	readonly afterId?: string;
	readonly beforeId?: string;
}

export function slotFor(
	nodes: readonly PageTreeNode[],
	node: PageTreeNode,
	direction: "up" | "down",
): SiblingSlot | undefined {
	const siblings = childrenOf(nodes, node.parentId);
	const index = siblings.findIndex((sibling) => sibling.id === node.id);

	if (index === -1) {
		return undefined;
	}

	if (direction === "up") {
		return index === 0
			? undefined
			: {
					afterId: siblings[index - 2]?.id,
					beforeId: siblings[index - 1]?.id,
				};
	}

	return index === siblings.length - 1
		? undefined
		: {
				afterId: siblings[index + 1]?.id,
				beforeId: siblings[index + 2]?.id,
			};
}
