import { afterEach, describe, expect, test } from "bun:test";
import type { ApiToken } from "@recall/contracts";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { ApiTokens } = await import("@/features/tokens/ui/components/ApiTokens");
const { expiryLabel, lastUsedLabel } = await import(
	"@/features/tokens/ui/components/ApiTokens/ApiTokens.lib"
);

afterEach(() => {
	cleanup();
});

const routed = (element: React.ReactNode) =>
	render(
		<RouterProvider
			router={createRouter({
				routeTree: createRootRoute({ component: () => element }),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);

const token = (over: Partial<ApiToken> = {}): ApiToken => ({
	id: "t1",
	name: "Claude",
	scopes: [],
	createdAt: "2026-01-01T00:00:00.000Z",
	...over,
});

const now = new Date("2026-06-01T00:00:00.000Z");

describe("how a token's life is described", () => {
	test("no expiry says so rather than showing a date", () => {
		expect(expiryLabel(undefined, now)).toBe("без терміну");
	});

	test("a date in the future is shown as a deadline", () => {
		expect(expiryLabel("2026-07-01T00:00:00.000Z", now)).toContain("до ");
	});

	test("a date already past says prostrochenyi, not a deadline", () => {
		expect(expiryLabel("2026-05-01T00:00:00.000Z", now)).toBe("прострочений");
	});

	test("an unparsable date does not render Invalid Date", () => {
		expect(expiryLabel("not a date", now)).toBe("без терміну");
	});

	test("a token nobody has used says that, not a blank", () => {
		expect(lastUsedLabel(undefined)).toBe("ще не використовувався");
		expect(lastUsedLabel("2026-05-01T00:00:00.000Z")).toContain("востаннє");
	});
});

describe("the token list", () => {
	test("says what a token is for when there are none", async () => {
		routed(<ApiTokens tokens={[]} />);

		expect(await screen.findByText(/через MCP/)).toBeDefined();
	});

	test("lists a token with a way to revoke it", async () => {
		routed(<ApiTokens tokens={[token()]} />);

		expect(await screen.findByText("Claude")).toBeDefined();
		expect(screen.getByLabelText("Відкликати Claude")).toBeDefined();
	});

	test("cannot submit an unnamed token", async () => {
		routed(<ApiTokens tokens={[]} />);

		expect(
			(
				(await screen.findByText("Створити токен")).closest(
					"button",
				) as HTMLButtonElement
			).disabled,
		).toBe(true);
	});

	test("offers an expiry, defaulting to none", async () => {
		routed(<ApiTokens tokens={[]} />);

		expect(
			(await screen.findByText("Без терміну"))
				.closest("button")
				?.getAttribute("aria-pressed"),
		).toBe("true");
	});
});
