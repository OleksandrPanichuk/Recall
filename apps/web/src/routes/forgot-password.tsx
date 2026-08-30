import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordView } from "@/features/auth/ui/views/ForgotPasswordView";

export const Route = createFileRoute("/forgot-password")({
	head: () => ({ meta: [{ title: "Забули пароль · Recall" }] }),
	component: ForgotPasswordView,
});
