/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SignOutButton } from "@/features/auth/ui/components/SignOutButton";
import { usePreloadPages } from "@/features/pages/hooks/use-preload-pages";
import { useWarmEditor } from "@/features/pages/hooks/use-warm-editor";
import { loadPageTree } from "@/features/pages/lib/pages.api";
import { PageTree } from "@/features/pages/ui/components/PageTree";
import { SHARE_PATH } from "@/shared/constants/sharing";
import { noFlashScript } from "@/shared/constants/theme";
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
	const { pathname } = useLocation();

	usePreloadPages(nodes);
	useWarmEditor();

	if (pathname.startsWith(`${SHARE_PATH}/`)) {
		return (
			<Document>
				<Outlet />
			</Document>
		);
	}

	return (
		<Document>
			<AppShell
				viewer={viewer}
				pages={<PageTree nodes={nodes} />}
				account={viewer === null ? null : <SignOutButton />}
			>
				<Outlet />
			</AppShell>
		</Document>
	);
}

function Document({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, no input
					dangerouslySetInnerHTML={{
						__html: noFlashScript(),
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
