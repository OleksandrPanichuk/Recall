import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInPrompt } from "../components/sign-in-prompt";
import { loadLibrary } from "../lib/practice";

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

	return (
		<>
			<h1>Ваша бібліотека</h1>
			<p className="lede">
				{view.sets.length} набор(ів) тут{" "}
				{view.children.length > 0 ? `і ${view.children.length} папк(и)` : null}
			</p>

			{view.children.length > 0 ? (
				<ul className="list" style={{ marginBottom: "1.5rem" }}>
					{view.children.map((folder) => (
						<li key={folder.id}>
							<Link to="/folders/$folderId" params={{ folderId: folder.id }}>
								📁 {folder.name}
							</Link>
							<small>{folder.itemCount}</small>
						</li>
					))}
				</ul>
			) : null}

			<ul className="list">
				{view.sets.map((set) => (
					<li key={set.id}>
						<Link to="/quizzes/$quizId" params={{ quizId: set.id }}>
							{set.title}
						</Link>
						<small>{set.questionCount} питань</small>
					</li>
				))}
			</ul>

			{view.sets.length === 0 && view.children.length === 0 ? (
				<p className="lede">
					Тут поки порожньо. Створіть набір через бота або MCP.
				</p>
			) : null}
		</>
	);
}
