export const SHARE_PATH = "/p";

export function shareLink(origin: string, token: string): string {
	return `${origin.replace(/\/+$/, "")}${SHARE_PATH}/${token}`;
}
