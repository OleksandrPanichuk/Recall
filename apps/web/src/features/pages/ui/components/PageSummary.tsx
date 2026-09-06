import "katex/dist/katex.min.css";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { displayUrl } from "@/features/pages/lib/uploads";

interface Props {
	readonly summary: string;
	readonly resolveUrl?: (url: string) => string;
}

export function PageSummary({ summary, resolveUrl = displayUrl }: Props) {
	if (summary.trim().length === 0) {
		return (
			<p className="px-1 py-2 text-sm text-muted-foreground">
				Write something, or press “/” for commands
			</p>
		);
	}

	return (
		<div className="recall-prose prose prose-sm max-w-none px-1 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-code:before:content-none prose-code:after:content-none">
			<Markdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeKatex]}
				urlTransform={resolveUrl}
			>
				{summary}
			</Markdown>
		</div>
	);
}
