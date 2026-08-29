import type { ReactNode } from "react";

interface Props {
	readonly title: string;
	readonly caption?: string;
	readonly children?: ReactNode;
}

export function PageHeading({ title, caption, children }: Props) {
	return (
		<div className="mb-6 flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{caption === undefined ? null : (
					<p className="mt-1 text-sm text-muted-foreground">{caption}</p>
				)}
			</div>
			{children}
		</div>
	);
}
