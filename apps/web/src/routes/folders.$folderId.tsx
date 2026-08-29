import { createFileRoute } from "@tanstack/react-router";
import { loadLibrary } from "@/features/pages/lib/pages.api";
import { PageDetailView } from "@/features/pages/ui/views/PageDetailView";

export const Route = createFileRoute("/folders/$folderId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadLibrary({ data: params.folderId }),
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
			signedIn={context.viewer !== null}
		/>
	);
}
