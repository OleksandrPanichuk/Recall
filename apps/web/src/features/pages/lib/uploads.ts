import { API_ORIGIN, UPLOAD_PATH } from "./uploads.constants";

export const displayUrl = (url: string): string =>
	url.startsWith(UPLOAD_PATH) ? `${API_ORIGIN}${url}` : url;

export async function uploadImage(file: File): Promise<string> {
	const body = new FormData();

	body.append("file", file);

	const response = await fetch(`${API_ORIGIN}${UPLOAD_PATH}`, {
		method: "POST",
		body,
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error(`upload failed with ${response.status}`);
	}

	const { id } = (await response.json()) as { id: string };

	return `${UPLOAD_PATH}/${id}`;
}
