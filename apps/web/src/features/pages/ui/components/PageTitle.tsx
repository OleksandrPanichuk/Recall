import { useEffect, useRef, useState } from "react";

interface Props {
	readonly name: string;
	readonly onRename: (name: string) => Promise<void>;
}

export function PageTitle({ name, onRename }: Props) {
	const [draft, setDraft] = useState(name);
	const [failed, setFailed] = useState(false);
	const known = useRef(name);
	const cancelled = useRef(false);

	useEffect(() => {
		if (known.current !== name) {
			known.current = name;
			setDraft(name);
		}
	}, [name]);

	const commit = async () => {
		if (cancelled.current) {
			cancelled.current = false;
			setDraft(name);
			setFailed(false);

			return;
		}

		const trimmed = draft.trim();

		if (trimmed.length === 0) {
			setDraft(name);

			return;
		}

		if (trimmed === name) {
			return;
		}

		try {
			await onRename(trimmed);
			setFailed(false);
		} catch {
			setFailed(true);
		}
	};

	return (
		<div>
			<input
				aria-label="Page title"
				aria-invalid={failed}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => void commit()}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.currentTarget.blur();
					}

					if (event.key === "Escape") {
						cancelled.current = true;
						event.currentTarget.blur();
					}
				}}
				className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
				placeholder="Untitled"
			/>
			{failed ? (
				<p role="alert" className="mt-1 text-sm text-destructive">
					Could not rename the page. Try again.
				</p>
			) : null}
		</div>
	);
}
