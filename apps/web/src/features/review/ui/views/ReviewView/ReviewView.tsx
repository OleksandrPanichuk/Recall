import type { DueSet, LeechView } from "@recall/contracts";
import { DueList } from "@/features/review/ui/components/DueList";
import { LeechList } from "@/features/review/ui/components/LeechList";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";
import { reviewCaption } from "./ReviewView.constants";

interface Props {
	readonly due: readonly DueSet[];
	readonly leeches: readonly LeechView[];
	readonly signedIn: boolean;
}

export function ReviewView({ due, leeches, signedIn }: Props) {
	if (!signedIn) {
		return <SignInPrompt />;
	}

	return (
		<div className="space-y-8">
			<PageHeading title="Повторення" caption={reviewCaption(due)} />
			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					На сьогодні
				</h2>
				<DueList due={due} />
			</section>
			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					Складні питання
				</h2>
				<LeechList leeches={leeches} />
			</section>
		</div>
	);
}
