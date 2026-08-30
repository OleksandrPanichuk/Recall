import { createFileRoute } from "@tanstack/react-router";
import { startAttempt } from "@/features/practice/lib/practice.api";
import { PracticeView } from "@/features/practice/ui/views/PracticeView";

export const Route = createFileRoute("/practice/$quizId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : startAttempt({ data: params.quizId }),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.current?.quizSetTitle ?? "Практика"} · Recall`,
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
			signedIn={loaded !== null}
		/>
	);
}
