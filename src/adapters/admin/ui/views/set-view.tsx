import { useCallback, useEffect, useState } from "react";
import {
	api,
	type FolderView,
	type QuizSettings,
	type SetView,
	type StatisticsView,
	type VocabularyView,
} from "../client";
import { Card, Failure, Field, Toggle } from "../shell";
import {
	draftOf,
	emptyDraft,
	payloadOf,
	type QuestionDraft,
	QuestionEditor,
} from "./question-editor";

const percent = (correct: number, total: number): string =>
	total === 0 ? "—" : `${Math.round((correct / total) * 100)}%`;

export function SetPage({
	quizSetId,
	folders,
	onChanged,
	onClose,
}: {
	quizSetId: string;
	folders: readonly FolderView[];
	onChanged: () => void;
	onClose: () => void;
}) {
	const [set, setSet] = useState<SetView | undefined>();
	const [vocabulary, setVocabulary] = useState<readonly VocabularyView[]>([]);
	const [statistics, setStatistics] = useState<StatisticsView | undefined>();
	const [settings, setSettings] = useState<QuizSettings | undefined>();
	const [settingsSource, setSettingsSource] = useState("default");
	const [error, setError] = useState<string | undefined>();
	const [editing, setEditing] = useState<string | undefined>();
	const [draft, setDraft] = useState<QuestionDraft>(emptyDraft());
	const [adding, setAdding] = useState(false);
	const [newQuestion, setNewQuestion] = useState<QuestionDraft>(emptyDraft());
	const [term, setTerm] = useState("");
	const [translation, setTranslation] = useState("");

	const guard = useCallback(async (work: () => Promise<void>) => {
		setError(undefined);

		try {
			await work();
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Не вдалося");
		}
	}, []);

	const reload = useCallback(async () => {
		await guard(async () => {
			const [loaded, words, resolved] = await Promise.all([
				api.set(quizSetId),
				api.vocabulary(quizSetId),
				api.settings(quizSetId),
			]);

			setSet(loaded);
			setVocabulary(words);
			setSettings(resolved.settings);
			setSettingsSource(resolved.source);
		});
	}, [guard, quizSetId]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const save = (work: () => Promise<SetView>) =>
		guard(async () => {
			setSet(await work());
			setEditing(undefined);
			setAdding(false);
			onChanged();
			setVocabulary(await api.vocabulary(quizSetId));
		});

	if (set === undefined) {
		return (
			<div>
				<Failure error={error} />
				<p className="muted">Завантаження…</p>
			</div>
		);
	}

	return (
		<div>
			<div className="row">
				<h2>
					{set.title} <span className="muted">· {set.status}</span>
				</h2>
				<button type="button" className="ghost" onClick={onClose}>
					← до наборів
				</button>
			</div>

			<Failure error={error} />

			<Card>
				<Field
					label="Назва"
					value={set.title}
					onChange={(title) => setSet({ ...set, title })}
				/>
				<Field
					label="Опис"
					value={set.description ?? ""}
					multiline
					onChange={(description) => setSet({ ...set, description })}
				/>
				<div className="row">
					<Field
						label="Джерело"
						value={set.source ?? ""}
						onChange={(source) => setSet({ ...set, source })}
					/>
					<Field
						label="Розділи"
						value={set.sourceChapters ?? ""}
						onChange={(sourceChapters) => setSet({ ...set, sourceChapters })}
					/>
				</div>
				<label className="field">
					<span>Папка</span>
					<select
						value={set.folderId ?? ""}
						onChange={(event) =>
							void save(() =>
								api.moveSet(
									set.id,
									event.target.value === "" ? undefined : event.target.value,
								),
							)
						}
					>
						<option value="">— без папки —</option>
						{folders.map((folder) => (
							<option key={folder.id} value={folder.id}>
								{"— ".repeat(folder.depth)}
								{folder.name}
							</option>
						))}
					</select>
				</label>
				<div className="row" style={{ marginTop: ".8rem" }}>
					<button
						type="button"
						onClick={() =>
							void save(() =>
								api.updateSet(set.id, {
									title: set.title,
									description: set.description,
									source: set.source,
									sourceChapters: set.sourceChapters,
								}),
							)
						}
					>
						Зберегти
					</button>
					{set.status === "published" ? (
						<button
							type="button"
							className="ghost"
							onClick={() => void save(() => api.archiveSet(set.id))}
						>
							В архів
						</button>
					) : (
						<button
							type="button"
							className="ghost"
							onClick={() => void save(() => api.publishSet(set.id))}
						>
							Опублікувати
						</button>
					)}
				</div>
			</Card>

			<h3>Налаштування набору · {settingsSource}</h3>
			{settings === undefined ? null : (
				<Card>
					<Toggle
						label="Перемішувати варіанти"
						checked={settings.shuffleOptions}
						onChange={(shuffleOptions) =>
							void guard(async () => {
								const saved = await api.saveSettings({
									quizSetId: set.id,
									shuffleOptions,
								});

								setSettings(saved.settings);
								setSettingsSource(saved.source);
							})
						}
					/>
					<Toggle
						label="Перемішувати питання"
						checked={settings.shuffleQuestions}
						onChange={(shuffleQuestions) =>
							void guard(async () => {
								const saved = await api.saveSettings({
									quizSetId: set.id,
									shuffleQuestions,
								});

								setSettings(saved.settings);
								setSettingsSource(saved.source);
							})
						}
					/>
					<Toggle
						label="Режим екзамену"
						checked={settings.examMode}
						onChange={(examMode) =>
							void guard(async () => {
								const saved = await api.saveSettings({
									quizSetId: set.id,
									examMode,
								});

								setSettings(saved.settings);
								setSettingsSource(saved.source);
							})
						}
					/>
					{settingsSource === "set" ? (
						<button
							type="button"
							className="ghost"
							style={{ marginTop: ".6rem" }}
							onClick={() =>
								void guard(async () => {
									const saved = await api.saveSettings({
										quizSetId: set.id,
										inheritGlobal: true,
									});

									setSettings(saved.settings);
									setSettingsSource(saved.source);
								})
							}
						>
							Успадкувати глобальні
						</button>
					) : null}
				</Card>
			)}

			<h3>Питання · {set.questions.length}</h3>
			{set.questions.map((question, index) => (
				<Card key={question.id}>
					{editing === question.id ? (
						<div>
							<QuestionEditor draft={draft} onChange={setDraft} locked />
							<div className="row" style={{ marginTop: ".8rem" }}>
								<button
									type="button"
									onClick={() =>
										void save(() =>
											api.updateQuestion(set.id, question.id, payloadOf(draft)),
										)
									}
								>
									Зберегти питання
								</button>
								<button
									type="button"
									className="ghost"
									onClick={() => setEditing(undefined)}
								>
									Скасувати
								</button>
							</div>
						</div>
					) : (
						<div>
							<div className="row">
								<strong>
									{index + 1}. {question.prompt}
								</strong>
								<span className="muted">
									{question.type} · {question.difficulty}
								</span>
							</div>
							<p className="muted">
								{question.options
									.map(
										(option) =>
											`${option.isCorrect ? "✓" : "·"} ${option.text}${
												option.matchKey === undefined
													? ""
													: ` → ${option.matchKey}`
											}`,
									)
									.join("   ")}
							</p>
							<div className="row">
								<div style={{ display: "flex", gap: ".5rem" }}>
									<button
										type="button"
										className="ghost"
										onClick={() => {
											setDraft(draftOf(question));
											setEditing(question.id);
										}}
									>
										Редагувати
									</button>
									<button
										type="button"
										className="danger"
										onClick={() =>
											void save(() => api.deleteQuestion(set.id, question.id))
										}
									>
										Видалити
									</button>
								</div>
								{question.vocabularyItemId === undefined ? null : (
									<span className="muted">зі словника</span>
								)}
							</div>
						</div>
					)}
				</Card>
			))}

			{adding ? (
				<Card>
					<QuestionEditor draft={newQuestion} onChange={setNewQuestion} />
					<div className="row" style={{ marginTop: ".8rem" }}>
						<button
							type="button"
							onClick={() =>
								void save(async () => {
									const updated = await api.addQuestions(set.id, [
										payloadOf(newQuestion),
									]);

									setNewQuestion(emptyDraft());

									return updated;
								})
							}
						>
							Додати
						</button>
						<button
							type="button"
							className="ghost"
							onClick={() => setAdding(false)}
						>
							Скасувати
						</button>
					</div>
				</Card>
			) : (
				<button type="button" className="ghost" onClick={() => setAdding(true)}>
					+ питання
				</button>
			)}

			<h3>Словник · {vocabulary.length}</h3>
			{vocabulary.map((item) => (
				<Card key={item.itemId}>
					<div className="row">
						<span>
							{item.terms.join(" / ")} — {item.translations.join(" / ")}
						</span>
						<span className="muted">{item.questionIds.length} питань</span>
					</div>
					<div className="pair" style={{ marginTop: ".5rem" }}>
						<input
							defaultValue={item.terms.join(", ")}
							onBlur={(event) =>
								void guard(async () => {
									await api.updateVocabulary(item.itemId, {
										term: event.target.value
											.split(",")
											.map((part) => part.trim())
											.filter((part) => part.length > 0),
									});
									await reload();
								})
							}
						/>
						<input
							defaultValue={item.translations.join(", ")}
							onBlur={(event) =>
								void guard(async () => {
									await api.updateVocabulary(item.itemId, {
										translation: event.target.value
											.split(",")
											.map((part) => part.trim())
											.filter((part) => part.length > 0),
									});
									await reload();
								})
							}
						/>
						<span className="muted">↵</span>
					</div>
				</Card>
			))}

			<Card>
				<div className="pair">
					<input
						value={term}
						placeholder="термін"
						onChange={(event) => setTerm(event.target.value)}
					/>
					<input
						value={translation}
						placeholder="переклад"
						onChange={(event) => setTranslation(event.target.value)}
					/>
					<button
						type="button"
						disabled={term.trim() === "" || translation.trim() === ""}
						onClick={() =>
							void save(async () => {
								const updated = await api.addVocabulary(set.id, {
									pairs: [{ term: [term], translation: [translation] }],
									directions: ["term_to_translation"],
								});

								setTerm("");
								setTranslation("");

								return updated;
							})
						}
					>
						Додати пару
					</button>
				</div>
			</Card>

			<h3>Статистика</h3>
			{statistics === undefined ? (
				<button
					type="button"
					className="ghost"
					onClick={() =>
						void guard(async () => {
							setStatistics(await api.statistics(set.id));
						})
					}
				>
					Показати
				</button>
			) : (
				<Card>
					<p>
						Точність:{" "}
						<strong>
							{percent(
								statistics.setAccuracy.correct,
								statistics.setAccuracy.total,
							)}
						</strong>{" "}
						· спроб: {statistics.attempts.length}
					</p>
					{statistics.topics.map((topic) => (
						<p className="muted" key={topic.topic}>
							{topic.topic}: {percent(topic.correct, topic.answered)} (
							{topic.correct}/{topic.answered})
						</p>
					))}
				</Card>
			)}
		</div>
	);
}
