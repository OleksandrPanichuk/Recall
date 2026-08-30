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

export function announcementsFor(nodes: readonly PageTreeNode[]) {
	const nameOf = (id: string | number): string =>
		nodes.find((node) => node.id === String(id))?.name ?? String(id);

	return {
		onDragStart: ({ active }: { active: { id: string | number } }) =>
			`Взяли сторінку ${nameOf(active.id)}. Стрілками пересуньте її, пробілом покладіть.`,
		onDragOver: ({
			active,
			over,
		}: {
			active: { id: string | number };
			over: { id: string | number } | null;
		}) =>
			over === null || over.id === active.id
				? undefined
				: `${nameOf(active.id)} — біля сторінки ${nameOf(over.id)}.`,
		onDragEnd: ({
			active,
			over,
		}: {
			active: { id: string | number };
			over: { id: string | number } | null;
		}) =>
			over === null || over.id === active.id
				? `Сторінку ${nameOf(active.id)} залишено на місці.`
				: `Сторінку ${nameOf(active.id)} покладено біля ${nameOf(over.id)}.`,
		onDragCancel: ({ active }: { active: { id: string | number } }) =>
			`Переміщення сторінки ${nameOf(active.id)} скасовано.`,
	};
}
