import { createServerFn } from "@tanstack/react-start";
import {
	getRequestHeader,
	setResponseHeader,
} from "@tanstack/react-start/server";
import { apiUrl } from "@/shared/lib/api";
import { type Credentials, credentialsOf } from "./auth.types";

const webOrigin = (): string =>
	process.env.WEB_APP_URL ?? "http://127.0.0.1:3000";

const forward = async (
	path: string,
	body: Record<string, unknown>,
	extra: Record<string, string | undefined> = {},
): Promise<{ ok: boolean; message?: string }> => {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};

	for (const [key, value] of Object.entries(extra)) {
		if (value !== undefined) {
			headers[key] = value;
		}
	}

	const response = await fetch(`${apiUrl()}/api/auth/${path}`, {
		method: "POST",
		headers,
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

export const requestReset = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => ({ email: String(value ?? "").trim() }))
	.handler(async ({ data }) =>
		forward("request-password-reset", {
			email: data.email,
			redirectTo: `${webOrigin()}/reset-password`,
		}),
	);

export const resetPassword = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { token: string; password: string };

		return {
			token: String(input.token ?? ""),
			password: String(input.password ?? ""),
		};
	})
	.handler(async ({ data }) =>
		forward("reset-password", {
			token: data.token,
			newPassword: data.password,
		}),
	);

export const changePassword = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { current: string; next: string };

		return {
			current: String(input.current ?? ""),
			next: String(input.next ?? ""),
		};
	})
	.handler(async ({ data }) =>
		forward(
			"change-password",
			{ currentPassword: data.current, newPassword: data.next },
			{ cookie: getRequestHeader("cookie") },
		),
	);
