import { createFileRoute } from "@tanstack/react-router";
import { loadCurrentQuestion } from "@/features/practice/lib/practice.api";
import { loadSettings } from "@/features/settings/lib/settings.api";
import { loadStatistics } from "@/features/statistics/lib/statistics.api";
import { QuizStatisticsView } from "@/features/statistics/ui/views/QuizStatisticsView";

export const Route = createFileRoute("/quizzes/$quizId")({
	loader: async ({ context, params }) => {
		if (context.viewer === null) {
			return null;
		}

		const [statistics, settings, active] = await Promise.all([
			loadStatistics({ data: params.quizId }),
			loadSettings({ data: params.quizId }),
			loadCurrentQuestion(),
		]);

		return {
			statistics,
			settings,
			active:
				active.current?.quizSetId === params.quizId ? active.current : null,
		};
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.statistics?.title ?? "Набір"} · Recall`,
			},
		],
	}),
	component: Quiz,
});

function Quiz() {
	const loaded = Route.useLoaderData();
	const { quizId } = Route.useParams();

	return (
		<QuizStatisticsView
			quizId={quizId}
			statistics={loaded?.statistics ?? null}
			settings={loaded?.settings ?? null}
			active={loaded?.active ?? null}
			signedIn={loaded !== null}
		/>
	);
}
