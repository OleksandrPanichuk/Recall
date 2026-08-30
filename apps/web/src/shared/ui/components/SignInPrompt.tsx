import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function SignInPrompt() {
	return (
		<Card className="mx-auto max-w-lg">
			<CardHeader>
				<MessageCircle className="size-6 text-primary" />
				<CardTitle className="text-xl">Увійдіть, щоб продовжити</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 text-sm text-muted-foreground">
				<p>
					Надішліть боту команду{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
						/login
					</code>{" "}
					— він дасть одноразове посилання.
				</p>
				<p>
					Посилання відкриє платформу вже з вашим акаунтом і запамʼятає вас
					надовго.
				</p>
			</CardContent>
		</Card>
	);
}
