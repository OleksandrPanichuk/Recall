import { currentPrincipal } from "@/shared/request-context";

export const callerIsBot = (): boolean =>
	currentPrincipal()?.kind === "instance";
