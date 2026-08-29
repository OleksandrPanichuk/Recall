import type {
	AnswerQuestionResult,
	CurrentQuestionView,
} from "@recall/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, Flag } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { QuestionCard } from "@/components/QuestionCard";
import { ScoreSummary } from "@/components/ScoreSummary";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { VerdictPanel } from "@/components/VerdictPanel";
import { answerQuestion, finishAttempt, startAttempt } from "@/lib/practice";

export const Route = createFileRoute("/practice/$quizId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : startAttempt({ data: params.quizId }),
	component: Practice,
});

interface Answer {
	readonly selectedOptionPositions?: readonly number[];
	readonly typedAnswer?: string;
	readonly revealed?: boolean;
}

function Practice() {
	const loaded = Route.useLoaderData();
	const { quizId } = Route.useParams();
	const [current, setCurrent] = useState<CurrentQuestionView | null>(
		loaded?.current ?? null,
	);
	const [pending, setPending] = useState<CurrentQuestionView | null>(null);
	const [verdict, setVerdict] = useState<AnswerQuestionResult | null>(null);
	const [finished, setFinished] = useState<{
		readonly attemptId: string;
		readonly correct: number;
		readonly total: number;
		readonly percentage: number;
	} | null>(null);
	const [busy, setBusy] = useState(false);

	if (loaded === null) {
		return <SignInPrompt />;
	}

	const send = async (answer: Answer): Promise<void> => {
		const question = current?.question;

		if (question === undefined || busy) {
			return;
		}

		setBusy(true);

		const answered = await answerQuestion({
			data: { questionId: question.id, ...answer },
		});

		setVerdict(answered.result);
		setPending(answered.current);
		setBusy(false);
	};

	const next = (): void => {
		setVerdict(null);
		setCurrent(pending);
		setPending(null);
	};

	const finish = async (): Promise<void> => {
		setBusy(true);

		const result = await finishAttempt();

		setFinished({
			attemptId: result.attemptId,
			correct: result.score.correct,
			total: result.score.total,
			percentage: result.score.percentage,
		});
		setBusy(false);
	};

	if (finished !== null) {
		return (
			<>
				<PageHeading title="Спроба завершена" />
				<Card>
					<CardContent className="space-y-4 pt-5">
						<ScoreSummary
							score={{
								correct: finished.correct,
								total: finished.total,
								percentage: finished.percentage,
							}}
						/>
						<div className="flex flex-wrap gap-2">
							<Link
								to="/attempts/$attemptId"
								params={{ attemptId: finished.attemptId }}
							>
								<Button>Розібрати відповіді</Button>
							</Link>
							<Link to="/quizzes/$quizId" params={{ quizId }}>
								<Button variant="ghost">До набору</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</>
		);
	}

	if (current?.question === undefined) {
		return (
			<>
				<PageHeading
					title="Питання закінчились"
					caption="Завершіть спробу, щоб побачити результат."
				/>
				<Button size="lg" disabled={busy} onClick={finish}>
					<Flag />
					Завершити спробу
				</Button>
			</>
		);
	}

	return (
		<div className="space-y-6">
			<QuestionCard
				view={current}
				question={current.question}
				disabled={busy || verdict !== null}
				onAnswer={send}
			/>

			{verdict === null ? (
				<Button
					variant="ghost"
					size="sm"
					disabled={busy}
					onClick={() => send({ revealed: true })}
				>
					<Eye />
					Показати відповідь
				</Button>
			) : (
				<div className="space-y-4">
					<VerdictPanel verdict={verdict} />
					<Button
						size="lg"
						className="w-full"
						disabled={busy}
						onClick={pending?.question === undefined ? finish : next}
					>
						{pending?.question === undefined ? (
							<>
								<Flag />
								Завершити спробу
							</>
						) : (
							<>
								Далі
								<ArrowRight />
							</>
						)}
					</Button>
				</div>
			)}

			<Link to="/quizzes/$quizId" params={{ quizId }}>
				<Button variant="ghost" size="sm">
					<ArrowLeft />
					до набору
				</Button>
			</Link>
		</div>
	);
}
