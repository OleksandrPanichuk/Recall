import { Check, Copy, Link, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { shareLink } from "@/shared/constants/sharing";

interface Props {
	readonly token?: string;
	readonly busy: boolean;
	readonly onShare: (rotate: boolean) => Promise<void>;
	readonly onUnshare: () => Promise<void>;
}

export function SharePage({ token, busy, onShare, onUnshare }: Props) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const link =
		token === undefined || typeof window === "undefined"
			? undefined
			: shareLink(window.location.origin, token);

	useEffect(() => {
		if (!open) {
			return;
		}

		const close = (event: MouseEvent) => {
			if (!box.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		document.addEventListener("mousedown", close);

		return () => document.removeEventListener("mousedown", close);
	}, [open]);

	const copy = async () => {
		if (link === undefined) {
			return;
		}

		await navigator.clipboard.writeText(link);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div ref={box} className="relative">
			<Button
				variant="ghost"
				size="sm"
				disabled={busy}
				aria-label="Поділитися сторінкою"
				onClick={() => setOpen(!open)}
			>
				<Link />
				{token === undefined ? "Поділитися" : "Доступна за посиланням"}
			</Button>
			{open ? (
				<div className="absolute right-0 z-20 mt-1 w-80 space-y-2 rounded-lg border border-border bg-popover p-3 shadow-lg">
					{token === undefined ? (
						<>
							<p className="text-sm text-muted-foreground">
								Хто має посилання — читає цю сторінку. Без входу, без права
								змінювати.
							</p>
							<Button
								size="sm"
								className="w-full"
								disabled={busy}
								onClick={() => onShare(false)}
							>
								Створити посилання
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
									disabled={busy || link === undefined}
									onClick={copy}
								>
									{copied ? <Check /> : <Copy />}
									{copied ? "Скопійовано" : "Копіювати"}
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={busy}
									aria-label="Створити нове посилання"
									onClick={() => onShare(true)}
								>
									<RefreshCw />
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={busy}
									aria-label="Закрити доступ"
									onClick={onUnshare}
								>
									<X />
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Нове посилання одразу вимикає старе.
							</p>
						</>
					)}
				</div>
			) : null}
		</div>
	);
}
