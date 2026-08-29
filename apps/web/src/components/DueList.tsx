import type { DueSet } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function DueList({ due }: { readonly due: readonly DueSet[] }) {
	if (due.length === 0) {
		return (
			<Card className="p-8 text-center text-sm text-muted-foreground">
				На сьогодні нічого не заплановано.
			</Card>
		);
	}

	return (
		<Card className="divide-y divide-border overflow-hidden">
			{due.map((set) => (
				<Link
					key={set.quizSetId}
					to="/practice/$quizId"
					params={{ quizId: set.quizSetId }}
					className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent/60"
				>
					<span className="flex min-w-0 items-center gap-3">
						<Clock className="size-4 shrink-0 text-muted-foreground" />
						<span className="min-w-0">
							<span className="block truncate font-medium">{set.title}</span>
							{set.overdueDays > 0 ? (
								<span className="text-xs text-destructive">
									прострочено на {set.overdueDays} дн.
								</span>
							) : null}
						</span>
					</span>
					<span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
						{set.dueCount}
						<ChevronRight className="size-4" />
					</span>
				</Link>
			))}
		</Card>
	);
}
