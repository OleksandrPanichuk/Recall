import { Lightbulb } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
	readonly hint: string;
	readonly disabled: boolean;
}

export function HintReveal({ hint, disabled }: Props) {
	const [revealed, setRevealed] = useState(false);

	if (revealed) {
		return (
			<p className="flex items-start gap-2 text-sm text-muted-foreground">
				<Lightbulb className="mt-0.5 size-4 shrink-0" />
				<span>{hint}</span>
			</p>
		);
	}

	return (
		<Button
			variant="ghost"
			size="sm"
			disabled={disabled}
			onClick={() => setRevealed(true)}
		>
			<Lightbulb />
			Show a hint
		</Button>
	);
}
