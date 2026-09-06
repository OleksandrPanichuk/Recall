import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { loadQuizSets } from "@/features/authoring/lib/authoring.api";
import { loadLibrary, loadRevisions } from "@/features/pages/lib/pages.api";
import { PageDetailView } from "@/features/pages/ui/views/PageDetailView";
import { loadCurrentQuestion } from "@/features/practice/lib/practice.api";

export const Route = createFileRoute("/folders/$folderId")({
	loader: async ({ context, params }) => {
		if (context.viewer === null) {
			return null;
		}

		const [page, active, history, quizzes] = await Promise.all([
			loadLibrary({ data: params.folderId }),
			loadCurrentQuestion(),
			loadRevisions({ data: params.folderId }),
			loadQuizSets(),
		]);

		return page === null
			? null
			: {
					...page,
					inProgressQuizId: active.current?.quizSetId,
					revisions: history.revisions,
					sets: quizzes.sets,
				};
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `${loaderData?.name ?? "Сторінка"} · Recall` }],
	}),
	component: Page,
});

function Page() {
	const loaded = Route.useLoaderData();
	const context = Route.useRouteContext();
	const { folderId } = Route.useParams();
	const { nodes } = useLoaderData({ from: "__root__" });

	return (
		<PageDetailView
			folderId={folderId}
			page={loaded}
			inProgressQuizId={loaded?.inProgressQuizId}
			pages={nodes}
			sets={loaded?.sets ?? []}
			signedIn={context.viewer !== null}
			revisions={loaded?.revisions ?? []}
		/>
	);
}
