export const SENT_NOTICE =
	"Якщо такий акаунт існує, ми надіслали посилання на пошту. Воно діє 30 хвилин.";

const MESSAGES: Readonly<Record<string, string>> = {
	INVALID_EMAIL_OR_PASSWORD: "Невірна пошта або пароль.",
	USER_ALREADY_EXISTS: "Акаунт із такою поштою вже існує.",
	PASSWORD_TOO_SHORT: "Пароль закороткий.",
	INVALID_TOKEN: "Посилання прострочене або вже використане.",
	RESET_PASSWORD_DISABLED:
		"Відновлення пароля не налаштоване на цьому сервері.",
};

export const failureText = (message: string | undefined): string => {
	if (message === undefined) {
		return "Не вдалося. Спробуйте ще раз.";
	}

	if (message.toLowerCase().includes("too many requests")) {
		return "Забагато спроб. Зачекайте трохи.";
	}

	return MESSAGES[message] ?? message;
};
