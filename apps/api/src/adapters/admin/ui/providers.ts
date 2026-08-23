import jsonServerProvider from "ra-data-json-server";
import type { AuthProvider, DataProvider } from "react-admin";
import { fetchUtils } from "react-admin";

const httpClient = (url: string, options: fetchUtils.Options = {}) =>
	fetchUtils.fetchJson(url, { ...options, credentials: "same-origin" });

export const dataProvider: DataProvider = jsonServerProvider(
	"/api",
	httpClient,
);

const unauthorised = (): Error => new Error("Not signed in");

export const authProvider: AuthProvider = {
	login: async ({ password }: { password?: string }) => {
		const response = await fetch("/api/session", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ passphrase: password ?? "" }),
		});

		if (!response.ok) {
			throw new Error("Пароль не підходить");
		}
	},

	logout: async () => {
		await fetch("/api/session", { method: "DELETE" });
	},

	checkAuth: async () => {
		const response = await fetch("/api/session");

		if (!response.ok) {
			throw unauthorised();
		}
	},

	checkError: async (error: unknown) => {
		const status = (error as { status?: number }).status;

		if (status === 401 || status === 403) {
			throw unauthorised();
		}
	},

	getIdentity: async () => ({ id: "owner", fullName: "Recall" }),
};
