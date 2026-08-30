import { createFileRoute } from "@tanstack/react-router";
import { loadInsights } from "@/features/statistics/lib/statistics.api";
import { InsightsView } from "@/features/statistics/ui/views/InsightsView";

export const Route = createFileRoute("/insights")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadInsights(),
	head: () => ({ meta: [{ title: "Статистика · Recall" }] }),
	component: Insights,
});

function Insights() {
	return <InsightsView insights={Route.useLoaderData()} />;
}
