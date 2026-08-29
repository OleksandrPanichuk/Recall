import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInPrompt } from "../components/sign-in-prompt";
import { loadAttempt } from "../lib/practice";

export const Route = createFileRoute("/attempts/$attemptId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadAttempt({ data: params.attemptId }),
	component: AttemptReview,
});

function AttemptReview() {
	const attempt = Route.useLoaderData();

	if (attempt === null) {
		return <SignInPrompt />;
	}

	return (
		<>
			<h1>{attempt.quizSetTitle}</h1>
			<p className="lede">
				{attempt.score.correct} з {attempt.score.total} ·{" "}
				{Math.round(attempt.score.percentage)}%
			</p>

			<ul className="list">
				{attempt.answers.map((answer) => {
					const chosen = new Set(answer.selectedOptionIds);
					const mark = answer.skipped ? "⏭" : answer.isCorrect ? "✅" : "❌";

					return (
						<li
							key={answer.question.id}
							style={{ display: "block", padding: "1rem" }}
						>
							<div>
								<strong>
									{mark} {answer.question.prompt}
								</strong>
							</div>
							<ul
								className="list"
								style={{ marginTop: "0.6rem", gap: "0.25rem" }}
							>
								{answer.question.options.map((option) => (
									<li
										key={option.id}
										style={{
											padding: "0.4rem 0.6rem",
											borderColor: option.isCorrect
												? "var(--right)"
												: chosen.has(option.id)
													? "var(--wrong)"
													: "var(--line)",
										}}
									>
										<span>{option.text}</span>
										<small>
											{option.isCorrect
												? "правильна"
												: chosen.has(option.id)
													? "ваш вибір"
													: ""}
										</small>
									</li>
								))}
							</ul>
							{answer.typedAnswer === undefined ? null : (
								<small>ви написали: {answer.typedAnswer}</small>
							)}
						</li>
					);
				})}
			</ul>

			<p className="lede" style={{ marginTop: "2rem" }}>
				<Link to="/quizzes/$quizId" params={{ quizId: attempt.quizSetId }}>
					← до набору
				</Link>
			</p>
		</>
	);
}
