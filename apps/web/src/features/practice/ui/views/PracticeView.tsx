import type { CurrentQuestionView } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Eye, Flag } from "lucide-react";
import { useEffect, useRef } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { usePracticeKeys } from "@/features/practice/hooks/use-practice-keys";
import { usePracticeSession } from "@/features/practice/hooks/use-practice-session";
import { AttemptFinished } from "@/features/practice/ui/components/AttemptFinished";
import { AttemptInProgress } from "@/features/practice/ui/components/AttemptInProgress";
import { OutOfQuestions } from "@/features/practice/ui/components/OutOfQuestions";
import { QuestionCard } from "@/features/practice/ui/components/QuestionCard";
import { VerdictPanel } from "@/features/practice/ui/components/VerdictPanel";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

interface Props {
	readonly quizId: string;
	readonly started: CurrentQuestionView | null;
	readonly blockedBy: {
		readonly quizSetId: string | null;
		readonly title: string | null;
	} | null;
	readonly signedIn: boolean;
}

export function PracticeView({ quizId, started, blockedBy, signedIn }: Props) {
	const session = usePracticeSession(started);
	const verdictRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (session.verdict !== null) {
			verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
		}
	}, [session.verdict]);

	usePracticeKeys({
		optionCount: 0,
		onPick: () => undefined,
		onAdvance:
			session.verdict === null || session.busy
				? null
				: session.pending?.question === undefined
					? session.finish
					: session.next,
	});

	if (!signedIn) {
		return <SignInPrompt />;
	}

	if (blockedBy !== null && session.current === null) {
		return (
			<AttemptInProgress
				title={blockedBy.title}
				quizSetId={blockedBy.quizSetId}
				onAbandon={session.abandon}
			/>
		);
	}

	if (session.finished !== null) {
		return <AttemptFinished finished={session.finished} quizId={quizId} />;
	}

	const current = session.current;

	if (current?.question === undefined) {
		return <OutOfQuestions busy={session.busy} onFinish={session.finish} />;
	}

	const last = session.pending?.question === undefined;

	return (
		<div className="space-y-6">
			<QuestionCard
				view={current}
				question={current.question}
				disabled={session.busy || session.verdict !== null}
				onAnswer={session.send}
			/>

			{session.failure === null ? null : (
				<Alert variant="destructive">{session.failure}</Alert>
			)}

			{session.verdict === null ? (
				<Button
					variant="ghost"
					size="sm"
					disabled={session.busy}
					onClick={() => session.send({ revealed: true })}
				>
					<Eye />
					Показати відповідь
				</Button>
			) : (
				<div ref={verdictRef} className="space-y-4 scroll-mt-4">
					<VerdictPanel verdict={session.verdict} />
					<Button
						size="lg"
						className="w-full"
						disabled={session.busy}
						onClick={last ? session.finish : session.next}
					>
						{last ? (
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
