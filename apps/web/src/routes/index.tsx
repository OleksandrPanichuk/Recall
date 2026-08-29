import { createFileRoute } from "@tanstack/react-router";
import { LibraryList } from "@/components/LibraryList";
import { PageHeading } from "@/components/PageHeading";
import { SignInPrompt } from "@/components/SignInPrompt";
import { loadLibrary } from "@/lib/practice";

export const Route = createFileRoute("/")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadLibrary({ data: undefined }),
	component: Library,
});

function Library() {
	const view = Route.useLoaderData();

	if (view === null) {
		return <SignInPrompt />;
	}

	const sets = view.sets.length;
	const folders = view.children.length;

	return (
		<>
			<PageHeading
				title="Ваша бібліотека"
				caption={`${sets} набор(ів)${folders > 0 ? `, ${folders} папк(и)` : ""}`}
			/>
			<LibraryList view={view} />
		</>
	);
}
