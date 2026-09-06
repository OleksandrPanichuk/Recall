export const FIELD =
	"w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const ANSWER_LABELS: Readonly<
	Record<"options" | "accepted" | "ordered" | "pairs", string>
> = {
	options: "Answer options",
	accepted: "Accepted answers",
	ordered: "Items in the right order",
	pairs: "Pairs",
};
