import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface Props {
	readonly reason?: string;
}

export function SignInPrompt({ reason }: Props) {
	return (
		<Card className="mx-auto max-w-lg">
			<CardHeader>
				<KeyRound className="size-6 text-primary" />
				<CardTitle className="text-xl">Sign in to continue</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 text-sm text-muted-foreground">
				{reason === undefined ? null : (
					<Alert variant="destructive">{reason}</Alert>
				)}
				<div className="flex flex-wrap gap-2">
					<Link to="/sign-in">
						<Button>Sign in</Button>
					</Link>
					<Link to="/sign-up">
						<Button variant="outline">Create account</Button>
					</Link>
				</div>
				<p>
					Or send the bot{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
						/login
					</code>{" "}
					— it will hand you a one-time link.
				</p>
			</CardContent>
		</Card>
	);
}
