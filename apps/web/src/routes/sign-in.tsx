import { createFileRoute } from "@tanstack/react-router";
import { SignInView } from "@/features/auth/ui/views/SignInView";

export const Route = createFileRoute("/sign-in")({
	head: () => ({ meta: [{ title: "Вхід · Recall" }] }),
	component: SignInView,
});
