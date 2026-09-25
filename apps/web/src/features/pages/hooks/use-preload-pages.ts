import type { PageTreeNode } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const PRELOAD_DEPTH = 1;
const PRELOAD_GAP_MS = 120;
const ID_SEPARATOR = " ";

export function usePreloadPages(nodes: readonly PageTreeNode[]): void {
	const router = useRouter();
	const preloaded = useRef(new Set<string>());
	const wanted = nodes
		.filter((node) => node.depth <= PRELOAD_DEPTH)
		.map((node) => node.id)
		.join(ID_SEPARATOR);

	useEffect(() => {
		const ids = wanted
			.split(ID_SEPARATOR)
			.filter((id) => id.length > 0 && !preloaded.current.has(id));
		let index = 0;
		const timer = setInterval(() => {
			const id = ids[index];

			index += 1;

			if (id === undefined) {
				clearInterval(timer);

				return;
			}

			preloaded.current.add(id);
			void router.preloadRoute({
				to: "/folders/$folderId",
				params: { folderId: id },
			});
		}, PRELOAD_GAP_MS);

		return () => clearInterval(timer);
	}, [wanted, router]);
}
