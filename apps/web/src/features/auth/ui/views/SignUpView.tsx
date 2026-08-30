import { Link, useRouter } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { signUp } from "@/features/auth/lib/auth.api";
import { CredentialsForm } from "@/features/auth/ui/components/CredentialsForm";
import { failureText } from "./auth-views.constants";

export function SignUpView() {
	const router = useRouter();

	return (
		<Card className="mx-auto max-w-md">
			<CardHeader>
				<UserPlus className="size-6 text-primary" />
				<CardTitle className="text-xl">Реєстрація</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<CredentialsForm
					submitLabel="Створити акаунт"
					withName
					onSubmit={async (credentials) => {
						const result = await signUp({ data: credentials });

						if (!result.ok) {
							return failureText(result.message);
						}

						await router.invalidate();
						await router.navigate({ to: "/" });

						return null;
					}}
				/>
				<p className="text-center text-sm text-muted-foreground">
					Вже маєте акаунт?{" "}
					<Link to="/sign-in" className="text-primary hover:underline">
						Увійти
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
