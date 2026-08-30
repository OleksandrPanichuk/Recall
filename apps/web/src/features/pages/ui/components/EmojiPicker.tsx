import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EMOJI } from "./EmojiPicker.constants";

interface Props {
	readonly icon?: string;
	readonly onPick: (icon: string | undefined) => void;
}

export function EmojiPicker({ icon, onPick }: Props) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);

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

	return (
		<div ref={box} className="relative">
			<button
				type="button"
				aria-label="Іконка сторінки"
				onClick={() => setOpen(!open)}
				className="flex size-12 shrink-0 items-center justify-center rounded-lg text-3xl transition-colors hover:bg-accent"
			>
				{icon ?? <Smile className="size-6 text-muted-foreground" />}
			</button>
			{open ? (
				<div className="absolute z-20 mt-1 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg">
					<div className="grid grid-cols-8 gap-1">
						{EMOJI.map((choice) => (
							<button
								key={choice}
								type="button"
								aria-label={choice}
								onClick={() => {
									onPick(choice);
									setOpen(false);
								}}
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
							onClick={() => {
								onPick(undefined);
								setOpen(false);
							}}
						>
							Прибрати
						</Button>
					)}
				</div>
			) : null}
		</div>
	);
}
