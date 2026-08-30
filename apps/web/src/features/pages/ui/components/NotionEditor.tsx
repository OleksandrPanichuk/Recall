import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import { useEffect, useRef } from "react";
import { slashMenu } from "@/features/pages/constants/editor-menu";
import { displayUrl, uploadImage } from "@/features/pages/lib/uploads";

interface Props {
	readonly markdown: string;
	readonly onChange: (markdown: string) => void;
	readonly onReady?: () => void;
}

export function NotionEditor({ markdown, onChange, onReady }: Props) {
	const host = useRef<HTMLDivElement>(null);
	const initial = useRef(markdown);
	const changed = useRef(onChange);
	const ready = useRef(onReady);

	changed.current = onChange;
	ready.current = onReady;

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
				[Crepe.Feature.ImageBlock]: {
					onUpload: uploadImage,
					blockOnUpload: uploadImage,
					inlineOnUpload: uploadImage,
					proxyDomURL: displayUrl,
				},
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
				ready.current?.();
			}
		});

		return () => {
			live = false;
			created.then(() => crepe.destroy()).catch(() => undefined);
		};
	}, []);

	return <div ref={host} className="recall-editor" />;
}
