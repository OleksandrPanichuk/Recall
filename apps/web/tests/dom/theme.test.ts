import { describe, expect, test } from "bun:test";
import { noFlashScript, THEME_STORAGE_KEY } from "@/shared/constants/theme";

describe("the script that stops the theme flashing", () => {
	test("reads the same key the hook writes", () => {
		expect(noFlashScript()).toContain(`'${THEME_STORAGE_KEY}'`);
	});

	test("adds the dark class for a stored dark choice, and honours the system otherwise", () => {
		const script = noFlashScript();

		expect(script).toContain("t==='dark'");
		expect(script).toContain("prefers-color-scheme: dark");
		expect(script).toContain("classList.add('dark')");
	});

	test("never throws when storage is refused", () => {
		expect(noFlashScript()).toContain("catch(e){}");
	});
});
