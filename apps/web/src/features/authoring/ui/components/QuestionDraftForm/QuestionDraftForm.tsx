import { Difficulty, QuestionType } from "@recall/contracts";
import { Plus, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
	ANSWER_SHAPE,
	DIFFICULTY_LABELS,
	TYPE_LABELS,
} from "@/features/authoring/constants/question-types";
import type { DraftForm } from "@/features/authoring/lib/drafts";
import { problemsWith } from "@/features/authoring/lib/drafts";
import { ANSWER_LABELS, FIELD } from "./QuestionDraftForm.constants";

interface Props {
	readonly form: DraftForm;
	readonly busy: boolean;
	readonly onChange: (form: DraftForm) => void;
	readonly onSubmit: () => void;
	readonly onCancel: () => void;
}

export function QuestionDraftForm({
	form,
	busy,
	onChange,
	onSubmit,
	onCancel,
}: Props) {
	const shape = ANSWER_SHAPE[form.type] ?? "options";
	const problems = problemsWith(form);
	const set = (patch: Partial<DraftForm>) => onChange({ ...form, ...patch });
	const answerAt = (index: number, value: string) =>
		set({
			answers: form.answers.map((text, at) => (at === index ? value : text)),
		});

	return (
		<div className="space-y-3">
			<div className="grid gap-2 sm:grid-cols-2">
				<label className="space-y-1 text-sm">
					<span className="font-medium">Тип питання</span>
					<select
						className={FIELD}
						value={form.type}
						onChange={(event) =>
							set({ type: event.target.value as DraftForm["type"] })
						}
					>
						{Object.values(QuestionType).map((type) => (
							<option key={type} value={type}>
								{TYPE_LABELS[type]}
							</option>
						))}
					</select>
				</label>
				<label className="space-y-1 text-sm">
					<span className="font-medium">Складність</span>
					<select
						className={FIELD}
						value={form.difficulty}
						onChange={(event) =>
							set({ difficulty: event.target.value as DraftForm["difficulty"] })
						}
					>
						{Object.values(Difficulty).map((level) => (
							<option key={level} value={level}>
								{DIFFICULTY_LABELS[level]}
							</option>
						))}
					</select>
				</label>
			</div>

			<label className="block space-y-1 text-sm">
				<span className="font-medium">Питання</span>
				<textarea
					className={`${FIELD} min-h-20 resize-y`}
					value={form.prompt}
					onChange={(event) => set({ prompt: event.target.value })}
					placeholder={
						form.type === QuestionType.Cloze
							? "Bun запускає ___ швидко"
							: "Що саме перевіряємо?"
					}
				/>
			</label>

			<div className="space-y-2">
				<span className="text-sm font-medium">{ANSWER_LABELS[shape]}</span>
				{form.answers.map((answer, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; reordering is what the value means
						key={index}
						className="flex items-center gap-2"
					>
						{shape === "options" ? (
							<input
								type={
									form.type === QuestionType.MultipleChoice
										? "checkbox"
										: "radio"
								}
								name="correct"
								aria-label={`Правильна відповідь ${index + 1}`}
								checked={form.correct.includes(index)}
								onChange={() =>
									set({
										correct:
											form.type === QuestionType.MultipleChoice
												? form.correct.includes(index)
													? form.correct.filter((at) => at !== index)
													: [...form.correct, index]
												: [index],
									})
								}
								className="size-4 shrink-0"
							/>
						) : null}
						<Input
							value={answer}
							aria-label={`${ANSWER_LABELS[shape]} ${index + 1}`}
							onChange={(event) => answerAt(index, event.target.value)}
						/>
						{shape === "pairs" ? (
							<Input
								value={form.rights[index] ?? ""}
								aria-label={`Пара ${index + 1}, друга частина`}
								onChange={(event) =>
									set({
										rights: form.answers.map((_, at) =>
											at === index
												? event.target.value
												: (form.rights[at] ?? ""),
										),
									})
								}
							/>
						) : null}
						<button
							type="button"
							aria-label={`Прибрати рядок ${index + 1}`}
							disabled={form.answers.length <= 1}
							onClick={() =>
								set({
									answers: form.answers.filter((_, at) => at !== index),
									rights: form.rights.filter((_, at) => at !== index),
									correct: form.correct
										.filter((at) => at !== index)
										.map((at) => (at > index ? at - 1 : at)),
								})
							}
							className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
						>
							<X className="size-3.5" />
						</button>
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() =>
						set({
							answers: [...form.answers, ""],
							rights: [...form.rights, ""],
						})
					}
				>
					<Plus className="size-3.5" /> Ще рядок
				</Button>
			</div>

			<div className="grid gap-2 sm:grid-cols-2">
				<div className="space-y-1 text-sm">
					<label htmlFor="explanation" className="font-medium">
						Пояснення
					</label>
					<Input
						id="explanation"
						value={form.explanation}
						onChange={(event) => set({ explanation: event.target.value })}
					/>
				</div>
				<div className="space-y-1 text-sm">
					<label htmlFor="hint" className="font-medium">
						Підказка
					</label>
					<Input
						id="hint"
						value={form.hint}
						onChange={(event) => set({ hint: event.target.value })}
					/>
				</div>
			</div>

			{problems.length === 0 ? null : (
				<Alert variant="destructive">
					<ul className="list-inside list-disc">
						{problems.map((problem) => (
							<li key={problem}>{problem}</li>
						))}
					</ul>
				</Alert>
			)}

			<div className="flex gap-2">
				<Button
					type="button"
					disabled={busy || problems.length > 0}
					onClick={onSubmit}
				>
					{busy ? "Зберігаємо…" : "Додати питання"}
				</Button>
				<Button type="button" variant="outline" onClick={onCancel}>
					Скасувати
				</Button>
			</div>
		</div>
	);
}
