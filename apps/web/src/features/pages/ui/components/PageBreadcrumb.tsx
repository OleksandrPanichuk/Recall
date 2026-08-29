import type { BrowseCrumb } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function PageBreadcrumb({
	crumbs,
}: {
	readonly crumbs: readonly BrowseCrumb[];
}) {
	return (
		<nav
			aria-label="Шлях"
			className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
		>
			<Link to="/" className="rounded px-1.5 py-0.5 hover:bg-accent">
				Бібліотека
			</Link>
			{crumbs.map((crumb) => (
				<span key={crumb.id} className="flex items-center gap-1">
					<ChevronRight className="size-3.5" />
					<Link
						to="/folders/$folderId"
						params={{ folderId: crumb.id }}
						className="rounded px-1.5 py-0.5 hover:bg-accent"
					>
						{crumb.name}
					</Link>
				</span>
			))}
		</nav>
	);
}
