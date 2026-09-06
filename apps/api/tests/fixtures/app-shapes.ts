import type { AppSession } from "./app-session";
import { bodyOf } from "./app-session";

export interface BrowseShape {
	readonly folderId?: string;
	readonly sets: { id: string; title: string }[];
	readonly attached: { id: string; title: string }[];
	readonly children: { id: string; itemCount: number }[];
}

export interface CurrentShape {
	readonly attemptId: string;
	readonly status: string;
	readonly question?: { id: string };
	readonly index: number;
	readonly total: number;
}

export const aQuestion = (prompt: string) => ({
	type: "single_choice" as const,
	prompt,
	difficulty: "easy" as const,
	options: [
		{ text: "right", isCorrect: true },
		{ text: "wrong", isCorrect: false },
	],
});

export async function aSet(
	call: AppSession["app"],
	title: string,
	prompts: readonly string[],
	publish: boolean,
): Promise<string> {
	const { quizSetId } = await bodyOf<{ quizSetId: string }>(
		await call("sets/create", { title, language: "uk" }),
	);

	if (prompts.length > 0) {
		await call("sets/questions/add", {
			quizSetId,
			questions: prompts.map(aQuestion),
		});
	}

	if (publish) {
		await call("sets/publish", { quizSetId });
	}

	return quizSetId;
}

export async function aPage(
	call: AppSession["app"],
	name: string,
): Promise<string> {
	return (
		await bodyOf<{ folderId: string }>(await call("pages/create", { name }))
	).folderId;
}
