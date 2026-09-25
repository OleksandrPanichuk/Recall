import { afterEach, describe, expect, test } from "bun:test";

const { cleanup, render, screen } = await import("@testing-library/react");
const { PageSummary } = await import(
	"@/features/pages/ui/components/PageSummary"
);
const { sharedUrl } = await import("@/features/pages/lib/uploads");
const { API_ORIGIN } = await import("@/features/pages/lib/uploads.constants");

afterEach(() => {
	cleanup();
});

describe("links and images in a rendered page", () => {
	test("a javascript: link is stripped", () => {
		render(<PageSummary summary="[click me](javascript:alert(1))" />);

		expect(
			screen.getByText("click me").closest("a")?.getAttribute("href") ?? "",
		).not.toContain("javascript");
	});

	test("a javascript: link is stripped on a shared page too", () => {
		render(
			<PageSummary
				summary="[click me](javascript:alert(1))"
				resolveUrl={sharedUrl("token-1")}
			/>,
		);

		expect(
			screen.getByText("click me").closest("a")?.getAttribute("href") ?? "",
		).not.toContain("javascript");
	});

	test("an uploaded image still resolves against the api", () => {
		render(<PageSummary summary="![cell](/app/uploads/abc)" />);

		expect(screen.getByAltText("cell").getAttribute("src")).toBe(
			`${API_ORIGIN}/app/uploads/abc`,
		);
	});

	test("an uploaded image on a shared page goes through the share", () => {
		render(
			<PageSummary
				summary="![cell](/app/uploads/abc)"
				resolveUrl={sharedUrl("token-1")}
			/>,
		);

		expect(screen.getByAltText("cell").getAttribute("src")).toBe(
			`${API_ORIGIN}/public/uploads/token-1/abc`,
		);
	});

	test("an ordinary link is left as it is", () => {
		render(<PageSummary summary="[docs](https://example.com/a)" />);

		expect(screen.getByText("docs").closest("a")?.getAttribute("href")).toBe(
			"https://example.com/a",
		);
	});
});
