import { createFileRoute } from "@tanstack/react-router";
import { loadLibrary } from "@/features/pages/lib/pages.api";
import { LibraryView } from "@/features/pages/ui/views/LibraryView";
import { loadCurrentQuestion } from "@/features/practice/lib/practice.api";

export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		if (context.viewer === null) {
			return null;
		}

		const [view, active] = await Promise.all([
			loadLibrary({ data: undefined }),
			loadCurrentQuestion(),
		]);

		return { view, inProgressQuizId: active.current?.quizSetId };
	},
	head: () => ({ meta: [{ title: "Бібліотека · Recall" }] }),
	component: Library,
});

function Library() {
	const loaded = Route.useLoaderData();

	return (
		<LibraryView
			view={loaded?.view ?? null}
			inProgressQuizId={loaded?.inProgressQuizId}
		/>
	);
}
