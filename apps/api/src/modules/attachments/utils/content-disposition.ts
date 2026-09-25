export type Disposition = "inline" | "attachment";

const extended = (name: string): string =>
	encodeURIComponent(name).replace(
		/['()*]/g,
		(character) =>
			`%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
	);

const quoted = (name: string): string =>
	name.replace(/[^\x20-\x7e]|["\\]/g, "_");

export const contentDisposition = (
	disposition: Disposition,
	originalName?: string,
): string =>
	originalName === undefined || originalName.length === 0
		? disposition
		: `${disposition}; filename="${quoted(originalName)}"; filename*=UTF-8''${extended(originalName)}`;
