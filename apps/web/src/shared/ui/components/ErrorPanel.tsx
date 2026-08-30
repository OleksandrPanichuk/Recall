import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ErrorPanel({ error }: { readonly error: Error }) {
	return (
		<Card className="space-y-4 p-8 text-center">
			<TriangleAlert className="mx-auto size-8 text-muted-foreground" />
			<div>
				<p className="font-medium">Щось пішло не так</p>
				<p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
					{error.message}
				</p>
			</div>
			<div className="flex flex-wrap justify-center gap-2">
				<Button variant="outline" onClick={() => window.location.reload()}>
					Спробувати ще раз
				</Button>
				<Link to="/">
					<Button variant="ghost">До бібліотеки</Button>
				</Link>
			</div>
		</Card>
	);
}
