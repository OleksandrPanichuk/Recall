import { type ReactNode, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/AlertDialog";

interface Props {
	readonly trigger: ReactNode;
	readonly title: string;
	readonly description: string;
	readonly confirmLabel: string;
	readonly onConfirm: () => Promise<void>;
}

export function ConfirmAction({
	trigger,
	title,
	description,
	confirmLabel,
	onConfirm,
}: Props) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (busy) {
					return;
				}

				setOpen(next);
				setFailed(false);
			}}
		>
			<AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				{failed ? (
					<p role="alert" className="text-sm text-destructive">
						That did not go through. Try again.
					</p>
				) : null}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={busy}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						onClick={async (event) => {
							event.preventDefault();
							setBusy(true);
							setFailed(false);

							try {
								await onConfirm();
								setOpen(false);
							} catch {
								setFailed(true);
							} finally {
								setBusy(false);
							}
						}}
					>
						{busy ? "Working…" : confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
