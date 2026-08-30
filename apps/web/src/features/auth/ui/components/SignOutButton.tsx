import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { signOut } from "@/features/auth/lib/auth.api";

export function SignOutButton() {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	return (
		<button
			type="button"
			aria-label="Вийти"
			disabled={busy}
			onClick={async () => {
				setBusy(true);

				try {
					await signOut();
					await router.invalidate();
					await router.navigate({ to: "/sign-in" });
				} finally {
					setBusy(false);
				}
			}}
			className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
		>
			<LogOut className="size-4" />
		</button>
	);
}
