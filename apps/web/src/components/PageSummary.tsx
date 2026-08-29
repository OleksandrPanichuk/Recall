import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PageSummary({ summary }: { readonly summary: string }) {
	if (summary.trim().length === 0) {
		return (
			<p className="px-1 py-2 text-sm text-muted-foreground">
				Напишіть щось або натисніть «/» для команд
			</p>
		);
	}

	return (
		<div className="prose prose-sm max-w-none px-1 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-pre:bg-muted prose-pre:text-foreground prose-code:before:content-none prose-code:after:content-none">
			<Markdown remarkPlugins={[remarkGfm]}>{summary}</Markdown>
		</div>
	);
}
