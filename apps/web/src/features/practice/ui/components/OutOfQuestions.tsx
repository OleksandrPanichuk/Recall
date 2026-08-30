import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeading } from "@/shared/ui/components/PageHeading";

interface Props {
	readonly busy: boolean;
	readonly onFinish: () => void;
}

export function OutOfQuestions({ busy, onFinish }: Props) {
	return (
		<>
			<PageHeading
				title="Питання закінчились"
				caption="Завершіть спробу, щоб побачити результат."
			/>
			<Button size="lg" disabled={busy} onClick={onFinish}>
				<Flag />
				Завершити спробу
			</Button>
		</>
	);
}
