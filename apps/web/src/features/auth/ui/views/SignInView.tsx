import { Link, useRouter } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { signIn } from "@/features/auth/lib/auth.api";
import { CredentialsForm } from "@/features/auth/ui/components/CredentialsForm";
import { failureText } from "./auth-views.constants";

export function SignInView() {
	const router = useRouter();

	return (
		<Card className="mx-auto max-w-md">
			<CardHeader>
				<KeyRound className="size-6 text-primary" />
				<CardTitle className="text-xl">Вхід</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<CredentialsForm
					submitLabel="Увійти"
					withName={false}
					onSubmit={async (credentials) => {
						const result = await signIn({ data: credentials });

						if (!result.ok) {
							return failureText(result.message);
						}

						await router.invalidate();
						await router.navigate({ to: "/" });

						return null;
					}}
				/>
				<p className="text-center text-sm">
					<Link
						to="/forgot-password"
						className="text-muted-foreground hover:underline"
					>
						Забули пароль?
					</Link>
				</p>
				<p className="text-center text-sm text-muted-foreground">
					Ще немає акаунта?{" "}
					<Link to="/sign-up" className="text-primary hover:underline">
						Зареєструватись
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
