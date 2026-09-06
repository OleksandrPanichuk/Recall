import { describe, expect, test } from "bun:test";
import { isOurs, ownsTunnel, portOf, targetsFrom } from "./down.lib";

describe("reading the port an ngrok tunnel forwards to", () => {
	test("a host and port", () => {
		expect(portOf("http://localhost:8767")).toBe(8767);
		expect(portOf("localhost:3000")).toBe(3000);
	});

	test("an address with no port is not a port", () => {
		expect(portOf("localhost")).toBeUndefined();
		expect(portOf("")).toBeUndefined();
	});

	test("a tunnel is ours only when it forwards to one of our ports", () => {
		expect(ownsTunnel("http://localhost:8767", [8767, 3000])).toBe(true);
		expect(ownsTunnel("http://localhost:9999", [8767, 3000])).toBe(false);
	});

	test("someone else's tunnel on another port is left alone", () => {
		expect(ownsTunnel("http://localhost:5173", [8767])).toBe(false);
	});
});

describe("deciding a process belongs to this checkout", () => {
	const root = "/Users/me/projects/recall-quiz";

	test("a command running from this repo is ours", () => {
		expect(isOurs(`bun run ${root}/apps/bot/src/main.ts`, root)).toBe(true);
	});

	test("the same app from another checkout is not", () => {
		expect(isOurs("bun run /Users/me/other/recall-quiz/apps/bot", root)).toBe(
			false,
		);
	});

	test("an unrelated bun process is not", () => {
		expect(isOurs("bun run /Users/me/elsewhere/server.ts", root)).toBe(false);
	});
});

describe("what down goes looking for", () => {
	const services = [
		{ name: "api", port: 8767 },
		{ name: "web", port: 3000 },
		{ name: "bot" },
	];

	test("every listening service, plus the bot's webhook port", () => {
		const ports = targetsFrom(services, 8768)
			.map((target) => target.port)
			.filter((port) => port !== undefined);

		expect(ports).toEqual([8767, 3000, 8768]);
	});

	test("a service with no port is chased by command instead", () => {
		const matches = targetsFrom(services, 8768)
			.map((target) => target.match)
			.filter((match) => match !== undefined);

		expect(matches).toContain("apps/bot/src/main.ts");
		expect(matches).toContain("scripts/up.ts");
	});
});
