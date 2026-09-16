import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { PracticeSearchMode } from "@/features/practice/lib/practice-mode";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { NOTHING_TO_PRACTICE_TEXT } from "./NothingToPractice.constants";

interface Props {
	readonly mode: PracticeSearchMode;
	readonly quizId: string;
}

export function NothingToPractice({ mode, quizId }: Props) {
	return (
		<>
			<PageHeading title="Nothing to practice" />
			<Card>
				<CardContent className="space-y-4 pt-5">
					<p className="text-sm text-muted-foreground">
						{NOTHING_TO_PRACTICE_TEXT[mode]}
					</p>
					{mode === "due" ? (
						<Link to="/review">
							<Button variant="outline">Back to review</Button>
						</Link>
					) : (
						<Link to="/quizzes/$quizId" params={{ quizId }}>
							<Button variant="outline">Back to quiz</Button>
						</Link>
					)}
				</CardContent>
			</Card>
		</>
	);
}
