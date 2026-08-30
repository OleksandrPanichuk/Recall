/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePreloadPages } from "@/features/pages/hooks/use-preload-pages";
import { useWarmEditor } from "@/features/pages/hooks/use-warm-editor";
import { loadPageTree } from "@/features/pages/lib/pages.api";
import { PageTree } from "@/features/pages/ui/components/PageTree";
import { loadSession } from "@/shared/lib/viewer";
import { AppShell } from "@/shared/ui/components/AppShell";
import { ErrorPanel } from "@/shared/ui/components/ErrorPanel";
import { NotFound } from "@/shared/ui/components/NotFound";
import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Recall" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
		],
	}),
	beforeLoad: async () => loadSession(),
	loader: async ({ context }) =>
		context.viewer === null ? { nodes: [] } : loadPageTree(),
	component: RootComponent,
	errorComponent: ErrorPanel,
	notFoundComponent: NotFound,
});

function RootComponent() {
	const { viewer } = Route.useRouteContext();
	const { nodes } = Route.useLoaderData();

	usePreloadPages(nodes);
	useWarmEditor();

	return (
		<Document>
			<AppShell viewer={viewer} pages={<PageTree nodes={nodes} />}>
				<Outlet />
			</AppShell>
		</Document>
	);
}

function Document({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="uk" suppressHydrationWarning>
			<head>
				<HeadContent />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, no input
					dangerouslySetInnerHTML={{
						__html: `try{var t=localStorage.getItem('recall.theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
					}}
				/>
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
