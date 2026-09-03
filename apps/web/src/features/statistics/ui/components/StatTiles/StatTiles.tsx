import { Card } from "@/components/ui/Card";
import type { Stat } from "@/features/statistics/lib/tiles.types";

export function StatTiles({ stats }: { readonly stats: readonly Stat[] }) {
	return (
		<div className="grid gap-3 sm:grid-cols-3">
			{stats.map((stat) => (
				<Card key={stat.label} className="p-5">
					<p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{stat.icon}
						{stat.label}
					</p>
					<p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
						{stat.value}
					</p>
					{stat.hint === undefined ? null : (
						<p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
					)}
				</Card>
			))}
		</div>
	);
}
