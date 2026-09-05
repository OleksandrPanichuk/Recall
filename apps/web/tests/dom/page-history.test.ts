import { describe, expect, test } from "bun:test";
import type { PageRevision } from "@recall/contracts";
import {
	changedSince,
	excerptOf,
	sizeOf,
	writtenAt,
	writtenBy,
} from "@/features/pages/ui/components/PageHistory/PageHistory.lib";

const revision = (over: Partial<PageRevision> = {}): PageRevision => ({
	id: "r1",
	title: "Bun",
	summary: "the summary",
	authorKind: "user",
	createdAt: "2026-06-01T10:30:00.000Z",
	...over,
});

describe("who wrote a version", () => {
	test("a person and an AI read differently, because that is the point", () => {
		expect(writtenBy("user")).toBe("ви");
		expect(writtenBy("mcp")).toBe("ШІ");
	});

	test("an author nobody planned for is shown as itself, not as blank", () => {
		expect(writtenBy("something-new")).toBe("something-new");
	});
});

describe("what a version looks like in the list", () => {
	test("an excerpt collapses whitespace and keeps it short", () => {
		expect(excerptOf("  one\n\n two   three ")).toBe("one two three");
		expect(excerptOf("x".repeat(200)).endsWith("…")).toBe(true);
		expect(excerptOf("x".repeat(200)).length).toBeLessThanOrEqual(141);
	});

	test("an empty version says so rather than showing nothing", () => {
		expect(excerptOf(undefined)).toBe("порожня");
		expect(excerptOf("   ")).toBe("порожня");
	});

	test("the size counts characters, including for an empty one", () => {
		expect(sizeOf("abc")).toBe("3 символів");
		expect(sizeOf(undefined)).toBe("0 символів");
	});

	test("an unreadable timestamp is shown as given, not as Invalid Date", () => {
		expect(writtenAt("not a date")).toBe("not a date");
		expect(writtenAt("2026-06-01T10:30:00.000Z")).not.toContain("Invalid");
	});
});

describe("whether a version is worth restoring", () => {
	test("one that matches what is on the page is not", () => {
		expect(changedSince(revision(), "the summary")).toBe(false);
	});

	test("one that differs is", () => {
		expect(changedSince(revision(), "something else")).toBe(true);
	});

	test("an empty version against an empty page is not a change", () => {
		expect(changedSince(revision({ summary: undefined }), "")).toBe(false);
	});
});
