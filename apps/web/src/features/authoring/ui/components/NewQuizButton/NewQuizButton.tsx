import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createQuizSet } from "@/features/authoring/lib/authoring.api";
import { DEFAULT_LANGUAGE } from "./NewQuizButton.constants";

interface Props {
	readonly folderId?: string;
}

export function NewQuizButton({ folderId }: Props) {
	const navigate = useNavigate();
	const [naming, setNaming] = useState(false);
	const [title, setTitle] = useState("");
	const [busy, setBusy] = useState(false);

	if (!naming) {
		return (
			<Button variant="outline" size="sm" onClick={() => setNaming(true)}>
				<Plus className="size-3.5" /> Новий набір
			</Button>
		);
	}

	return (
		<form
			className="flex items-center gap-2"
			onSubmit={async (event) => {
				event.preventDefault();

				if (title.trim().length === 0) {
					return;
				}

				setBusy(true);

				try {
					const { quizSetId } = await createQuizSet({
						data: {
							title: title.trim(),
							language: DEFAULT_LANGUAGE,
							folderId,
						},
					});

					await navigate({
						to: "/quizzes/$quizId/edit",
						params: { quizId: quizSetId },
					});
				} finally {
					setBusy(false);
				}
			}}
		>
			<Input
				autoFocus
				value={title}
				aria-label="Назва набору"
				placeholder="Назва набору"
				onChange={(event) => setTitle(event.target.value)}
			/>
			<Button type="submit" size="sm" disabled={busy}>
				{busy ? "…" : "Створити"}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => setNaming(false)}
			>
				Скасувати
			</Button>
		</form>
	);
}
