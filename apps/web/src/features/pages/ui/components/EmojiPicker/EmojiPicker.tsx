import { Smile } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import { EMOJI } from "./EmojiPicker.constants";

interface Props {
	readonly icon?: string;
	readonly onPick: (icon: string | undefined) => void;
}

export function EmojiPicker({ icon, onPick }: Props) {
	const [open, setOpen] = useState(false);

	const pick = (choice: string | undefined) => {
		onPick(choice);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Page icon"
					className="flex size-12 shrink-0 items-center justify-center rounded-lg text-3xl transition-colors hover:bg-accent"
				>
					{icon ?? <Smile className="size-6 text-muted-foreground" />}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="p-2">
				<div className="grid grid-cols-8 gap-1">
					{EMOJI.map((choice) => (
						<button
							key={choice}
							type="button"
							aria-label={choice}
							onClick={() => pick(choice)}
							className="flex size-8 items-center justify-center rounded text-lg transition-colors hover:bg-accent"
						>
							{choice}
						</button>
					))}
				</div>
				{icon === undefined ? null : (
					<Button
						variant="ghost"
						size="sm"
						className="mt-1 w-full"
						onClick={() => pick(undefined)}
					>
						Remove
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
