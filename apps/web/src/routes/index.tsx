import { createFileRoute } from "@tanstack/react-router";
import { loadLibrary } from "@/features/pages/lib/pages.api";
import { LibraryView } from "@/features/pages/ui/views/LibraryView";

export const Route = createFileRoute("/")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadLibrary({ data: undefined }),
	head: () => ({ meta: [{ title: "Бібліотека · Recall" }] }),
	component: Library,
});

function Library() {
	return <LibraryView view={Route.useLoaderData()} />;
}
