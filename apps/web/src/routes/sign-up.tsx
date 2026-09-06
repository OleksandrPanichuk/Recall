import { createFileRoute } from "@tanstack/react-router";
import { SignUpView } from "@/features/auth/ui/views/SignUpView";

export const Route = createFileRoute("/sign-up")({
	head: () => ({ meta: [{ title: "Sign up · Recall" }] }),
	component: SignUpView,
});
