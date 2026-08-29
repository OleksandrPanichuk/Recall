import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInPrompt } from "../components/sign-in-prompt";
import { loadStatistics } from "../lib/practice";

const percent = (score: { percentage: number }): string =>
	`${Math.round(score.percentage)}%`;

const day = (at?: string): string => (at === undefined ? "—" : at.slice(0, 10));

export const Route = createFileRoute("/quizzes/$quizId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadStatistics({ data: params.quizId }),
	component: Quiz,
});

function Quiz() {
	const statistics = Route.useLoaderData();
	const { quizId } = Route.useParams();

	if (statistics === null) {
		return <SignInPrompt />;
	}

	return (
		<>
			<h1>{statistics.title}</h1>
			<p className="lede">
				{statistics.attempts.length === 0
					? "Ще жодної спроби."
					: `${statistics.attempts.length} спроб(и), середня точність ${percent(statistics.setAccuracy)}`}
			</p>

			<Link to="/practice/$quizId" params={{ quizId }}>
				<button type="button" className="primary">
					Почати проходження
				</button>
			</Link>

			{statistics.attempts.length > 0 ? (
				<>
					<h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>Спроби</h2>
					<ul className="list">
						{statistics.attempts.map((attempt) => (
							<li key={attempt.attemptId}>
								<Link
									to="/attempts/$attemptId"
									params={{ attemptId: attempt.attemptId }}
								>
									{day(attempt.completedAt)}
								</Link>
								<small>
									{attempt.score.correct}/{attempt.score.total} ·{" "}
									{percent(attempt.score)}
								</small>
							</li>
						))}
					</ul>
				</>
			) : null}

			{statistics.topics.length > 0 ? (
				<>
					<h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>Теми</h2>
					<ul className="list">
						{statistics.topics.map((topic) => (
							<li key={topic.topic ?? "—"}>
								<span>{topic.topic ?? "Без теми"}</span>
								<small>
									{topic.correct}/{topic.answered}
								</small>
							</li>
						))}
					</ul>
				</>
			) : null}
		</>
	);
}
