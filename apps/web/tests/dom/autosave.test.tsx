import { afterEach, describe, expect, test } from "bun:test";

const { act, cleanup, renderHook, waitFor } = await import(
	"@testing-library/react"
);
const { useAutosave } = await import("@/features/pages/hooks/use-autosave");

afterEach(() => {
	cleanup();
});

const settle = (ms: number) =>
	act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe("autosave", () => {
	test("writes once for a burst of edits", async () => {
		const written: string[] = [];
		const { result } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);
			}, 20),
		);

		act(() => {
			result.current.schedule("a");
			result.current.schedule("ab");
			result.current.schedule("abc");
		});

		expect(result.current.state).toBe("pending");

		await settle(60);

		expect(written).toEqual(["abc"]);
		await waitFor(() => expect(result.current.state).toBe("saved"));
	});

	test("saves immediately when flushed", async () => {
		const written: string[] = [];
		const { result } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);
			}, 10_000),
		);

		act(() => result.current.schedule("now"));
		await act(() => result.current.flush());

		expect(written).toEqual(["now"]);
	});

	test("keeps the text and says so when the save fails", async () => {
		const { result } = renderHook(() =>
			useAutosave(async () => {
				throw new Error("offline");
			}, 10),
		);

		act(() => result.current.schedule("kept"));
		await settle(40);

		await waitFor(() => expect(result.current.state).toBe("failed"));
		expect(result.current.unsaved()).toBe(true);
	});

	test("writes a pending edit when the editor goes away", async () => {
		const written: string[] = [];
		const { result, unmount } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);
			}, 10_000),
		);

		act(() => result.current.schedule("typed then navigated"));
		expect(written).toEqual([]);

		unmount();
		await settle(20);

		expect(written).toEqual(["typed then navigated"]);
	});

	test("writes nothing on unmount when everything was already saved", async () => {
		const written: string[] = [];
		const { result, unmount } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);
			}, 10),
		);

		act(() => result.current.schedule("saved"));
		await settle(40);
		unmount();
		await settle(20);

		expect(written).toEqual(["saved"]);
	});

	test("does nothing until something is scheduled", async () => {
		const written: string[] = [];
		const { result } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);
			}, 10),
		);

		await act(() => result.current.flush());

		expect(written).toEqual([]);
		expect(result.current.state).toBe("idle");
	});
});
