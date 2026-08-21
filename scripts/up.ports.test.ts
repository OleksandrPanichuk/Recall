import { afterEach, describe, expect, test } from "bun:test";
import {
	isPortFree,
	killCommand,
	openCommand,
	parseLsofHolder,
	parseNetstatHolder,
	waitForHttp,
} from "./up.ports";

const LSOF = "p24823\ncbun\nn127.0.0.1:8765\n";

const NETSTAT = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:8765         0.0.0.0:0              LISTENING       24823
  TCP    127.0.0.1:8766         0.0.0.0:0              LISTENING       31002
  TCP    127.0.0.1:52001        127.0.0.1:8765         ESTABLISHED     991
`;

let server: ReturnType<typeof Bun.serve> | undefined;

const listen = (): number => {
	const listening = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: () => new Response("ok"),
	});

	server = listening;

	return listening.port ?? 0;
};

afterEach(async () => {
	await server?.stop(true);
	server = undefined;
});

describe("naming the process that holds a port", () => {
	test("reads a pid and a command out of lsof", () => {
		expect(parseLsofHolder(LSOF)).toEqual({ pid: 24823, command: "bun" });
	});

	test("survives lsof finding nothing", () => {
		expect(parseLsofHolder("")).toBeUndefined();
	});

	test("reads the listening pid out of netstat", () => {
		expect(parseNetstatHolder(NETSTAT, 8765)).toEqual({ pid: 24823 });
		expect(parseNetstatHolder(NETSTAT, 8766)).toEqual({ pid: 31002 });
	});

	test("ignores rows that only talk to the port", () => {
		expect(parseNetstatHolder(NETSTAT, 52001)).toBeUndefined();
	});

	test("does not confuse a port with its suffix", () => {
		expect(parseNetstatHolder(NETSTAT, 765)).toBeUndefined();
	});

	test("tells you how to stop it on this platform", () => {
		expect(killCommand(24823, "darwin")).toBe("kill 24823");
		expect(killCommand(24823, "win32")).toBe("taskkill /PID 24823 /F");
	});

	test("knows how to open a browser on each platform", () => {
		expect(openCommand("darwin", "http://127.0.0.1:8766")).toEqual([
			"open",
			["http://127.0.0.1:8766"],
		]);
		expect(openCommand("win32", "http://127.0.0.1:8766")).toEqual([
			"cmd",
			["/c", "start", "", "http://127.0.0.1:8766"],
		]);
		expect(openCommand("linux", "http://127.0.0.1:8766")).toEqual([
			"xdg-open",
			["http://127.0.0.1:8766"],
		]);
	});
});

describe("probing a port", () => {
	test("sees a free port as free", async () => {
		const port = listen();

		await server?.stop(true);
		server = undefined;

		expect(await isPortFree("127.0.0.1", port)).toBe(true);
	});

	test("sees a port that something already holds", async () => {
		expect(await isPortFree("127.0.0.1", listen())).toBe(false);
	});

	test("looks at loopback when a service binds every interface", async () => {
		expect(await isPortFree("0.0.0.0", listen())).toBe(false);
	});
});

describe("waiting for a service to answer", () => {
	test("returns as soon as it answers", async () => {
		expect(await waitForHttp(`http://127.0.0.1:${listen()}/`, 5000)).toBe(true);
	});

	test("counts any answer, including a refusal", async () => {
		server = Bun.serve({
			port: 0,
			fetch: () => new Response(null, { status: 401 }),
		});

		expect(
			await waitForHttp(`http://127.0.0.1:${server.port}/api/overview`, 5000),
		).toBe(true);
	});

	test("gives up when nothing is listening", async () => {
		expect(await waitForHttp("http://127.0.0.1:1/", 300)).toBe(false);
	});
});
