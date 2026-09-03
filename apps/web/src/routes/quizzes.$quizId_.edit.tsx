import { createFileRoute } from "@tanstack/react-router";
import { loadQuizSet } from "@/features/authoring/lib/authoring.api";
import { QuizEditorView } from "@/features/authoring/ui/views/QuizEditorView";
import { NotFound } from "@/shared/ui/components/NotFound";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

export const Route = createFileRoute("/quizzes/$quizId_/edit")({
	loader: async ({ context, params }) =>
		context.viewer === null
			? { viewer: false as const }
			: {
					viewer: true as const,
					quiz: await loadQuizSet({ data: params.quizId }),
				},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.viewer === true ? (loaderData.quiz?.title ?? "Набір") : "Набір"} · Recall`,
			},
		],
	}),
	component: Editor,
});

function Editor() {
	const loaded = Route.useLoaderData();

	if (!loaded.viewer) {
		return <SignInPrompt />;
	}

	if (loaded.quiz === null) {
		return <NotFound />;
	}

	return <QuizEditorView quiz={loaded.quiz} />;
}
