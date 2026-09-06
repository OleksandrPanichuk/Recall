import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";
import { aSet } from "../../fixtures/app-shapes";

interface Row {
	readonly question: { id: string; prompt: string };
	readonly quizSetId: string;
	readonly setTitle: string;
	readonly setStatus: string;
	readonly answerCount: number;
}

const available = await postgresAvailable();

let session: AppSession;
let call: AppSession["app"];

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-questions" });
	call = session.app;
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("every question a session has written", () => {
	let published: string;

	test("nothing is listed before anything is written", async () => {
		expect(await json<Row[]>(await call("sets/questions/list"))).toEqual([]);
	});

	test("questions from every set are listed together", async () => {
		published = await aSet(call, "Postgres", ["What is WAL?", "MVCC?"], true);
		await aSet(call, "Bun", ["Which runtime?"], false);

		const rows = await json<Row[]>(await call("sets/questions/list"));

		expect(rows).toHaveLength(3);
		expect(new Set(rows.map((row) => row.setTitle))).toEqual(
			new Set(["Postgres", "Bun"]),
		);
	});

	test("a draft is listed too, and says so", async () => {
		const rows = await json<Row[]>(await call("sets/questions/list"));
		const draft = rows.find((row) => row.setTitle === "Bun");

		expect(draft?.setStatus).toBe("draft");
	});

	test("one set can be asked for on its own", async () => {
		const rows = await json<Row[]>(
			await call("sets/questions/list", { quizSetId: published }),
		);

		expect(rows).toHaveLength(2);
		expect(rows.every((row) => row.quizSetId === published)).toBe(true);
	});

	test("a question nobody has reached is counted at zero", async () => {
		const rows = await json<Row[]>(await call("sets/questions/list"));

		expect(rows.every((row) => row.answerCount === 0)).toBe(true);
	});

	test("and answering one moves its count, not the others'", async () => {
		await call("attempts/start", { quizSetId: published });

		const current = await json<{ question: { id: string } }>(
			await call("attempts/current"),
		);

		await call("attempts/answer", {
			questionId: current.question.id,
			selectedOptionPositions: [0],
		});

		const rows = await json<Row[]>(await call("sets/questions/list"));
		const answered = rows.filter((row) => row.answerCount > 0);

		expect(answered).toHaveLength(1);
		expect(answered[0]?.question.id).toBe(current.question.id);
	});
});
