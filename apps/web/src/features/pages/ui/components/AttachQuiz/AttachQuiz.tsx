import type { BrowseView, QuizSummary } from "@recall/contracts";
import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { attachableTo } from "./AttachQuiz.lib";

interface Props {
	readonly view: BrowseView;
	readonly sets: readonly QuizSummary[];
	readonly onAttach: (quizSetId: string) => Promise<void>;
}

export function AttachQuiz({ view, sets, onAttach }: Props) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const attachable = attachableTo(view, sets);

	useEffect(() => {
		if (!open) {
			return;
		}

		const close = (event: MouseEvent) => {
			if (!box.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		document.addEventListener("mousedown", close);

		return () => document.removeEventListener("mousedown", close);
	}, [open]);

	const attach = async (quizSetId: string) => {
		setBusy(true);

		try {
			await onAttach(quizSetId);
			setOpen(false);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div ref={box} className="relative">
			<Button
				variant="ghost"
				size="sm"
				disabled={busy}
				onClick={() => setOpen(!open)}
			>
				<Link2 />
				Attach quiz
			</Button>
			{open ? (
				<div className="absolute right-0 z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
					{attachable.length === 0 ? (
						<p className="px-2 py-1.5 text-sm text-muted-foreground">
							{sets.length === 0
								? "No published quizzes."
								: "Every quiz is already here."}
						</p>
					) : (
						attachable.map((set) => (
							<button
								key={set.id}
								type="button"
								disabled={busy}
								onClick={() => attach(set.id)}
								className="block w-full truncate rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
							>
								{set.title}
							</button>
						))
					)}
				</div>
			) : null}
		</div>
	);
}
