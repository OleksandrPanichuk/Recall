import { createFileRoute } from "@tanstack/react-router";
import { loadLibrary } from "@/features/pages/lib/pages.api";
import { PageDetailView } from "@/features/pages/ui/views/PageDetailView";
import { loadCurrentQuestion } from "@/features/practice/lib/practice.api";

export const Route = createFileRoute("/folders/$folderId")({
	loader: async ({ context, params }) => {
		if (context.viewer === null) {
			return null;
		}

		const [page, active] = await Promise.all([
			loadLibrary({ data: params.folderId }),
			loadCurrentQuestion(),
		]);

		return page === null
			? null
			: { ...page, inProgressQuizId: active.current?.quizSetId };
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

	return (
		<PageDetailView
			folderId={folderId}
			page={loaded}
			inProgressQuizId={loaded?.inProgressQuizId}
			signedIn={context.viewer !== null}
		/>
	);
}
