import { createRouter } from "@tanstack/react-router";
import { ErrorPanel } from "@/shared/ui/components/ErrorPanel";
import { NotFound } from "@/shared/ui/components/NotFound";
import { RoutePending } from "@/shared/ui/components/RoutePending";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	return createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 30_000,
		defaultPendingComponent: RoutePending,
		defaultPendingMs: 150,
		defaultPendingMinMs: 300,
		defaultErrorComponent: ErrorPanel,
		defaultNotFoundComponent: NotFound,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
