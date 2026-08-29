import { Link } from "@tanstack/react-router";
import { BrainCircuit } from "lucide-react";
import type { ReactNode } from "react";

export interface AppShellProps {
	readonly viewer: { readonly name: string } | null;
	readonly children: ReactNode;
}

export function AppShell({ viewer, children }: AppShellProps) {
	return (
		<div className="min-h-dvh">
			<header className="border-b border-border bg-card/60 backdrop-blur">
				<div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
					<Link
						to="/"
						className="flex items-center gap-2 font-semibold tracking-tight"
					>
						<BrainCircuit className="size-5 text-primary" />
						Recall
					</Link>
					<span className="text-sm text-muted-foreground">
						{viewer === null ? "не увійшли" : viewer.name}
					</span>
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-5 py-8 pb-24">{children}</main>
		</div>
	);
}
