export const UPLOAD_PATH = "/app/uploads";

export const API_ORIGIN =
	import.meta.env.VITE_API_ORIGIN ?? "http://127.0.0.1:8767";

export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
];
