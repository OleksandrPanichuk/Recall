import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import {
	loadQuizSet,
	loadVocabulary,
} from "@/features/authoring/lib/authoring.api";
import { QuizEditorView } from "@/features/authoring/ui/views/QuizEditorView";
import { NotFound } from "@/shared/ui/components/NotFound";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

export const Route = createFileRoute("/quizzes/$quizId_/edit")({
	remountDeps: ({ params }) => params.quizId,
	loader: async ({ context, params }) => {
		if (context.viewer === null) {
			return { viewer: false as const };
		}

		const [quiz, vocabulary] = await Promise.all([
			loadQuizSet({ data: params.quizId }),
			loadVocabulary({ data: params.quizId }),
		]);

		return { viewer: true as const, quiz, vocabulary: vocabulary.items };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.viewer === true ? (loaderData.quiz?.title ?? "Quiz") : "Quiz"} · Recall`,
			},
		],
	}),
	component: Editor,
});

function Editor() {
	const loaded = Route.useLoaderData();
	const { nodes } = useLoaderData({ from: "__root__" });

	if (!loaded.viewer) {
		return <SignInPrompt />;
	}

	if (loaded.quiz === null) {
		return <NotFound />;
	}

	return (
		<QuizEditorView
			quiz={loaded.quiz}
			vocabulary={loaded.vocabulary}
			pages={nodes}
		/>
	);
}
