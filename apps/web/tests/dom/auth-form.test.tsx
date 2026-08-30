import { afterEach, describe, expect, test } from "bun:test";
import type { Credentials } from "@/features/auth/lib/auth.types";
import { failureText } from "@/features/auth/ui/views/auth-views.constants";

const { cleanup, fireEvent, render, screen, waitFor } = await import(
	"@testing-library/react"
);
const { CredentialsForm } = await import(
	"@/features/auth/ui/components/CredentialsForm"
);

afterEach(() => {
	cleanup();
});

const fill = (label: string, value: string) => {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const open = (withName: boolean, answer: string | null = null) => {
	const sent: Credentials[] = [];

	render(
		<CredentialsForm
			submitLabel="Увійти"
			withName={withName}
			onSubmit={async (credentials) => {
				sent.push(credentials);

				return answer;
			}}
		/>,
	);

	return sent;
};

describe("the credentials form", () => {
	test("sends what was typed", async () => {
		const sent = open(false);

		fill("Пошта", "someone@example.com");
		fill("Пароль", "correct horse battery staple");
		fireEvent.submit(
			screen.getByText("Увійти").closest("form") as HTMLFormElement,
		);

		await waitFor(() => expect(sent).toHaveLength(1));
		expect(sent[0]).toMatchObject({
			email: "someone@example.com",
			password: "correct horse battery staple",
		});
	});

	test("asks for a name only when registering", () => {
		open(false);

		expect(screen.queryByLabelText("Імʼя")).toBeNull();

		cleanup();
		open(true);

		expect(screen.getByLabelText("Імʼя")).toBeDefined();
	});

	test("shows why the attempt was refused", async () => {
		open(false, "Невірна пошта або пароль.");

		fill("Пошта", "someone@example.com");
		fill("Пароль", "wrong");
		fireEvent.submit(
			screen.getByText("Увійти").closest("form") as HTMLFormElement,
		);

		expect(await screen.findByText("Невірна пошта або пароль.")).toBeDefined();
	});
});

describe("turning an api refusal into something readable", () => {
	test("names the common ones", () => {
		expect(failureText("INVALID_EMAIL_OR_PASSWORD")).toBe(
			"Невірна пошта або пароль.",
		);
		expect(failureText("USER_ALREADY_EXISTS")).toContain("вже існує");
	});

	test("explains the rate limit in words, not a status code", () => {
		expect(failureText("Too many requests. Please try again later.")).toContain(
			"Забагато спроб",
		);
	});

	test("never leaves the reader with nothing", () => {
		expect(failureText(undefined)).toContain("Спробуйте ще раз");
	});
});
