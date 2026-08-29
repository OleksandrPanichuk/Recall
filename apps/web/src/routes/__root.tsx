/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { loadSession } from "@/lib/practice";
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
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	beforeLoad: async () => loadSession(),
	component: RootComponent,
});

function RootComponent() {
	const { viewer } = Route.useRouteContext();

	return (
		<Document>
			<AppShell viewer={viewer}>
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
						__html: `try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`,
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
