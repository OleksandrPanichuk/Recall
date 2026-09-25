import { Check, Copy, Link, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import { shareLink } from "@/shared/constants/sharing";
import { COPIED_FOR_MS, SHARE_FAILURE } from "./SharePage.constants";

interface Props {
	readonly token?: string;
	readonly busy: boolean;
	readonly onShare: (rotate: boolean) => Promise<void>;
	readonly onUnshare: () => Promise<void>;
}

export function SharePage({ token, busy, onShare, onUnshare }: Props) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const [working, setWorking] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const disabled = busy || working;
	const link =
		token === undefined || typeof window === "undefined"
			? undefined
			: shareLink(window.location.origin, token);

	const run = async (action: () => Promise<void>, failed: string) => {
		setWorking(true);
		setFailure(null);

		try {
			await action();
		} catch {
			setFailure(failed);
		} finally {
			setWorking(false);
		}
	};

	const copy = async () => {
		if (link === undefined) {
			return;
		}

		setFailure(null);

		try {
			await navigator.clipboard.writeText(link);
		} catch {
			setFailure(SHARE_FAILURE.copy);

			return;
		}

		setCopied(true);
		setTimeout(() => setCopied(false), COPIED_FOR_MS);
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				setFailure(null);
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={busy}
					aria-label="Share page"
				>
					<Link />
					{token === undefined ? "Share" : "Shared by link"}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 space-y-2">
				{token === undefined ? (
					<>
						<p className="text-sm text-muted-foreground">
							Anyone with the link can read this page. No sign-in, no editing.
						</p>
						<Button
							size="sm"
							className="w-full"
							disabled={disabled}
							onClick={() => run(() => onShare(false), SHARE_FAILURE.share)}
						>
							Create link
						</Button>
					</>
				) : (
					<>
						<p className="break-all rounded border border-border bg-muted px-2 py-1.5 text-xs">
							{link ?? "…"}
						</p>
						<div className="flex gap-1">
							<Button
								size="sm"
								className="flex-1"
								disabled={disabled || link === undefined}
								onClick={copy}
							>
								{copied ? <Check /> : <Copy />}
								{copied ? "Copied" : "Copy"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={disabled}
								aria-label="Create a new link"
								onClick={() => run(() => onShare(true), SHARE_FAILURE.rotate)}
							>
								<RefreshCw />
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={disabled}
								aria-label="Stop sharing"
								onClick={() => run(onUnshare, SHARE_FAILURE.unshare)}
							>
								<X />
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							A new link switches the old one off at once.
						</p>
					</>
				)}
				{failure === null ? null : (
					<p role="alert" className="text-xs text-destructive">
						{failure}
					</p>
				)}
			</PopoverContent>
		</Popover>
	);
}
