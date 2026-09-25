import type { DueSet, LeechView, RetiredView } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { DueList } from "@/features/review/ui/components/DueList";
import { LeechList } from "@/features/review/ui/components/LeechList";
import { RetiredList } from "@/features/review/ui/components/RetiredList";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";
import { reviewCaption } from "./ReviewView.constants";

interface Props {
	readonly due: readonly DueSet[];
	readonly leeches: readonly LeechView[];
	readonly retired: readonly RetiredView[];
	readonly signedIn: boolean;
}

export function ReviewView({ due, leeches, retired, signedIn }: Props) {
	if (!signedIn) {
		return <SignInPrompt />;
	}

	const first = due[0];

	return (
		<div className="space-y-8">
			<PageHeading title="Review" caption={reviewCaption(due)}>
				{first === undefined ? null : (
					<Button asChild>
						<Link
							to="/practice/$quizId"
							params={{ quizId: first.quizSetId }}
							search={{ mode: "due" }}
						>
							Start today's review
						</Link>
					</Button>
				)}
			</PageHeading>
			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">Due today</h2>
				<DueList due={due} />
			</section>
			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					Stuck questions
				</h2>
				<LeechList leeches={leeches} />
			</section>
			{retired.length === 0 ? null : (
				<section className="space-y-3">
					<h2 className="text-sm font-medium text-muted-foreground">Retired</h2>
					<RetiredList retired={retired} today={new Date()} />
				</section>
			)}
		</div>
	);
}
