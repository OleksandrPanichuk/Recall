import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordView } from "@/features/auth/ui/views/ResetPasswordView";

export const Route = createFileRoute("/reset-password")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	head: () => ({ meta: [{ title: "Новий пароль · Recall" }] }),
	component: ResetPassword,
});

function ResetPassword() {
	return <ResetPasswordView token={Route.useSearch().token} />;
}
