import { useState } from "react";
import type { QuestionView } from "../client";
import { Choice, Field, Toggle } from "../shell";

export const QUESTION_TYPES = [
	"single_choice",
	"multiple_choice",
	"true_false",
	"typed_answer",
	"cloze",
	"ordering",
	"matching",
] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export interface OptionDraft {
	key: string;
	text: string;
	isCorrect: boolean;
	matchKey?: string;
}

export interface QuestionDraft {
	type: string;
	prompt: string;
	difficulty: string;
	topic: string;
	hint: string;
	explanation: string;
	options: OptionDraft[];
}

let nextOptionKey = 0;

const keyed = (option: Omit<OptionDraft, "key">): OptionDraft => {
	nextOptionKey += 1;

	return { ...option, key: `option-${nextOptionKey}` };
};

export const emptyDraft = (): QuestionDraft => ({
	type: "single_choice",
	prompt: "",
	difficulty: "medium",
	topic: "",
	hint: "",
	explanation: "",
	options: [
		keyed({ text: "", isCorrect: true }),
		keyed({ text: "", isCorrect: false }),
	],
});

export const draftOf = (question: QuestionView): QuestionDraft => ({
	type: question.type,
	prompt: question.prompt,
	difficulty: question.difficulty,
	topic: question.topic ?? "",
	hint: question.hint ?? "",
	explanation: question.explanation ?? "",
	options: question.options.map((option) => keyed({ ...option })),
});

export const payloadOf = (draft: QuestionDraft) => ({
	type: draft.type,
	prompt: draft.prompt,
	difficulty: draft.difficulty,
	topic: draft.topic,
	hint: draft.hint,
	explanation: draft.explanation,
	options: draft.options
		.filter((option) => option.text.trim().length > 0)
		.map((option) => ({
			text: option.text,
			isCorrect: option.isCorrect,
			...(option.matchKey === undefined || option.matchKey.trim().length === 0
				? {}
				: { matchKey: option.matchKey }),
		})),
});

export function QuestionEditor({
	draft,
	onChange,
	locked = false,
}: {
	draft: QuestionDraft;
	onChange: (draft: QuestionDraft) => void;
	locked?: boolean;
}) {
	const [showMatchKeys, setShowMatchKeys] = useState(
		draft.type === "matching" ||
			draft.options.some((option) => option.matchKey !== undefined),
	);
	const patch = (change: Partial<QuestionDraft>) =>
		onChange({ ...draft, ...change });
	const patchOption = (index: number, change: Partial<OptionDraft>) =>
		patch({
			options: draft.options.map((option, position) =>
				position === index ? { ...option, ...change } : option,
			),
		});

	return (
		<div>
			{locked ? (
				<p className="muted">Тип: {draft.type} (незмінний при редагуванні)</p>
			) : (
				<Choice
					label="Тип"
					value={draft.type}
					options={QUESTION_TYPES}
					onChange={(type) =>
						patch({
							type,
							options:
								type === "true_false"
									? [
											keyed({ text: "Правда", isCorrect: true }),
											keyed({ text: "Неправда", isCorrect: false }),
										]
									: draft.options,
						})
					}
				/>
			)}

			<Field
				label="Питання"
				value={draft.prompt}
				multiline
				onChange={(prompt) => patch({ prompt })}
			/>

			<div className="row">
				<Choice
					label="Складність"
					value={draft.difficulty}
					options={DIFFICULTIES}
					onChange={(difficulty) => patch({ difficulty })}
				/>
				<Field
					label="Тема"
					value={draft.topic}
					onChange={(topic) => patch({ topic })}
				/>
			</div>

			<Field
				label="Підказка"
				value={draft.hint}
				onChange={(hint) => patch({ hint })}
			/>
			<Field
				label="Пояснення"
				value={draft.explanation}
				multiline
				onChange={(explanation) => patch({ explanation })}
			/>

			<h3>Варіанти</h3>
			<div className="pairs">
				{draft.options.map((option, index) => (
					<div className={showMatchKeys ? "pair" : "opt"} key={option.key}>
						{showMatchKeys ? null : (
							<input
								type="checkbox"
								checked={option.isCorrect}
								style={{ width: "auto" }}
								onChange={(event) =>
									patchOption(index, { isCorrect: event.target.checked })
								}
							/>
						)}
						<input
							value={option.text}
							placeholder="текст"
							onChange={(event) =>
								patchOption(index, { text: event.target.value })
							}
						/>
						{showMatchKeys ? (
							<input
								value={option.matchKey ?? ""}
								placeholder="пара"
								onChange={(event) =>
									patchOption(index, {
										matchKey: event.target.value,
										isCorrect: true,
									})
								}
							/>
						) : null}
						<button
							type="button"
							className="ghost"
							onClick={() =>
								patch({
									options: draft.options.filter(
										(_, position) => position !== index,
									),
								})
							}
						>
							×
						</button>
					</div>
				))}
			</div>

			<div className="row" style={{ marginTop: ".6rem" }}>
				<button
					type="button"
					className="ghost"
					onClick={() =>
						patch({
							options: [
								...draft.options,
								keyed({ text: "", isCorrect: false }),
							],
						})
					}
				>
					+ варіант
				</button>
				<Toggle
					label="Пари (matching)"
					checked={showMatchKeys}
					onChange={setShowMatchKeys}
				/>
			</div>
		</div>
	);
}
