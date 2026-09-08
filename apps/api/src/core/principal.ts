import type { OwnerId } from "./owner";

export interface SessionPrincipal {
	readonly kind: "session";
	readonly owner: OwnerId;
}

export interface BotPrincipal {
	readonly kind: "bot";
	readonly owner: OwnerId;
}

export interface ApiTokenPrincipal {
	readonly kind: "pat";
	readonly owner: OwnerId;
	readonly tokenId: string;
	readonly scopes: readonly string[];
}

export interface McpPrincipal {
	readonly kind: "oauth" | "static-mcp";
	readonly owner: OwnerId;
}

export interface SharePrincipal {
	readonly kind: "share";
	readonly owner: OwnerId;
	readonly pageId: string;
}

export type Principal =
	| SessionPrincipal
	| BotPrincipal
	| ApiTokenPrincipal
	| McpPrincipal
	| SharePrincipal;
