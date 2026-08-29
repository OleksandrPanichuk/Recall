import { useEffect } from "react";

export interface PracticeKeys {
	readonly optionCount: number;
	readonly onPick: (index: number) => void;
	readonly onAdvance: (() => void) | null;
}

const typing = (target: EventTarget | null): boolean => {
	const element = target as HTMLElement | null;

	return (
		element !== null &&
		(element.tagName === "INPUT" ||
			element.tagName === "TEXTAREA" ||
			element.isContentEditable)
	);
};

export function usePracticeKeys({
	optionCount,
	onPick,
	onAdvance,
}: PracticeKeys): void {
	useEffect(() => {
		const handle = (event: KeyboardEvent): void => {
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			if (
				event.key === "Enter" &&
				onAdvance !== null &&
				!typing(event.target)
			) {
				event.preventDefault();
				onAdvance();

				return;
			}

			if (typing(event.target)) {
				return;
			}

			const digit = Number.parseInt(event.key, 10);

			if (Number.isInteger(digit) && digit >= 1 && digit <= optionCount) {
				event.preventDefault();
				onPick(digit - 1);
			}
		};

		document.addEventListener("keydown", handle);

		return () => document.removeEventListener("keydown", handle);
	}, [optionCount, onPick, onAdvance]);
}
