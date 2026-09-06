import { createFileRoute } from "@tanstack/react-router";
import { loadQuestions } from "@/features/authoring/lib/authoring.api";
import { QuestionBankView } from "@/features/authoring/ui/views/QuestionBankView";

export const Route = createFileRoute("/questions")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadQuestions(),
	head: () => ({ meta: [{ title: "Питання · Recall" }] }),
	component: Questions,
});

function Questions() {
	const loaded = Route.useLoaderData();

	return (
		<QuestionBankView rows={loaded?.rows ?? null} signedIn={loaded !== null} />
	);
}
