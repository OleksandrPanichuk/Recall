import { VocabularyDirection, type VocabularyItem } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { Check, Languages, Plus, X } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
	addVocabulary,
	updateVocabulary,
} from "@/features/authoring/lib/authoring.api";
import { DIRECTION_LABELS, NOTHING_YET } from "./VocabularyList.constants";
import {
	emptyPair,
	joinAlternatives,
	type PairForm,
	pairProblems,
	toPair,
} from "./VocabularyList.lib";

interface Props {
	readonly quizSetId: string;
	readonly items: readonly VocabularyItem[];
}

export function VocabularyList({ quizSetId, items }: Props) {
	const router = useRouter();
	const [form, setForm] = useState<PairForm>(emptyPair);
	const [editing, setEditing] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [directions, setDirections] = useState<readonly string[]>([
		VocabularyDirection.TermToTranslation,
	]);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const problems = pairProblems(form);

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

	const fields = (
		<div className="space-y-2">
			<Input
				value={form.term}
				aria-label="Термін"
				placeholder="der Zug"
				onChange={(event) => setForm({ ...form, term: event.target.value })}
			/>
			<Input
				value={form.translation}
				aria-label="Переклад"
				placeholder="потяг, поїзд"
				onChange={(event) =>
					setForm({ ...form, translation: event.target.value })
				}
			/>
			<div className="grid gap-2 sm:grid-cols-2">
				<Input
					value={form.transcription}
					aria-label="Транскрипція"
					placeholder="tsuːk"
					onChange={(event) =>
						setForm({ ...form, transcription: event.target.value })
					}
				/>
				<Input
					value={form.example}
					aria-label="Приклад"
					placeholder="Der Zug fährt ab."
					onChange={(event) =>
						setForm({ ...form, example: event.target.value })
					}
				/>
			</div>
			<p className="text-xs text-muted-foreground">
				Кілька варіантів пишіть через кому.
			</p>
			{problems.length === 0 ? null : (
				<Alert variant="destructive">
					<ul className="list-inside list-disc">
						{problems.map((problem) => (
							<li key={problem}>{problem}</li>
						))}
					</ul>
				</Alert>
			)}
		</div>
	);

	return (
		<div className="space-y-3">
			{failure === null ? null : <Alert variant="destructive">{failure}</Alert>}

			{items.length === 0 ? (
				<p className="text-sm text-muted-foreground">{NOTHING_YET}</p>
			) : (
				items.map((item) =>
					editing === item.itemId ? (
						<Card key={item.itemId}>
							<CardContent className="space-y-3 pt-5">
								{fields}
								<div className="flex gap-2">
									<Button
										disabled={busy || problems.length > 0}
										onClick={() =>
											void run(async () => {
												await updateVocabulary({
													data: { itemId: item.itemId, ...toPair(form) },
												});
												setEditing(null);
												setForm(emptyPair());
											})
										}
									>
										<Check className="size-4" /> Зберегти
									</Button>
									<Button
										variant="outline"
										onClick={() => {
											setEditing(null);
											setForm(emptyPair());
										}}
									>
										Скасувати
									</Button>
								</div>
							</CardContent>
						</Card>
					) : (
						<Card key={item.itemId}>
							<CardContent className="flex items-center gap-3 pt-4">
								<Languages className="size-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm">
										<span className="font-medium">
											{joinAlternatives(item.terms)}
										</span>
										{" — "}
										{joinAlternatives(item.translations)}
									</p>
									<div className="mt-0.5 flex flex-wrap items-center gap-1.5">
										{item.transcription === undefined ? null : (
											<span className="text-xs text-muted-foreground">
												[{item.transcription}]
											</span>
										)}
										<Badge>{item.questionIds.length} питань</Badge>
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									disabled={busy}
									onClick={() => {
										setAdding(false);
										setForm({
											term: joinAlternatives(item.terms),
											translation: joinAlternatives(item.translations),
											transcription: item.transcription ?? "",
											example: item.example ?? "",
										});
										setEditing(item.itemId);
									}}
								>
									Змінити
								</Button>
							</CardContent>
						</Card>
					),
				)
			)}

			<Card>
				<CardContent className="pt-5">
					{adding && editing === null ? (
						<div className="space-y-3">
							{fields}
							<div className="flex flex-wrap gap-2">
								{Object.values(VocabularyDirection).map((direction) => (
									<Button
										key={direction}
										type="button"
										size="sm"
										variant={
											directions.includes(direction) ? "default" : "outline"
										}
										aria-pressed={directions.includes(direction)}
										onClick={() =>
											setDirections(
												directions.includes(direction)
													? directions.filter((kept) => kept !== direction)
													: [...directions, direction],
											)
										}
									>
										{DIRECTION_LABELS[direction]}
									</Button>
								))}
							</div>
							<div className="flex gap-2">
								<Button
									disabled={
										busy || problems.length > 0 || directions.length === 0
									}
									onClick={() =>
										void run(async () => {
											await addVocabulary({
												data: {
													quizSetId,
													pairs: [toPair(form)],
													directions,
												},
											});
											setForm(emptyPair());
											setAdding(false);
										})
									}
								>
									<Check className="size-4" /> Додати пару
								</Button>
								<Button
									variant="outline"
									onClick={() => {
										setAdding(false);
										setForm(emptyPair());
									}}
								>
									<X className="size-4" /> Скасувати
								</Button>
							</div>
						</div>
					) : (
						<Button variant="outline" onClick={() => setAdding(true)}>
							<Plus className="size-4" /> Додати пару
						</Button>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
