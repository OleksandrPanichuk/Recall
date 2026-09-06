import { createFileRoute } from "@tanstack/react-router";
import { loadSharedPage } from "@/features/pages/lib/pages.api";
import { SharedPageView } from "@/features/pages/ui/views/SharedPageView";

export const Route = createFileRoute("/p/$token")({
	loader: async ({ params }) => loadSharedPage({ data: params.token }),
	head: ({ loaderData }) => ({
		meta: [{ title: `${loaderData?.page?.name ?? "Сторінка"} · Recall` }],
	}),
	component: Shared,
});

function Shared() {
	const { page } = Route.useLoaderData();
	const { token } = Route.useParams();

	return <SharedPageView token={token} page={page} />;
}
