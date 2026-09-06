import type { SharedPageView as SharedPage } from "@recall/contracts";
import { BrainCircuit } from "lucide-react";
import { sharedUrl } from "@/features/pages/lib/uploads";
import { PageSummary } from "@/features/pages/ui/components/PageSummary";

interface Props {
	readonly token: string;
	readonly page: SharedPage | null;
}

export function SharedPageView({ token, page }: Props) {
	if (page === null) {
		return (
			<main className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
				<h1 className="text-xl font-semibold tracking-tight">
					Такого посилання немає
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Його могли закрити або замінити новим.
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-3xl px-5 py-12 pb-24">
			<article className="space-y-6">
				<header className="flex items-start gap-3">
					{page.icon === undefined ? null : (
						<span className="text-3xl leading-none">{page.icon}</span>
					)}
					<h1 className="text-2xl font-semibold tracking-tight">{page.name}</h1>
				</header>
				<PageSummary
					summary={page.summary ?? ""}
					resolveUrl={sharedUrl(token)}
				/>
			</article>
			<footer className="mt-16 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
				<BrainCircuit className="size-3.5" />
				Сторінка з Recall, доступна лише для читання
			</footer>
		</main>
	);
}
