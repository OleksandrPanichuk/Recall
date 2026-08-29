import { createFileRoute } from "@tanstack/react-router";
import { loadRepetitions } from "@/features/review/lib/review.api";
import { ReviewView } from "@/features/review/ui/views/ReviewView";

export const Route = createFileRoute("/review")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadRepetitions(),
	component: Review,
});

function Review() {
	const loaded = Route.useLoaderData();

	return (
		<ReviewView
			due={loaded?.due ?? []}
			leeches={loaded?.leeches ?? []}
			signedIn={loaded !== null}
		/>
	);
}
