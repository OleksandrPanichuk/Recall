import type { PageMatch } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface PageSearchProps {
	readonly onSearch: (query: string) => Promise<readonly PageMatch[]>;
}

export function PageSearch({ onSearch }: PageSearchProps) {
	const [query, setQuery] = useState("");
	const [matches, setMatches] = useState<readonly PageMatch[] | null>(null);

	const run = async (next: string) => {
		setQuery(next);

		if (next.trim().length === 0) {
			setMatches(null);

			return;
		}

		setMatches(await onSearch(next));
	};

	return (
		<div className="space-y-2">
			<div className="relative">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					aria-label="Пошук сторінок"
					className="pl-9"
					placeholder="Пошук у конспектах"
					value={query}
					onChange={(event) => run(event.target.value)}
				/>
			</div>
			{matches === null ? null : (
				<Card className="divide-y divide-border overflow-hidden">
					{matches.length === 0 ? (
						<p className="px-4 py-3 text-sm text-muted-foreground">
							Нічого не знайдено.
						</p>
					) : (
						matches.map((match) => (
							<Link
								key={match.folderId}
								to="/folders/$folderId"
								params={{ folderId: match.folderId }}
								className="block px-4 py-3 transition-colors hover:bg-accent/60"
							>
								<p className="font-medium">{match.name}</p>
								{match.excerpt === undefined ? null : (
									<p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
										{match.excerpt}
									</p>
								)}
							</Link>
						))
					)}
				</Card>
			)}
		</div>
	);
}
