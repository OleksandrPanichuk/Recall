import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import { useEffect, useRef, useState } from "react";
import { slashMenu } from "@/lib/editor-menu";

export interface NotionEditorProps {
	readonly markdown: string;
	readonly onChange: (markdown: string) => void;
}

export function NotionEditor({ markdown, onChange }: NotionEditorProps) {
	const host = useRef<HTMLDivElement>(null);
	const initial = useRef(markdown);
	const changed = useRef(onChange);
	const [loading, setLoading] = useState(true);

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
			listener.markdownUpdated((_ctx, next, previous) => {
				if (next !== previous) {
					changed.current(next);
				}
			});
		});

		const created = crepe.create().then(() => {
			if (live) {
				setLoading(false);
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
				<p className="px-1 py-3 text-sm text-muted-foreground">
					Редактор завантажується…
				</p>
			) : null}
		</div>
	);
}
