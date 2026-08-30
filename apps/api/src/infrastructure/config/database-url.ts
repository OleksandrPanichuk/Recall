export function describeDatabaseUrl(url: string): string {
	let parsed: URL;

	try {
		parsed = new URL(url);
	} catch {
		return "(unparseable)";
	}

	const user = parsed.username === "" ? "" : `${parsed.username}@`;

	return `${parsed.protocol}//${user}${parsed.host}${parsed.pathname}`;
}
