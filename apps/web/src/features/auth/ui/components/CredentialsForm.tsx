import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Credentials } from "@/features/auth/lib/auth.types";
import { MIN_PASSWORD_LENGTH } from "./CredentialsForm.constants";

interface Props {
	readonly submitLabel: string;
	readonly withName: boolean;
	readonly onSubmit: (credentials: Credentials) => Promise<string | null>;
}

export function CredentialsForm({ submitLabel, withName, onSubmit }: Props) {
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	return (
		<form
			className="space-y-3"
			onSubmit={async (event) => {
				event.preventDefault();

				const form = new FormData(event.currentTarget);

				setBusy(true);
				setFailure(null);

				try {
					setFailure(
						await onSubmit({
							email: String(form.get("email") ?? ""),
							password: String(form.get("password") ?? ""),
							name: withName ? String(form.get("name") ?? "") : undefined,
						}),
					);
				} finally {
					setBusy(false);
				}
			}}
		>
			{failure === null ? null : <Alert variant="destructive">{failure}</Alert>}

			{withName ? (
				<Input
					name="name"
					type="text"
					autoComplete="name"
					placeholder="Як вас звати"
					aria-label="Імʼя"
				/>
			) : null}

			<Input
				name="email"
				type="email"
				required
				autoComplete="email"
				placeholder="you@example.com"
				aria-label="Пошта"
			/>

			<Input
				name="password"
				type="password"
				required
				minLength={withName ? MIN_PASSWORD_LENGTH : undefined}
				autoComplete={withName ? "new-password" : "current-password"}
				placeholder="Пароль"
				aria-label="Пароль"
			/>

			{withName ? (
				<p className="text-xs text-muted-foreground">
					Щонайменше {MIN_PASSWORD_LENGTH} символів.
				</p>
			) : null}

			<Button type="submit" className="w-full" disabled={busy}>
				{busy ? "Хвилинку…" : submitLabel}
			</Button>
		</form>
	);
}
