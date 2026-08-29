import type {
	AnswerQuestionResult,
	CurrentQuestionView,
} from "@recall/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SignInPrompt } from "../components/sign-in-prompt";
import { answerQuestion, finishAttempt, startAttempt } from "../lib/practice";

export const Route = createFileRoute("/practice/$quizId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : startAttempt({ data: params.quizId }),
	component: Practice,
});

interface Finished {
	readonly correct: number;
	readonly total: number;
	readonly attemptId: string;
}

function Practice() {
	const loaded = Route.useLoaderData();
	const { quizId } = Route.useParams();
	const [current, setCurrent] = useState<CurrentQuestionView | null>(
		loaded === null ? null : loaded.current,
	);
	const [verdict, setVerdict] = useState<AnswerQuestionResult | null>(null);
	const [pending, setPending] = useState<CurrentQuestionView | null>(null);
	const [finished, setFinished] = useState<Finished | null>(null);
	const [busy, setBusy] = useState(false);

	if (loaded === null) {
		return <SignInPrompt />;
	}

	const answer = async (position: number): Promise<void> => {
		if (current?.question === undefined || busy) {
			return;
		}

		setBusy(true);

		const answered = await answerQuestion({
			data: {
				questionId: current.question.id,
				selectedOptionPositions: [position],
			},
		});

		// Answering already advanced the attempt server-side and told us where it
		// now stands, so moving on needs no second request — and must not send
		// another answer, which would grade the next question.
		setVerdict(answered.result);
		setPending(answered.current);
		setBusy(false);
	};

	const next = (): void => {
		setVerdict(null);
		setCurrent(pending);
	};

	const finish = async (): Promise<void> => {
		setBusy(true);

		const result = await finishAttempt();

		setFinished({
			correct: result.score.correct,
			total: result.score.total,
			attemptId: result.attemptId,
		});
		setBusy(false);
	};

	if (finished !== null) {
		return (
			<>
				<h1>Спроба завершена</h1>
				<p className="lede">
					{finished.correct} з {finished.total}
				</p>
				<Link
					to="/attempts/$attemptId"
					params={{ attemptId: finished.attemptId }}
				>
					<button type="button" className="primary">
						Розібрати відповіді
					</button>
				</Link>
			</>
		);
	}

	if (current === null || current.question === undefined) {
		return (
			<>
				<h1>Питання закінчились</h1>
				<p className="lede">Завершіть спробу, щоб побачити результат.</p>
				<button
					type="button"
					className="primary"
					disabled={busy}
					onClick={finish}
				>
					Завершити
				</button>
			</>
		);
	}

	const question = current.question;

	return (
		<>
			<div className="meta">
				<span>{current.quizSetTitle}</span>
				<span>
					питання {current.index + 1}/{current.total}
				</span>
			</div>
			<h1 style={{ marginTop: "0.75rem" }}>{question.prompt}</h1>

			<div className="options">
				{question.options.map((option) => (
					<button
						key={option.id}
						type="button"
						disabled={busy || verdict !== null}
						onClick={() => answer(option.position)}
					>
						{option.text}
					</button>
				))}
			</div>

			{verdict === null ? null : (
				<>
					<div className={`verdict ${verdict.isCorrect ? "right" : "wrong"}`}>
						<strong>
							{verdict.isCorrect ? "✅ Правильно" : "❌ Неправильно"}
						</strong>
						{verdict.explanation === undefined ? null : (
							<p style={{ margin: "0.5rem 0 0" }}>{verdict.explanation}</p>
						)}
					</div>
					<button
						type="button"
						className="primary"
						disabled={busy}
						onClick={pending?.question === undefined ? finish : next}
					>
						{pending?.question === undefined ? "Завершити спробу" : "Далі"}
					</button>
				</>
			)}

			<p className="lede" style={{ marginTop: "2rem" }}>
				<Link to="/quizzes/$quizId" params={{ quizId }}>
					← до набору
				</Link>
			</p>
		</>
	);
}
