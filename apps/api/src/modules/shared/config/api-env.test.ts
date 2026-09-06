import { describe, expect, test } from "bun:test";
import { hostList } from "./api-env";

describe("the hosts mcp will answer for", () => {
	test("a single host is one entry", () => {
		expect(hostList("127.0.0.1:8767")).toEqual(["127.0.0.1:8767"]);
	});

	test("a comma-separated list is split, not kept whole", () => {
		expect(hostList("127.0.0.1:8767,localhost:8767")).toEqual([
			"127.0.0.1:8767",
			"localhost:8767",
		]);
	});

	test("spaces around a comma are trimmed", () => {
		expect(hostList(" a:1 , b:2 ")).toEqual(["a:1", "b:2"]);
	});

	test("stray commas produce no empty host, which would match nothing", () => {
		expect(hostList("a:1,,b:2,")).toEqual(["a:1", "b:2"]);
	});

	test("unset means no restriction list at all", () => {
		expect(hostList(undefined)).toEqual([]);
		expect(hostList("")).toEqual([]);
	});
});
