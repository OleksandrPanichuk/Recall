import type { ApiToken } from "@recall/contracts";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";

const day = (at: string): string => at.slice(0, 10);

export function issuedTokenScreen(name: string, token: string): Screen {
	return {
		text: [
			`Токен «${name}» створено. Він показується один раз:`,
			"",
			token,
			"",
			"Покладіть його в MCP_HTTP_TOKEN або BOT_API_TOKEN клієнта.",
			"Якщо він втік — /tokens і відкликайте.",
		].join("\n"),
		keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
	};
}

export function tokenListScreen(tokens: readonly ApiToken[]): Screen {
	if (tokens.length === 0) {
		return {
			text: "Токенів немає. /token <назва> створює новий.",
			keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
		};
	}

	return {
		text: [
			"Ваші токени:",
			"",
			...tokens.map((token) => {
				const used =
					token.lastUsedAt === undefined
						? "не використовувався"
						: `востаннє ${day(token.lastUsedAt)}`;
				const until =
					token.expiresAt === undefined ? "" : `, до ${day(token.expiresAt)}`;

				return `• ${token.name} — ${used}${until}\n  /revoke ${token.id}`;
			}),
		].join("\n"),
		keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
	};
}

export function tokenRevokedScreen(revoked: boolean): Screen {
	return {
		text: revoked
			? "Токен відкликано. Клієнти з ним більше не мають доступу."
			: "Такого токена немає — можливо, він уже відкликаний.",
		keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
	};
}
