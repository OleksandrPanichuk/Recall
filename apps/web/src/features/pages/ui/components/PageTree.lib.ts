import type { PageTreeNode } from "@recall/contracts";

export const childrenOf = (
	nodes: readonly PageTreeNode[],
	parentId: string | undefined,
): readonly PageTreeNode[] =>
	nodes.filter((node) => node.parentId === parentId);
