export const LOGIN_ERRORS: Readonly<Record<string, string>> = {
	invalid_token:
		"Посилання вже використане або протерміноване. Надішліть боту /login ще раз.",
	unknown_user:
		"Цей Telegram-акаунт ще не має бібліотеки. Почніть з /start у боті.",
	session_failed: "Не вдалося створити сесію. Спробуйте посилання ще раз.",
};

export function loginErrorFor(code: unknown): string | undefined {
	return typeof code === "string" ? LOGIN_ERRORS[code] : undefined;
}
