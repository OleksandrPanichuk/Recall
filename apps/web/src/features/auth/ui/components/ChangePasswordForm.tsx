import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MIN_PASSWORD_LENGTH } from "@/features/auth/constants/passwords";
import { changePassword } from "@/features/auth/lib/auth.api";
import { failureText } from "@/features/auth/ui/views/auth-views.constants";

export function ChangePasswordForm() {
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	return (
		<Card>
			<CardContent className="pt-5">
				<form
					className="space-y-3"
					onSubmit={async (event) => {
						event.preventDefault();

						const form = event.currentTarget;
						const values = new FormData(form);

						setBusy(true);
						setFailure(null);
						setDone(false);

						try {
							const result = await changePassword({
								data: {
									current: String(values.get("current") ?? ""),
									next: String(values.get("next") ?? ""),
								},
							});

							if (result.ok) {
								form.reset();
								setDone(true);

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
					{done ? <Alert variant="success">Пароль змінено.</Alert> : null}

					<Input
						name="current"
						type="password"
						required
						autoComplete="current-password"
						placeholder="Теперішній пароль"
						aria-label="Теперішній пароль"
					/>
					<Input
						name="next"
						type="password"
						required
						minLength={MIN_PASSWORD_LENGTH}
						autoComplete="new-password"
						placeholder="Новий пароль"
						aria-label="Новий пароль"
					/>
					<Button type="submit" disabled={busy}>
						{busy ? "Зберігаємо…" : "Змінити пароль"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
