import { useEffect, useRef, useState } from "react";

interface Props {
	readonly name: string;
	readonly onRename: (name: string) => void;
}

export function PageTitle({ name, onRename }: Props) {
	const [draft, setDraft] = useState(name);
	const known = useRef(name);

	useEffect(() => {
		if (known.current !== name) {
			known.current = name;
			setDraft(name);
		}
	}, [name]);

	const commit = () => {
		const trimmed = draft.trim();

		if (trimmed.length === 0) {
			setDraft(name);

			return;
		}

		if (trimmed !== name) {
			onRename(trimmed);
		}
	};

	return (
		<input
			aria-label="Назва сторінки"
			value={draft}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.currentTarget.blur();
				}

				if (event.key === "Escape") {
					setDraft(name);
					event.currentTarget.blur();
				}
			}}
			className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
			placeholder="Без назви"
		/>
	);
}
