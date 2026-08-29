import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card } from "@/components/ui/Card";

export function PageSummary({ summary }: { readonly summary: string }) {
	return (
		<Card className="px-6 py-5">
			<div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-pre:bg-muted prose-pre:text-foreground prose-code:before:content-none prose-code:after:content-none">
				<Markdown remarkPlugins={[remarkGfm]}>{summary}</Markdown>
			</div>
		</Card>
	);
}
