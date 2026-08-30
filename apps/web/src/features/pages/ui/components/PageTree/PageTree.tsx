import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { PageTreeNode } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { movePage, reorderPage } from "@/features/pages/lib/pages.api";
import { PageRow } from "./PageRow";
import { INDENT_PX } from "./PageTree.constants";
import { announcementsFor, childrenOf, slotFor } from "./PageTree.lib";
import { descendantsOf, project, visibleNodes } from "./PageTree.projection";

interface Props {
	readonly nodes: readonly PageTreeNode[];
}

export function PageTree({ nodes }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
		() =>
			new Set(nodes.filter((node) => node.depth > 0).map((node) => node.id)),
	);
	const [activeId, setActiveId] = useState<string | undefined>(undefined);
	const [offsetLeft, setOffsetLeft] = useState(0);
	const [overId, setOverId] = useState<string | undefined>(undefined);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const visible = useMemo(
		() => visibleNodes(nodes, collapsed),
		[nodes, collapsed],
	);

	const buried = useMemo(
		() =>
			activeId === undefined
				? new Set<string>()
				: new Set(descendantsOf(visible, activeId)),
		[visible, activeId],
	);

	const rows = visible.filter((node) => !buried.has(node.id));

	const announcements = useMemo(() => announcementsFor(nodes), [nodes]);

	const projected =
		activeId === undefined || overId === undefined
			? undefined
			: project(visible, activeId, overId, offsetLeft, INDENT_PX);

	const run = async (work: () => Promise<void>) => {
		setBusy(true);

		try {
			await work();
			await router.invalidate();
		} finally {
			setBusy(false);
		}
	};

	const reorder = (node: PageTreeNode, direction: "up" | "down") => {
		const slot = slotFor(nodes, node, direction);

		if (slot === undefined) {
			return;
		}

		void run(async () => {
			await reorderPage({ data: { folderId: node.id, ...slot } });
		});
	};

	const start = (event: DragStartEvent) => {
		setActiveId(String(event.active.id));
		setOverId(String(event.active.id));
		setOffsetLeft(0);
	};

	const move = (event: DragMoveEvent) => {
		setOffsetLeft(event.delta.x);
	};

	const over = (event: DragOverEvent) => {
		setOverId(
			event.over === null ? String(event.active.id) : String(event.over.id),
		);
	};

	const end = (event: DragEndEvent) => {
		const dragged = String(event.active.id);
		const landing = projected;

		setActiveId(undefined);
		setOverId(undefined);
		setOffsetLeft(0);

		const before = nodes.find((node) => node.id === dragged);

		if (landing === undefined || before === undefined) {
			return;
		}

		const siblings = childrenOf(nodes, before.parentId);
		const wasAfter =
			siblings[siblings.findIndex((sibling) => sibling.id === dragged) - 1]?.id;
		const reparented = landing.parentId !== before.parentId;

		if (!reparented && landing.afterId === wasAfter) {
			return;
		}

		if (landing.parentId !== undefined) {
			setCollapsed((open) => {
				const next = new Set(open);

				next.delete(landing.parentId as string);

				return next;
			});
		}

		void run(async () => {
			if (reparented) {
				await movePage({
					data: { folderId: dragged, parentId: landing.parentId },
				});
			}

			if (landing.afterId !== undefined || landing.beforeId !== undefined) {
				await reorderPage({
					data: {
						folderId: dragged,
						afterId: landing.afterId,
						beforeId: landing.beforeId,
					},
				});
			}
		});
	};

	const cancel = () => {
		setActiveId(undefined);
		setOverId(undefined);
		setOffsetLeft(0);
	};

	if (nodes.length === 0) {
		return (
			<p className="px-2 py-1 text-sm text-muted-foreground">
				Сторінок ще немає.
			</p>
		);
	}

	return (
		<DndContext
			id="page-tree"
			accessibility={{ announcements }}
			collisionDetection={closestCenter}
			onDragCancel={cancel}
			onDragEnd={end}
			onDragMove={move}
			onDragOver={over}
			onDragStart={start}
			sensors={sensors}
		>
			<SortableContext
				items={rows.map((node) => node.id)}
				strategy={verticalListSortingStrategy}
			>
				<ul>
					{rows.map((node) => (
						<PageRow
							key={node.id}
							node={node}
							depth={
								node.id === activeId && projected !== undefined
									? projected.depth
									: node.depth
							}
							hasChildren={childrenOf(nodes, node.id).length > 0}
							collapsed={collapsed.has(node.id)}
							onToggle={(id) =>
								setCollapsed((open) => {
									const next = new Set(open);

									if (!next.delete(id)) {
										next.add(id);
									}

									return next;
								})
							}
							onReorder={reorder}
							canGoUp={slotFor(nodes, node, "up") !== undefined}
							canGoDown={slotFor(nodes, node, "down") !== undefined}
							busy={busy}
						/>
					))}
				</ul>
			</SortableContext>
		</DndContext>
	);
}
