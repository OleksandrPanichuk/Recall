import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Props {
	readonly disabled: boolean;
	onAnswer(typed: string): void;
}

export function TypedAnswerField({ disabled, onAnswer }: Props) {
	const [typed, setTyped] = useState("");

	return (
		<form
			className="flex flex-col gap-2 sm:flex-row"
			onSubmit={(event) => {
				event.preventDefault();

				if (typed.trim().length > 0) {
					onAnswer(typed.trim());
				}
			}}
		>
			<Input
				autoFocus
				type="text"
				aria-label="Your answer"
				value={typed}
				disabled={disabled}
				placeholder="Your answer"
				onChange={(event) => setTyped(event.target.value)}
			/>
			<Button type="submit" disabled={disabled || typed.trim().length === 0}>
				Answer
			</Button>
		</form>
	);
}
