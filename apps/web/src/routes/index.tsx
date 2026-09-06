import { createFileRoute } from "@tanstack/react-router";
import { loginErrorFor } from "@/features/auth/constants/login-errors";
import { loadLibrary } from "@/features/pages/lib/pages.api";
import { LibraryView } from "@/features/pages/ui/views/LibraryView";
import { loadCurrentQuestion } from "@/features/practice/lib/practice.api";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): { error?: string } =>
		typeof search.error === "string" ? { error: search.error } : {},
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
	head: () => ({ meta: [{ title: "Library · Recall" }] }),
	component: Library,
});

function Library() {
	const loaded = Route.useLoaderData();
	const { error } = Route.useSearch();

	return (
		<LibraryView
			view={loaded?.view ?? null}
			inProgressQuizId={loaded?.inProgressQuizId}
			signInReason={loginErrorFor(error)}
		/>
	);
}
