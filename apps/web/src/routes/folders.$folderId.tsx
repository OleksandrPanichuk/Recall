import { createFileRoute } from "@tanstack/react-router";
import { PageHeading } from "@/components/PageHeading";
import { PageView } from "@/components/PageView";
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

	const name = view.name ?? "Сторінка";

	return (
		<>
			<PageHeading
				title={view.icon === undefined ? name : `${view.icon} ${name}`}
				caption={
					view.breadcrumb.map((crumb) => crumb.name).join(" / ") || "Бібліотека"
				}
			/>
			<PageView view={view} />
		</>
	);
}
