import { afterEach, describe, expect, test } from "bun:test";
import type { ReactNode } from "react";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { AppShell } = await import("@/shared/ui/components/AppShell");

afterEach(() => {
	cleanup();
});

const routed = (node: ReactNode) =>
	render(
		<RouterProvider
			router={createRouter({
				routeTree: createRootRoute({ component: () => node }),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);

const shell = () =>
	routed(
		<AppShell
			viewer={{ name: "Olena" }}
			pages={null}
			account={<button type="button">Sign out</button>}
		>
			<p>content</p>
		</AppShell>,
	);

describe("the menu on a phone", () => {
	test("says whether it is open and which region it controls", async () => {
		shell();

		const menu = await screen.findByRole("button", { name: "Menu" });
		const drawer = document.getElementById(
			menu.getAttribute("aria-controls") ?? "",
		);

		expect(drawer?.tagName).toBe("ASIDE");
		expect(menu.getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(menu);

		expect(menu.getAttribute("aria-expanded")).toBe("true");
	});

	test("the drawer carries sign-out and the theme toggle", async () => {
		shell();

		const menu = await screen.findByRole("button", { name: "Menu" });
		const drawer = document.getElementById(
			menu.getAttribute("aria-controls") ?? "",
		);
		const signOut = screen.getByRole("button", { name: "Sign out" });
		const accountRow = signOut.closest("div")?.parentElement;

		expect(drawer?.contains(signOut)).toBe(true);
		expect(accountRow?.className.split(" ")).not.toContain("hidden");
		expect(
			drawer?.contains(await screen.findByRole("button", { name: /theme/i })),
		).toBe(true);
	});
});
