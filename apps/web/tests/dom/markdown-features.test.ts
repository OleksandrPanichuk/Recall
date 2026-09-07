import { describe, expect, test } from "bun:test";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const render = async (markdown: string): Promise<string> =>
	String(
		await unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkMath)
			.use(remarkRehype)
			.use(rehypeKatex)
			.use(rehypeStringify)
			.process(markdown),
	);

describe("what the read-only renderer understands", () => {
	test("inline math becomes katex, not a dollar sign", async () => {
		const html = await render("Energy is $E = mc^2$ exactly.");

		expect(html).toContain("katex");
		expect(html).not.toContain("$E = mc^2$");
	});

	test("block math becomes a display", async () => {
		expect(await render("$$\n\\frac{1}{2}\n$$")).toContain("katex-display");
	});

	test("a table is a table", async () => {
		const html = await render("| a | b |\n| --- | --- |\n| 1 | 2 |");

		expect(html).toContain("<table>");
		expect(html).toContain("<th>");
	});

	test("a task list keeps its checkboxes", async () => {
		const html = await render("- [ ] todo\n- [x] done");

		expect(html).toContain('type="checkbox"');
		expect(html).toContain("checked");
	});

	test("strikethrough, footnotes and rules all survive", async () => {
		expect(await render("~~gone~~")).toContain("<del>");
		expect(await render("a[^1]\n\n[^1]: note")).toContain("footnote");
		expect(await render("---")).toContain("<hr>");
	});

	test("two dollar signs in a sentence are math, as the editor also has it", async () => {
		const html = await render("It cost $5 and then $7.");

		expect(html).toContain("katex");
	});

	test("and a backslash is how you mean the currency", async () => {
		const html = await render("It cost \\$5 and then \\$7.");

		expect(html).not.toContain("katex");
		expect(html).toContain("$5 and then $7.");
	});
});
