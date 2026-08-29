/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { loadSession } from "../lib/practice";
import appCss from "../styles/app.css?url";

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
		<Shell>
			<header className="bar">
				<div>
					<Link to="/">
						<strong>Recall</strong>
					</Link>
					<small>{viewer === null ? "not signed in" : viewer.name}</small>
				</div>
			</header>
			<main>
				<Outlet />
			</main>
		</Shell>
	);
}

function Shell({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="uk">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
