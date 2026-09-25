import type { BrowseView, QuizSummary } from "@recall/contracts";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import { attachableTo } from "./AttachQuiz.lib";

interface Props {
	readonly view: BrowseView;
	readonly sets: readonly QuizSummary[];
	readonly onAttach: (quizSetId: string) => Promise<void>;
}

export function AttachQuiz({ view, sets, onAttach }: Props) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const attachable = attachableTo(view, sets);

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
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" disabled={busy}>
					<Link2 />
					Attach quiz
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="max-h-72 overflow-y-auto p-1">
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
			</PopoverContent>
		</Popover>
	);
}
