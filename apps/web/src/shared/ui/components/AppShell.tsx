import { Link, useLocation } from "@tanstack/react-router";
import {
	BrainCircuit,
	CalendarClock,
	ChartColumn,
	Library,
	Menu,
	Settings,
	X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { navLink } from "./AppShell.constants";

interface Props {
	readonly viewer: { readonly name: string } | null;
	readonly pages: ReactNode;
	readonly children: ReactNode;
}

export function AppShell({ viewer, pages, children }: Props) {
	const { pathname } = useLocation();
	const [openOn, setOpenOn] = useState<string | null>(null);
	const open = openOn === pathname;

	return (
		<div className="min-h-dvh lg:flex">
			<header className="flex items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur lg:hidden">
				<button
					type="button"
					aria-label="Меню"
					onClick={() => setOpenOn(open ? null : pathname)}
					className="rounded-md p-1.5 hover:bg-accent"
				>
					{open ? <X className="size-5" /> : <Menu className="size-5" />}
				</button>
				<Link to="/" className="flex items-center gap-2 font-semibold">
					<BrainCircuit className="size-5 text-primary" />
					Recall
				</Link>
				<span className="text-sm text-muted-foreground">
					{viewer === null ? "гість" : viewer.name}
				</span>
			</header>

			<aside
				className={`${open ? "block" : "hidden"} border-b border-border bg-card/40 px-3 py-4 lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r`}
			>
				<div className="mb-4 hidden items-center justify-between lg:flex">
					<Link
						to="/"
						className="flex items-center gap-2 px-2 font-semibold tracking-tight"
					>
						<BrainCircuit className="size-5 text-primary" />
						Recall
					</Link>
				</div>
				<nav className="mb-4 space-y-0.5">
					<Link
						to="/"
						className={navLink}
						activeProps={{ className: "bg-accent/60 text-foreground" }}
						activeOptions={{ exact: true }}
					>
						<Library className="size-4" />
						Бібліотека
					</Link>
					<Link
						to="/review"
						className={navLink}
						activeProps={{ className: "bg-accent/60 text-foreground" }}
					>
						<CalendarClock className="size-4" />
						Повторення
					</Link>
					<Link
						to="/insights"
						className={navLink}
						activeProps={{ className: "bg-accent/60 text-foreground" }}
					>
						<ChartColumn className="size-4" />
						Статистика
					</Link>
					<Link
						to="/settings"
						className={navLink}
						activeProps={{ className: "bg-accent/60 text-foreground" }}
					>
						<Settings className="size-4" />
						Налаштування
					</Link>
				</nav>
				<p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Сторінки
				</p>
				{pages}
				<p className="mt-6 hidden px-2 text-xs text-muted-foreground lg:block">
					{viewer === null ? "не увійшли" : viewer.name}
				</p>
			</aside>

			<main className="mx-auto w-full max-w-3xl px-5 py-8 pb-24 lg:py-12">
				{children}
			</main>
		</div>
	);
}
