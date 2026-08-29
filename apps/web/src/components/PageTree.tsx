import type { PageTreeNode } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileText } from "lucide-react";
import { useState } from "react";

export interface PageTreeProps {
	readonly nodes: readonly PageTreeNode[];
}

const childrenOf = (
	nodes: readonly PageTreeNode[],
	parentId: string | undefined,
): readonly PageTreeNode[] =>
	nodes.filter((node) => node.parentId === parentId);

function Branch({
	node,
	nodes,
}: {
	readonly node: PageTreeNode;
	readonly nodes: readonly PageTreeNode[];
}) {
	const [open, setOpen] = useState(node.depth === 0);
	const children = childrenOf(nodes, node.id);

	return (
		<li>
			<div
				className="flex items-center gap-0.5 rounded-md pr-1 hover:bg-accent/60"
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
					<FileText className="size-3.5 shrink-0" />
					<span className="truncate">{node.name}</span>
					{node.setCount === 0 ? null : (
						<span className="shrink-0 text-xs opacity-60">{node.setCount}</span>
					)}
				</Link>
			</div>
			{open && children.length > 0 ? (
				<ul>
					{children.map((child) => (
						<Branch key={child.id} node={child} nodes={nodes} />
					))}
				</ul>
			) : null}
		</li>
	);
}

export function PageTree({ nodes }: PageTreeProps) {
	if (nodes.length === 0) {
		return (
			<p className="px-2 py-1 text-sm text-muted-foreground">
				Сторінок ще немає.
			</p>
		);
	}

	return (
		<ul>
			{childrenOf(nodes, undefined).map((node) => (
				<Branch key={node.id} node={node} nodes={nodes} />
			))}
		</ul>
	);
}
