import jsonServerProvider from "ra-data-json-server";
import type { AuthProvider, DataProvider } from "react-admin";
import { fetchUtils } from "react-admin";

const loadApiUrl = async (): Promise<string> => {
	try {
		const response = await fetch("/config.json");
		const config = (await response.json()) as { apiUrl?: string };

		return config.apiUrl ?? "";
	} catch {
		return "";
	}
};

const apiUrl = await loadApiUrl();

export const apiBase = `${apiUrl}/api`;

const httpClient = (url: string, options: fetchUtils.Options = {}) =>
	fetchUtils.fetchJson(url, { ...options, credentials: "include" });

export const dataProvider: DataProvider = jsonServerProvider(
	apiBase,
	httpClient,
);

const unauthorised = (): Error => new Error("Not signed in");

export const authProvider: AuthProvider = {
	login: async ({ password }: { password?: string }) => {
		const response = await fetch(`${apiBase}/session`, {
			method: "POST",
			credentials: "include",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ passphrase: password ?? "" }),
		});

		if (!response.ok) {
			throw new Error("Пароль не підходить");
		}
	},

	logout: async () => {
		await fetch(`${apiBase}/session`, {
			method: "DELETE",
			credentials: "include",
		});
	},

	checkAuth: async () => {
		const response = await fetch(`${apiBase}/session`, {
			credentials: "include",
		});

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
