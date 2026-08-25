import { describe, expect, test } from "bun:test";
import { describePlan, planServices, running, selectionFrom } from "./up.plan";

const FULL = {
	BOT_API_TOKEN: "b".repeat(32),
	ADMIN_PASSPHRASE: "correct horse battery staple",
} as const;

describe("planning what to start", () => {
	test("starts everything when the environment allows it", () => {
		const plan = planServices(FULL);

		expect(running(plan).map((service) => service.name)).toEqual([
			"api",
			"bot",
			"admin",
		]);
	});

	test("keeps the api alone when nothing else is configured", () => {
		const plan = planServices({});

		expect(running(plan).map((service) => service.name)).toEqual(["api"]);
		expect(describePlan(plan)).toEqual([
			"api    http://127.0.0.1:8767/docs",
			"bot    skipped — BOT_API_TOKEN is not set",
			"admin  skipped — neither ADMIN_PASSPHRASE nor MCP_OAUTH_PASSPHRASE is set",
		]);
	});

	test("borrows the OAuth passphrase for the admin", () => {
		const plan = planServices({
			MCP_OAUTH_PASSPHRASE: "correct horse battery staple",
		});

		expect(running(plan).map((service) => service.name)).toEqual([
			"api",
			"admin",
		]);
	});

	test("falls back to the documented ports", () => {
		const plan = planServices(FULL);

		expect(describePlan(plan)).toEqual([
			"api    http://127.0.0.1:8767/docs",
			"bot    starting",
			"admin  http://127.0.0.1:8766",
		]);
	});

	test("takes the ports and hosts from the environment", () => {
		const plan = planServices({
			...FULL,
			ADMIN_PORT: "9100",
			ADMIN_HOST: "192.168.1.10",
		});

		expect(describePlan(plan)).toEqual([
			"api    http://127.0.0.1:8767/docs",
			"bot    starting",
			"admin  http://192.168.1.10:9100",
		]);
	});

	test("prints a reachable url when a service binds every interface", () => {
		const plan = planServices({ ...FULL, ADMIN_HOST: "0.0.0.0" });
		const admin = plan.find((service) => service.name === "admin");

		expect(admin?.host).toBe("0.0.0.0");
		expect(admin?.url).toBe("http://127.0.0.1:8766");
	});

	test("ignores a port that is not a port", () => {
		const plan = planServices({ ...FULL, ADMIN_PORT: "not-a-port" });
		const admin = plan.find((service) => service.name === "admin");

		expect(admin?.port).toBe(8766);
	});

	test("treats a blank value as unset", () => {
		const plan = planServices({ ADMIN_PASSPHRASE: "   ", BOT_API_TOKEN: "  " });

		expect(running(plan).map((service) => service.name)).toEqual(["api"]);
	});
});

describe("restricting the plan", () => {
	test("keeps only what was asked for", () => {
		const plan = planServices(FULL, ["admin"]);

		expect(running(plan).map((service) => service.name)).toEqual(["admin"]);
		expect(describePlan(plan)).toEqual([
			"api    skipped — not selected by --only",
			"bot    skipped — not selected by --only",
			"admin  http://127.0.0.1:8766",
		]);
	});

	test("still refuses a service the environment cannot support", () => {
		const plan = planServices({}, ["admin"]);

		expect(running(plan)).toEqual([]);
	});
});

describe("reading --only", () => {
	test("reads a comma-separated list", () => {
		expect(selectionFrom(["--only", "bot,admin"])).toEqual({
			only: ["bot", "admin"],
			unknown: [],
		});
	});

	test("reads the --only=value form", () => {
		expect(selectionFrom(["--only=admin"])).toEqual({
			only: ["admin"],
			unknown: [],
		});
	});

	test("reports a name it does not know", () => {
		expect(selectionFrom(["--only", "bot,telegram"])).toEqual({
			only: ["bot"],
			unknown: ["telegram"],
		});
	});

	test("means everything when the flag is absent", () => {
		expect(selectionFrom(["--raw"])).toEqual({ only: [], unknown: [] });
	});

	test("survives a flag with nothing after it", () => {
		expect(selectionFrom(["--only"])).toEqual({ only: [], unknown: [] });
	});
});
