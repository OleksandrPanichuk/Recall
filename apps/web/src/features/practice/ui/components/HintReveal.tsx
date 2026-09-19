import { Lightbulb } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/Accordion";

interface Props {
	readonly hint: string;
	readonly disabled: boolean;
}

export function HintReveal({ hint, disabled }: Props) {
	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="hint">
				<AccordionTrigger className="h-8 px-3 text-xs" disabled={disabled}>
					<Lightbulb className="size-4 shrink-0" />
					Hint
				</AccordionTrigger>
				<AccordionContent className="max-w-prose px-3 text-muted-foreground">
					{hint}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
