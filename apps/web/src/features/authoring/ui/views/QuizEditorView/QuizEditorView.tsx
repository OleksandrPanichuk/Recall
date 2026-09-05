import type { QuizDetail } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
	DIFFICULTY_LABELS,
	STATUS_LABELS,
	TYPE_LABELS,
} from "@/features/authoring/constants/question-types";
import {
	addQuestions,
	archiveQuizSet,
	deleteQuestion,
	publishQuizSet,
	updateQuestion,
} from "@/features/authoring/lib/authoring.api";
import {
	changesFrom,
	emptyForm,
	formFor,
	toDraft,
} from "@/features/authoring/lib/drafts";
import { questionCount } from "@/features/authoring/lib/plurals";
import { QuestionDraftForm } from "@/features/authoring/ui/components/QuestionDraftForm";
import { PageHeading } from "@/shared/ui/components/PageHeading";

interface Props {
	readonly quiz: QuizDetail;
}

export function QuizEditorView({ quiz }: Props) {
	const router = useRouter();
	const [form, setForm] = useState(emptyForm);
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	const run = async (work: () => Promise<void>) => {
		setBusy(true);
		setFailure(null);

		try {
			await work();
			await router.invalidate();
		} catch {
			setFailure("Не вдалося зберегти. Спробуйте ще раз.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-5">
			<PageHeading
				title={quiz.title}
				caption={`${STATUS_LABELS[quiz.status] ?? quiz.status} · ${questionCount(quiz.questions.length)}`}
			/>

			{failure === null ? null : <Alert variant="destructive">{failure}</Alert>}

			<div className="flex flex-wrap gap-2">
				<Button
					disabled={
						busy || quiz.questions.length === 0 || quiz.status === "published"
					}
					onClick={() =>
						void run(async () => {
							await publishQuizSet({ data: quiz.id });
						})
					}
				>
					Опублікувати
				</Button>
				<Button
					variant="outline"
					disabled={busy || quiz.status === "archived"}
					onClick={() =>
						void run(async () => {
							await archiveQuizSet({ data: quiz.id });
						})
					}
				>
					В архів
				</Button>
			</div>

			<section className="space-y-2">
				{quiz.questions.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Питань ще немає. Опублікувати можна лише набір, у якому є хоча б
						одне.
					</p>
				) : (
					quiz.questions.map((question, index) =>
						editing === question.id ? (
							<Card key={question.id}>
								<CardContent className="pt-5">
									<QuestionDraftForm
										form={form}
										busy={busy}
										typeLocked
										submitLabel="Зберегти питання"
										onChange={setForm}
										onCancel={() => {
											setEditing(null);
											setForm(emptyForm());
										}}
										onSubmit={() =>
											void run(async () => {
												await updateQuestion({
													data: {
														quizSetId: quiz.id,
														questionId: question.id,
														...changesFrom(form),
													},
												});
												setEditing(null);
												setForm(emptyForm());
											})
										}
									/>
								</CardContent>
							</Card>
						) : (
							<Card key={question.id}>
								<CardContent className="flex items-start gap-3 pt-4">
									<span className="w-6 shrink-0 text-sm text-muted-foreground">
										{index + 1}
									</span>
									<div className="min-w-0 flex-1 space-y-1">
										<p className="text-sm">{question.prompt}</p>
										<div className="flex flex-wrap gap-1.5">
											<Badge>
												{TYPE_LABELS[question.type] ?? question.type}
											</Badge>
											<Badge variant="outline">
												{DIFFICULTY_LABELS[question.difficulty] ??
													question.difficulty}
											</Badge>
										</div>
									</div>
									<button
										type="button"
										aria-label={`Редагувати питання ${index + 1}`}
										disabled={busy}
										onClick={() => {
											setAdding(false);
											setForm(formFor(question));
											setEditing(question.id);
										}}
										className="flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
									>
										<Pencil className="size-4" />
									</button>
									<button
										type="button"
										aria-label={`Видалити питання ${index + 1}`}
										disabled={busy}
										onClick={() =>
											void run(async () => {
												await deleteQuestion({
													data: { quizSetId: quiz.id, questionId: question.id },
												});
											})
										}
										className="flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
									>
										<Trash2 className="size-4" />
									</button>
								</CardContent>
							</Card>
						),
					)
				)}
			</section>

			<Card>
				<CardContent className="pt-5">
					{adding && editing === null ? (
						<QuestionDraftForm
							form={form}
							busy={busy}
							onChange={setForm}
							onCancel={() => {
								setAdding(false);
								setForm(emptyForm());
							}}
							onSubmit={() =>
								void run(async () => {
									await addQuestions({
										data: { quizSetId: quiz.id, questions: [toDraft(form)] },
									});
									setForm(emptyForm());
									setAdding(false);
								})
							}
						/>
					) : (
						<Button variant="outline" onClick={() => setAdding(true)}>
							<Plus className="size-4" /> Додати питання
						</Button>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
