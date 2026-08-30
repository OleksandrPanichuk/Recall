import type { PageTreeNode } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { reorderPage } from "@/features/pages/lib/pages.api";
import { PageBranch } from "./PageBranch";
import { childrenOf, slotFor } from "./PageTree.lib";

interface Props {
	readonly nodes: readonly PageTreeNode[];
}

export function PageTree({ nodes }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	const reorder = async (node: PageTreeNode, direction: "up" | "down") => {
		const slot = slotFor(nodes, node, direction);

		if (slot === undefined) {
			return;
		}

		setBusy(true);

		try {
			await reorderPage({ data: { folderId: node.id, ...slot } });
			await router.invalidate();
		} finally {
			setBusy(false);
		}
	};

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
				<PageBranch
					key={node.id}
					node={node}
					nodes={nodes}
					onReorder={reorder}
					busy={busy}
				/>
			))}
		</ul>
	);
}
