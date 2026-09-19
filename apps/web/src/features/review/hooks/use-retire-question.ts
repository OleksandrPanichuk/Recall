import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { setQuestionRetired } from "@/features/review/lib/review.api";

export function useRetireQuestion() {
	const router = useRouter();
	const [pending, setPending] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	const retire = async (questionId: string, retired: boolean) => {
		setPending(questionId);
		setFailure(null);

		try {
			await setQuestionRetired({ data: { questionId, retired } });
			await router.invalidate();
		} catch {
			setFailure(
				retired
					? "Could not retire that question. Try again."
					: "Could not bring that question back. Try again.",
			);
		} finally {
			setPending(null);
		}
	};

	return { retire, pending, failure };
}
