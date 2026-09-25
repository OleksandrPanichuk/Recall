const startsWith = (
	body: Uint8Array,
	signature: readonly number[],
	offset = 0,
): boolean =>
	body.length >= offset + signature.length &&
	signature.every((byte, index) => body[offset + index] === byte);

const ascii = (text: string): readonly number[] =>
	[...text].map((character) => character.charCodeAt(0));

const SIGNATURES: readonly {
	readonly type: string;
	readonly matches: (body: Uint8Array) => boolean;
}[] = [
	{
		type: "image/png",
		matches: (body) =>
			startsWith(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	},
	{
		type: "image/jpeg",
		matches: (body) => startsWith(body, [0xff, 0xd8, 0xff]),
	},
	{
		type: "image/gif",
		matches: (body) =>
			startsWith(body, ascii("GIF87a")) || startsWith(body, ascii("GIF89a")),
	},
	{
		type: "image/webp",
		matches: (body) =>
			startsWith(body, ascii("RIFF")) && startsWith(body, ascii("WEBP"), 8),
	},
];

export const imageTypeOf = (body: Uint8Array): string | undefined =>
	SIGNATURES.find((signature) => signature.matches(body))?.type;
