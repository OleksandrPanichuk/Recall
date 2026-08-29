import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInPrompt } from "../components/sign-in-prompt";
import { loadLibrary } from "../lib/practice";

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
			<h1>{view.name ?? "Папка"}</h1>
			<p className="lede">
				{view.breadcrumb.map((crumb) => crumb.name).join(" / ") || "Бібліотека"}
			</p>

			<ul className="list">
				{view.children.map((folder) => (
					<li key={folder.id}>
						<Link to="/folders/$folderId" params={{ folderId: folder.id }}>
							📁 {folder.name}
						</Link>
						<small>{folder.itemCount}</small>
					</li>
				))}
				{view.sets.map((set) => (
					<li key={set.id}>
						<Link to="/quizzes/$quizId" params={{ quizId: set.id }}>
							{set.title}
						</Link>
						<small>{set.questionCount} питань</small>
					</li>
				))}
			</ul>
		</>
	);
}
