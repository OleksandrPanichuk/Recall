import type { PageTreeNode } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

const PRELOAD_DEPTH = 1;
const PRELOAD_GAP_MS = 120;

export function usePreloadPages(nodes: readonly PageTreeNode[]): void {
	const router = useRouter();

	useEffect(() => {
		const wanted = nodes.filter((node) => node.depth <= PRELOAD_DEPTH);
		let index = 0;
		const timer = setInterval(() => {
			const node = wanted[index];

			index += 1;

			if (node === undefined) {
				clearInterval(timer);

				return;
			}

			void router.preloadRoute({
				to: "/folders/$folderId",
				params: { folderId: node.id },
			});
		}, PRELOAD_GAP_MS);

		return () => clearInterval(timer);
	}, [nodes, router]);
}
