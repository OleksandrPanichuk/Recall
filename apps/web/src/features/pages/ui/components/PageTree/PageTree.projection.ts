import type { PageTreeNode } from "@recall/contracts";

export interface Projection {
	readonly depth: number;
	readonly parentId?: string;
	readonly afterId?: string;
	readonly beforeId?: string;
}

const clamp = (value: number, low: number, high: number): number =>
	Math.min(high, Math.max(low, value));

export function descendantsOf(
	nodes: readonly PageTreeNode[],
	id: string,
): readonly string[] {
	const found = new Set<string>();

	for (const node of nodes) {
		if (
			node.parentId !== undefined &&
			(node.parentId === id || found.has(node.parentId))
		) {
			found.add(node.id);
		}
	}

	return [...found];
}

export function visibleNodes(
	nodes: readonly PageTreeNode[],
	collapsed: ReadonlySet<string>,
): readonly PageTreeNode[] {
	const hidden = new Set<string>();

	return nodes.filter((node) => {
		if (node.parentId !== undefined && hidden.has(node.parentId)) {
			hidden.add(node.id);

			return false;
		}

		if (collapsed.has(node.id)) {
			hidden.add(node.id);
		}

		return true;
	});
}

const parentAtDepth = (
	list: readonly PageTreeNode[],
	upTo: number,
	depth: number,
): string | undefined => {
	if (depth === 0) {
		return undefined;
	}

	for (let index = upTo; index >= 0; index -= 1) {
		const candidate = list[index] as PageTreeNode;

		if (candidate.depth === depth - 1) {
			return candidate.id;
		}
	}

	return undefined;
};

export function project(
	nodes: readonly PageTreeNode[],
	activeId: string,
	overId: string,
	offsetLeft: number,
	indent: number,
): Projection | undefined {
	const active = nodes.find((node) => node.id === activeId);

	if (active === undefined || indent <= 0) {
		return undefined;
	}

	const buried = new Set(descendantsOf(nodes, activeId));
	const list = nodes.filter((node) => !buried.has(node.id));
	const activeIndex = list.findIndex((node) => node.id === activeId);
	const overIndex = list.findIndex((node) => node.id === overId);

	if (activeIndex === -1 || overIndex === -1) {
		return undefined;
	}

	const moved = [...list];

	moved.splice(overIndex, 0, ...moved.splice(activeIndex, 1));

	const previous = moved[overIndex - 1];
	const next = moved[overIndex + 1];
	const depth = clamp(
		active.depth + Math.round(offsetLeft / indent),
		next?.depth ?? 0,
		previous === undefined ? 0 : previous.depth + 1,
	);
	const parentId =
		previous === undefined
			? undefined
			: depth === previous.depth
				? previous.parentId
				: depth > previous.depth
					? previous.id
					: parentAtDepth(moved, overIndex - 1, depth);

	let afterId: string | undefined;
	let beforeId: string | undefined;

	for (let index = overIndex - 1; index >= 0; index -= 1) {
		if ((moved[index] as PageTreeNode).parentId === parentId) {
			afterId = (moved[index] as PageTreeNode).id;
			break;
		}
	}

	for (let index = overIndex + 1; index < moved.length; index += 1) {
		if ((moved[index] as PageTreeNode).parentId === parentId) {
			beforeId = (moved[index] as PageTreeNode).id;
			break;
		}
	}

	return { depth, parentId, afterId, beforeId };
}
