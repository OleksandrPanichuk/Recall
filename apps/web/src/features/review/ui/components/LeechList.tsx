import type { LeechView } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/Card";

export function LeechList({
	leeches,
}: {
	readonly leeches: readonly LeechView[];
}) {
	if (leeches.length === 0) {
		return (
			<Card className="p-8 text-center text-sm text-muted-foreground">
				Жодне питання не застрягло. Так тримати.
			</Card>
		);
	}

	return (
		<Card className="divide-y divide-border overflow-hidden">
			{leeches.map((leech) => (
				<div key={leech.questionId} className="px-4 py-3.5">
					<p className="text-sm">{leech.prompt}</p>
					<p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
						<Link
							to="/quizzes/$quizId"
							params={{ quizId: leech.quizSetId }}
							className="hover:underline"
						>
							{leech.quizSetTitle}
						</Link>
						· {leech.lapses} помилок
					</p>
				</div>
			))}
		</Card>
	);
}
