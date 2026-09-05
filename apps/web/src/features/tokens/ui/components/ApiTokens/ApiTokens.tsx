import type { ApiToken } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
	issueApiToken,
	revokeApiToken,
} from "@/features/tokens/lib/tokens.api";
import { EXPIRY_CHOICES, SHOWN_ONCE } from "./ApiTokens.constants";
import { expiryLabel, lastUsedLabel } from "./ApiTokens.lib";

interface Props {
	readonly tokens: readonly ApiToken[];
}

export function ApiTokens({ tokens }: Props) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [days, setDays] = useState<number | undefined>(undefined);
	const [minted, setMinted] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const now = new Date();

	const run = async (work: () => Promise<void>) => {
		setBusy(true);
		setFailure(null);

		try {
			await work();
			await router.invalidate();
		} catch {
			setFailure("Не вдалося. Спробуйте ще раз.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-3">
			{failure === null ? null : <Alert variant="destructive">{failure}</Alert>}

			{minted === null ? null : (
				<Alert variant="success">
					<p className="font-medium">Новий токен</p>
					<code className="mt-1 block break-all font-mono text-xs">
						{minted}
					</code>
					<p className="mt-1 text-xs text-muted-foreground">{SHOWN_ONCE}</p>
				</Alert>
			)}

			{tokens.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Токенів ще немає. Токен дає ШІ доступ до вашої бібліотеки через MCP.
				</p>
			) : (
				tokens.map((token) => (
					<Card key={token.id}>
						<CardContent className="flex items-center gap-3 pt-4">
							<KeyRound className="size-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{token.name}</p>
								<p className="text-xs text-muted-foreground">
									{expiryLabel(token.expiresAt, now)} ·{" "}
									{lastUsedLabel(token.lastUsedAt)}
								</p>
							</div>
							<button
								type="button"
								aria-label={`Відкликати ${token.name}`}
								disabled={busy}
								onClick={() =>
									void run(async () => {
										await revokeApiToken({ data: { tokenId: token.id } });
									})
								}
								className="flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
							>
								<Trash2 className="size-4" />
							</button>
						</CardContent>
					</Card>
				))
			)}

			<Card>
				<CardContent className="pt-5">
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();

							if (name.trim().length === 0) {
								return;
							}

							void run(async () => {
								const issued = await issueApiToken({
									data: { name: name.trim(), expiresInDays: days },
								});

								setMinted(issued.token);
								setName("");
							});
						}}
					>
						<div className="space-y-1.5">
							<label htmlFor="token-name" className="block text-sm font-medium">
								Назва нового токена
							</label>
							<Input
								id="token-name"
								value={name}
								placeholder="Claude на ноутбуці"
								onChange={(event) => setName(event.target.value)}
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							{EXPIRY_CHOICES.map((choice) => (
								<Button
									key={choice.label}
									type="button"
									size="sm"
									variant={days === choice.days ? "default" : "outline"}
									aria-pressed={days === choice.days}
									onClick={() => setDays(choice.days)}
								>
									{choice.label}
								</Button>
							))}
						</div>
						<Button type="submit" disabled={busy || name.trim().length === 0}>
							<Plus className="size-4" />
							{busy ? "Створюємо…" : "Створити токен"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
