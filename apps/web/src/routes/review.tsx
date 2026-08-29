import { createFileRoute } from "@tanstack/react-router";
import { DueList } from "@/components/DueList";
import { LeechList } from "@/components/LeechList";
import { PageHeading } from "@/components/PageHeading";
import { SignInPrompt } from "@/components/SignInPrompt";
import { loadRepetitions } from "@/lib/practice";

export const Route = createFileRoute("/review")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadRepetitions(),
	component: Review,
});

function Review() {
	const loaded = Route.useLoaderData();

	if (loaded === null) {
		return <SignInPrompt />;
	}

	const { due, leeches } = loaded;
	const questions = due.reduce((total, set) => total + set.dueCount, 0);

	return (
		<div className="space-y-8">
			<PageHeading
				title="Повторення"
				caption={
					questions === 0
						? "Все повторено"
						: `${questions} питань у ${due.length} набор(ах)`
				}
			/>
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
