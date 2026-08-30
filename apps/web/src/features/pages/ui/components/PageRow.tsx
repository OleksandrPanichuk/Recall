import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PageTreeNode } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import {
	ChevronDown,
	ChevronRight,
	ChevronUp,
	FileText,
	GripVertical,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { INDENT_PX } from "./PageTree.constants";

interface Props {
	readonly node: PageTreeNode;
	readonly depth: number;
	readonly hasChildren: boolean;
	readonly collapsed: boolean;
	readonly onToggle: (id: string) => void;
	readonly onReorder: (node: PageTreeNode, direction: "up" | "down") => void;
	readonly canGoUp: boolean;
	readonly canGoDown: boolean;
	readonly busy: boolean;
	readonly ghost?: boolean;
}

export function PageRow({
	node,
	depth,
	hasChildren,
	collapsed,
	onToggle,
	onReorder,
	canGoUp,
	canGoDown,
	busy,
	ghost = false,
}: Props) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: node.id, disabled: busy });

	return (
		<li
			ref={setNodeRef}
			style={{
				transform: CSS.Translate.toString(transform),
				transition,
				paddingLeft: `${depth * INDENT_PX}px`,
			}}
			className={cn("list-none", isDragging && !ghost ? "opacity-40" : "")}
		>
			<div className="group flex items-center gap-0.5 rounded-md pr-1 hover:bg-accent/60">
				<button
					type="button"
					aria-label={`Перетягнути ${node.name}`}
					className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-default"
					disabled={busy}
					{...attributes}
					{...listeners}
				>
					<GripVertical className="size-3.5" />
				</button>
				{hasChildren ? (
					<button
						type="button"
						aria-label={
							collapsed ? `Розгорнути ${node.name}` : `Згорнути ${node.name}`
						}
						onClick={() => onToggle(node.id)}
						className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
					>
						<ChevronRight
							className={cn(
								"size-3.5 transition-transform",
								collapsed ? "" : "rotate-90",
							)}
						/>
					</button>
				) : (
					<span className="size-5 shrink-0" />
				)}
				<Link
					to="/folders/$folderId"
					params={{ folderId: node.id }}
					activeProps={{ className: "font-medium text-foreground" }}
					className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-sm text-muted-foreground"
				>
					{node.icon === undefined ? (
						<FileText className="size-3.5 shrink-0" />
					) : (
						<span className="w-3.5 shrink-0 text-center text-sm leading-none">
							{node.icon}
						</span>
					)}
					<span className="truncate">{node.name}</span>
					{node.setCount === 0 ? null : (
						<span className="shrink-0 text-xs opacity-60">{node.setCount}</span>
					)}
				</Link>
				<span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
					<button
						type="button"
						aria-label={`Підняти ${node.name}`}
						disabled={busy || !canGoUp}
						onClick={() => onReorder(node, "up")}
						className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
					>
						<ChevronUp className="size-3.5" />
					</button>
					<button
						type="button"
						aria-label={`Опустити ${node.name}`}
						disabled={busy || !canGoDown}
						onClick={() => onReorder(node, "down")}
						className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
					>
						<ChevronDown className="size-3.5" />
					</button>
				</span>
			</div>
		</li>
	);
}
