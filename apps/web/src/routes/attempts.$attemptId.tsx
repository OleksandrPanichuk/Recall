import { createFileRoute } from "@tanstack/react-router";
import { loadAttempt } from "@/features/statistics/lib/statistics.api";
import { AttemptReviewView } from "@/features/statistics/ui/views/AttemptReviewView";

export const Route = createFileRoute("/attempts/$attemptId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadAttempt({ data: params.attemptId }),
	component: AttemptReview,
});

function AttemptReview() {
	return <AttemptReviewView attempt={Route.useLoaderData()} />;
}
