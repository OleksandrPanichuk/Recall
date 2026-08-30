import type { PageTreeNode } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ChevronUp, FileText } from "lucide-react";
import { useState } from "react";
import { childrenOf, slotFor } from "./PageTree.lib";

interface Props {
	readonly node: PageTreeNode;
	readonly nodes: readonly PageTreeNode[];
	readonly onReorder: (node: PageTreeNode, direction: "up" | "down") => void;
	readonly busy: boolean;
}

export function PageBranch({ node, nodes, onReorder, busy }: Props) {
	const [open, setOpen] = useState(node.depth === 0);
	const children = childrenOf(nodes, node.id);
	const canGoUp = slotFor(nodes, node, "up") !== undefined;
	const canGoDown = slotFor(nodes, node, "down") !== undefined;

	return (
		<li>
			<div
				className="group flex items-center gap-0.5 rounded-md pr-1 hover:bg-accent/60"
				style={{ paddingLeft: `${node.depth * 0.75}rem` }}
			>
				{children.length === 0 ? (
					<span className="size-5 shrink-0" />
				) : (
					<button
						type="button"
						aria-label={
							open ? `Згорнути ${node.name}` : `Розгорнути ${node.name}`
						}
						onClick={() => setOpen(!open)}
						className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
					>
						<ChevronRight
							className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
						/>
					</button>
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
			{open && children.length > 0 ? (
				<ul>
					{children.map((child) => (
						<PageBranch
							key={child.id}
							node={child}
							nodes={nodes}
							onReorder={onReorder}
							busy={busy}
						/>
					))}
				</ul>
			) : null}
		</li>
	);
}
