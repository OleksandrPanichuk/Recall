import type { QuestionRow } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
	STATUS_LABELS,
	TYPE_LABELS,
} from "@/features/authoring/constants/question-types";
import { answers, quizzes } from "@/shared/lib/plural";
import { NotFound } from "@/shared/ui/components/NotFound";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";
import { matching, neverAnswered } from "./QuestionBankView.lib";

interface Props {
	readonly rows: readonly QuestionRow[] | null;
	readonly signedIn: boolean;
}

export function QuestionBankView({ rows, signedIn }: Props) {
	const [query, setQuery] = useState("");

	if (rows === null) {
		return signedIn ? <NotFound /> : <SignInPrompt />;
	}

	const shown = matching(rows, query);
	const untouched = neverAnswered(rows);

	return (
		<>
			<PageHeading
				title="Questions"
				caption={
					rows.length === 0
						? "No questions written yet."
						: `${rows.length} across ${quizzes(new Set(rows.map((row) => row.quizSetId)).size)} · ${untouched} never answered`
				}
			/>

			{rows.length === 0 ? null : (
				<div className="relative mb-4">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						aria-label="Search questions"
						className="pl-9"
						placeholder="Search by text, topic or quiz"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>
			)}

			{shown.length === 0 ? (
				<Card className="p-8 text-center text-sm text-muted-foreground">
					{rows.length === 0
						? "Create a quiz and add questions — they gather here."
						: "Nothing matched."}
				</Card>
			) : (
				<Card className="divide-y divide-border overflow-hidden">
					{shown.map((row) => (
						<div key={row.question.id} className="px-4 py-3.5">
							<p className="text-sm">{row.question.prompt}</p>
							<p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<Link
									to="/quizzes/$quizId/edit"
									params={{ quizId: row.quizSetId }}
									className="hover:underline"
								>
									{row.setTitle}
								</Link>
								{row.setStatus === "published" ? null : (
									<Badge variant="outline">
										{STATUS_LABELS[row.setStatus]}
									</Badge>
								)}
								<span>{TYPE_LABELS[row.question.type]}</span>
								{row.question.topic === undefined ? null : (
									<span>· {row.question.topic}</span>
								)}
								<span>
									·{" "}
									{row.answerCount === 0
										? "never answered"
										: answers(row.answerCount)}
								</span>
							</p>
						</div>
					))}
				</Card>
			)}
		</>
	);
}
