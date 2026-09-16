import { createFileRoute } from "@tanstack/react-router";
import {
	startAttempt,
	startPractice,
} from "@/features/practice/lib/practice.api";
import { parsePracticeSearch } from "@/features/practice/lib/practice-mode";
import { PracticeView } from "@/features/practice/ui/views/PracticeView";

export const Route = createFileRoute("/practice/$quizId")({
	preload: false,
	validateSearch: parsePracticeSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) => {
		if (context.viewer === null) {
			return null;
		}

		return deps.mode === undefined
			? startAttempt({ data: params.quizId })
			: startPractice({ data: { id: params.quizId, mode: deps.mode } });
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.current?.quizSetTitle ?? "Practice"} · Recall`,
			},
		],
	}),
	component: Practice,
});

function Practice() {
	const loaded = Route.useLoaderData();
	const { quizId } = Route.useParams();

	return (
		<PracticeView
			quizId={quizId}
			started={loaded?.current ?? null}
			blockedBy={loaded?.blockedBy ?? null}
			nothing={loaded?.nothing ?? null}
			signedIn={loaded !== null}
		/>
	);
}
