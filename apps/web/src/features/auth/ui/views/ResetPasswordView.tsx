import { useRouter } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { resetPassword } from "@/features/auth/lib/auth.api";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/ui/components/CredentialsForm.constants";
import { failureText } from "./auth-views.constants";

interface Props {
	readonly token: string | undefined;
}

export function ResetPasswordView({ token }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	if (token === undefined || token.length === 0) {
		return (
			<Card className="mx-auto max-w-md">
				<CardContent className="pt-6">
					<Alert variant="destructive">
						Посилання неповне. Попросіть нове на сторінці «Забули пароль?».
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="mx-auto max-w-md">
			<CardHeader>
				<KeyRound className="size-6 text-primary" />
				<CardTitle className="text-xl">Новий пароль</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					className="space-y-3"
					onSubmit={async (event) => {
						event.preventDefault();

						const form = new FormData(event.currentTarget);

						setBusy(true);
						setFailure(null);

						try {
							const result = await resetPassword({
								data: {
									token,
									password: String(form.get("password") ?? ""),
								},
							});

							if (result.ok) {
								await router.navigate({ to: "/sign-in" });

								return;
							}

							setFailure(failureText(result.message));
						} finally {
							setBusy(false);
						}
					}}
				>
					{failure === null ? null : (
						<Alert variant="destructive">{failure}</Alert>
					)}
					<Input
						name="password"
						type="password"
						required
						minLength={MIN_PASSWORD_LENGTH}
						autoComplete="new-password"
						placeholder="Новий пароль"
						aria-label="Новий пароль"
					/>
					<Button type="submit" className="w-full" disabled={busy}>
						{busy ? "Зберігаємо…" : "Зберегти"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
