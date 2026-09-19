import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface Props {
	readonly prompt: string;
	readonly quizSetId: string;
	readonly quizSetTitle: string;
	readonly meta: string;
	readonly action: ReactNode;
}

export function QuestionRow({
	prompt,
	quizSetId,
	quizSetTitle,
	meta,
	action,
}: Props) {
	return (
		<div className="flex items-start justify-between gap-3 px-4 py-3.5">
			<div className="min-w-0">
				<p className="text-sm">{prompt}</p>
				<p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
					<Link
						to="/quizzes/$quizId"
						params={{ quizId: quizSetId }}
						className="hover:underline"
					>
						{quizSetTitle}
					</Link>
					· {meta}
				</p>
			</div>
			{action}
		</div>
	);
}
