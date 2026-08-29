import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface TypedAnswerFieldProps {
	readonly disabled: boolean;
	onAnswer(typed: string): void;
}

export function TypedAnswerField({
	disabled,
	onAnswer,
}: TypedAnswerFieldProps) {
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
				aria-label="Ваша відповідь"
				value={typed}
				disabled={disabled}
				placeholder="Ваша відповідь"
				onChange={(event) => setTyped(event.target.value)}
			/>
			<Button type="submit" disabled={disabled || typed.trim().length === 0}>
				Відповісти
			</Button>
		</form>
	);
}
