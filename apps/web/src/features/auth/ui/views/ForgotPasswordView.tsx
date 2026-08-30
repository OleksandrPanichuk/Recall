import { Link } from "@tanstack/react-router";
import { MailQuestion } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { requestReset } from "@/features/auth/lib/auth.api";
import { SENT_NOTICE } from "./auth-views.constants";

export function ForgotPasswordView() {
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(false);

	return (
		<Card className="mx-auto max-w-md">
			<CardHeader>
				<MailQuestion className="size-6 text-primary" />
				<CardTitle className="text-xl">Забули пароль?</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{sent ? (
					<Alert>{SENT_NOTICE}</Alert>
				) : (
					<form
						className="space-y-3"
						onSubmit={async (event) => {
							event.preventDefault();

							const form = new FormData(event.currentTarget);

							setBusy(true);

							try {
								await requestReset({ data: String(form.get("email") ?? "") });
								setSent(true);
							} finally {
								setBusy(false);
							}
						}}
					>
						<Input
							name="email"
							type="email"
							required
							autoComplete="email"
							placeholder="you@example.com"
							aria-label="Пошта"
						/>
						<Button type="submit" className="w-full" disabled={busy}>
							{busy ? "Надсилаємо…" : "Надіслати посилання"}
						</Button>
					</form>
				)}
				<p className="text-center text-sm text-muted-foreground">
					<Link to="/sign-in" className="text-primary hover:underline">
						Повернутись до входу
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
