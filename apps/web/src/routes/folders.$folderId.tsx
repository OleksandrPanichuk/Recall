import { createFileRoute } from "@tanstack/react-router";
import { LibraryList } from "@/components/LibraryList";
import { PageHeading } from "@/components/PageHeading";
import { SignInPrompt } from "@/components/SignInPrompt";
import { loadLibrary } from "@/lib/practice";

export const Route = createFileRoute("/folders/$folderId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadLibrary({ data: params.folderId }),
	component: Folder,
});

function Folder() {
	const view = Route.useLoaderData();

	if (view === null) {
		return <SignInPrompt />;
	}

	return (
		<>
			<PageHeading
				title={view.name ?? "Папка"}
				caption={
					view.breadcrumb.map((crumb) => crumb.name).join(" / ") || "Бібліотека"
				}
			/>
			<LibraryList view={view} />
		</>
	);
}
