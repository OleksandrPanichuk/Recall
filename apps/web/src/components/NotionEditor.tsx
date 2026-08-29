import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import { useEffect, useRef, useState } from "react";
import { slashMenu } from "@/lib/editor-menu";

export interface NotionEditorProps {
	readonly markdown: string;
	readonly onReady: (read: () => string) => void;
	readonly onChange?: () => void;
}

export function NotionEditor({
	markdown,
	onReady,
	onChange,
}: NotionEditorProps) {
	const host = useRef<HTMLDivElement>(null);
	const initial = useRef(markdown);
	const ready = useRef(onReady);
	const changed = useRef(onChange);
	const [loading, setLoading] = useState(true);

	ready.current = onReady;
	changed.current = onChange;

	useEffect(() => {
		const root = host.current;

		if (root === null) {
			return;
		}

		let live = true;
		const crepe = new Crepe({
			root,
			defaultValue: initial.current,
			features: { [Crepe.Feature.Latex]: false },
			featureConfigs: {
				[Crepe.Feature.Placeholder]: {
					text: "Напишіть щось або натисніть «/» для команд",
					mode: "block",
				},
				[Crepe.Feature.BlockEdit]: slashMenu,
			},
		});

		crepe.on((listener) => {
			listener.markdownUpdated(() => changed.current?.());
		});

		const created = crepe.create().then(() => {
			if (live) {
				setLoading(false);
				ready.current(() => crepe.getMarkdown());
			}
		});

		return () => {
			live = false;
			created.then(() => crepe.destroy()).catch(() => undefined);
		};
	}, []);

	return (
		<div className="relative">
			<div ref={host} className="recall-editor" />
			{loading ? (
				<p className="px-4 py-3 text-sm text-muted-foreground">
					Редактор завантажується…
				</p>
			) : null}
		</div>
	);
}
