import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function SignInPrompt() {
	return (
		<Card className="mx-auto max-w-lg">
			<CardHeader>
				<KeyRound className="size-6 text-primary" />
				<CardTitle className="text-xl">Увійдіть, щоб продовжити</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 text-sm text-muted-foreground">
				<div className="flex flex-wrap gap-2">
					<Link to="/sign-in">
						<Button>Увійти</Button>
					</Link>
					<Link to="/sign-up">
						<Button variant="outline">Створити акаунт</Button>
					</Link>
				</div>
				<p>
					Або надішліть боту команду{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
						/login
					</code>{" "}
					— він дасть одноразове посилання.
				</p>
			</CardContent>
		</Card>
	);
}
