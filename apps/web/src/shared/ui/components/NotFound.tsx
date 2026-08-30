import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function NotFound() {
	return (
		<Card className="flex flex-col items-center gap-4 p-10 text-center">
			<Compass className="size-8 text-muted-foreground" />
			<div>
				<p className="font-medium">Такої сторінки немає</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Можливо, її видалили або посилання застаріло.
				</p>
			</div>
			<Link to="/">
				<Button variant="outline">До бібліотеки</Button>
			</Link>
		</Card>
	);
}
