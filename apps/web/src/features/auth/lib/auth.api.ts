import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { apiUrl } from "@/shared/lib/api";
import { type Credentials, credentialsOf } from "./auth.types";

const forward = async (
	path: string,
	body: Record<string, unknown>,
): Promise<{ ok: boolean; message?: string }> => {
	const response = await fetch(`${apiUrl()}/api/auth/${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	const cookies = response.headers.getSetCookie();

	if (cookies.length > 0) {
		setResponseHeader("set-cookie", cookies);
	}

	if (response.ok) {
		return { ok: true };
	}

	const failure = (await response.json().catch(() => null)) as {
		message?: string;
	} | null;

	return { ok: false, message: failure?.message };
};

export const signIn = createServerFn({ method: "POST" })
	.inputValidator(credentialsOf)
	.handler(async ({ data }: { data: Credentials }) =>
		forward("sign-in/email", { email: data.email, password: data.password }),
	);

export const signUp = createServerFn({ method: "POST" })
	.inputValidator(credentialsOf)
	.handler(async ({ data }: { data: Credentials }) =>
		forward("sign-up/email", {
			email: data.email,
			password: data.password,
			name: data.name ?? data.email,
		}),
	);

export const signOut = createServerFn({ method: "POST" }).handler(async () =>
	forward("sign-out", {}),
);
