import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface Props {
	readonly quizId: string;
	readonly label: string;
}

export function BackLink({ quizId, label }: Props) {
	return (
		<Link
			to="/quizzes/$quizId"
			params={{ quizId }}
			className="mb-4 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
		>
			<ArrowLeft className="size-4" />
			{label}
		</Link>
	);
}
