import { useState } from "react";
import { api, type FolderView, type SetSummary } from "../client";
import { Card, Failure } from "../shell";

export function SetsPage({
	sets,
	folders,
	onOpen,
	onChanged,
}: {
	sets: readonly SetSummary[];
	folders: readonly FolderView[];
	onOpen: (quizSetId: string) => void;
	onChanged: () => void;
}) {
	const [title, setTitle] = useState("");
	const [language, setLanguage] = useState("en");
	const [folderId, setFolderId] = useState("");
	const [error, setError] = useState<string | undefined>();

	return (
		<div>
			<h2>Набори · {sets.length}</h2>
			<Failure error={error} />

			{sets.map((set) => (
				<Card key={set.id}>
					<div className="row">
						<button
							type="button"
							className="ghost"
							style={{ textAlign: "left", flex: 1 }}
							onClick={() => onOpen(set.id)}
						>
							{set.title}
						</button>
						<span className="muted">
							{set.questionCount} питань ·{" "}
							{set.status === "published" ? (
								<span className="ok">{set.status}</span>
							) : (
								set.status
							)}
						</span>
					</div>
				</Card>
			))}

			<h3>Новий набір</h3>
			<Card>
				<div className="row">
					<input
						value={title}
						placeholder="назва"
						onChange={(event) => setTitle(event.target.value)}
					/>
					<input
						value={language}
						placeholder="мова"
						style={{ maxWidth: "5rem" }}
						onChange={(event) => setLanguage(event.target.value)}
					/>
					<select
						value={folderId}
						onChange={(event) => setFolderId(event.target.value)}
					>
						<option value="">— без папки —</option>
						{folders.map((folder) => (
							<option key={folder.id} value={folder.id}>
								{"— ".repeat(folder.depth)}
								{folder.name}
							</option>
						))}
					</select>
					<button
						type="button"
						disabled={title.trim() === ""}
						onClick={() => {
							setError(undefined);
							void api
								.createSet({
									title,
									language,
									folderId: folderId === "" ? undefined : folderId,
								})
								.then((created) => {
									setTitle("");
									onChanged();
									onOpen(created.quizSetId);
								})
								.catch((failure: unknown) => {
									setError(
										failure instanceof Error ? failure.message : "Не вдалося",
									);
								});
						}}
					>
						Створити
					</button>
				</div>
			</Card>
		</div>
	);
}
