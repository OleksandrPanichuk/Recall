const UPLOAD_REFERENCE = /\/app\/uploads\/([0-9a-fA-F-]{36})/g;

export function referencedUploads(
	markdown: string | undefined,
): ReadonlySet<string> {
	if (markdown === undefined || markdown.length === 0) {
		return new Set();
	}

	const found = new Set<string>();

	for (const match of markdown.matchAll(UPLOAD_REFERENCE)) {
		const id = match[1];

		if (id !== undefined) {
			found.add(id.toLowerCase());
		}
	}

	return found;
}
