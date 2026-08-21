import { useState } from "react";
import { api, type FolderView } from "../client";
import { Card, Failure } from "../shell";

export function FoldersPage({
	folders,
	onChanged,
}: {
	folders: readonly FolderView[];
	onChanged: () => void;
}) {
	const [name, setName] = useState("");
	const [parentId, setParentId] = useState("");
	const [error, setError] = useState<string | undefined>();

	const guard = async (work: () => Promise<unknown>) => {
		setError(undefined);

		try {
			await work();
			onChanged();
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Не вдалося");
		}
	};

	return (
		<div>
			<h2>Папки</h2>
			<Failure error={error} />

			{folders.map((folder) => (
				<Card key={folder.id}>
					<div className="row">
						<input
							defaultValue={folder.name}
							style={{ marginLeft: `${folder.depth * 1.2}rem` }}
							onBlur={(event) => {
								if (event.target.value.trim() !== folder.name) {
									void guard(() =>
										api.updateFolder(folder.id, { name: event.target.value }),
									);
								}
							}}
						/>
						<span className="muted" style={{ whiteSpace: "nowrap" }}>
							{folder.setCount} опубл. / {folder.unpublishedCount} чернеток
						</span>
						<button
							type="button"
							className="danger"
							onClick={() => void guard(() => api.deleteFolder(folder.id))}
						>
							Видалити
						</button>
					</div>
					<label className="field">
						<span>Батьківська папка</span>
						<select
							value={folder.parentId ?? ""}
							onChange={(event) =>
								void guard(() =>
									api.updateFolder(folder.id, {
										parentId:
											event.target.value === ""
												? undefined
												: event.target.value,
									}),
								)
							}
						>
							<option value="">— корінь —</option>
							{folders
								.filter((candidate) => candidate.id !== folder.id)
								.map((candidate) => (
									<option key={candidate.id} value={candidate.id}>
										{"— ".repeat(candidate.depth)}
										{candidate.name}
									</option>
								))}
						</select>
					</label>
				</Card>
			))}

			<Card>
				<div className="row">
					<input
						value={name}
						placeholder="нова папка"
						onChange={(event) => setName(event.target.value)}
					/>
					<select
						value={parentId}
						onChange={(event) => setParentId(event.target.value)}
					>
						<option value="">— корінь —</option>
						{folders.map((folder) => (
							<option key={folder.id} value={folder.id}>
								{"— ".repeat(folder.depth)}
								{folder.name}
							</option>
						))}
					</select>
					<button
						type="button"
						disabled={name.trim() === ""}
						onClick={() =>
							void guard(async () => {
								await api.createFolder({
									name,
									parentId: parentId === "" ? undefined : parentId,
								});
								setName("");
							})
						}
					>
						Створити
					</button>
				</div>
			</Card>
		</div>
	);
}
