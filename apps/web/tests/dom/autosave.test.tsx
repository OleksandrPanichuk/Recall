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

	test("writes an edit made during a save once that save lands", async () => {
		const written: string[] = [];
		let release = () => {};
		const { result } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);

				if (written.length === 1) {
					await new Promise<void>((resolve) => {
						release = resolve;
					});
				}
			}, 10),
		);

		act(() => result.current.schedule("first"));
		await settle(30);

		expect(written).toEqual(["first"]);

		act(() => result.current.schedule("first and more"));
		await settle(30);
		await act(async () => release());
		await settle(20);

		expect(written).toEqual(["first", "first and more"]);
		await waitFor(() => expect(result.current.state).toBe("saved"));
	});

	test("a flush during a save waits for it and then writes the rest", async () => {
		const written: string[] = [];
		let release = () => {};
		const { result } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);

				if (written.length === 1) {
					await new Promise<void>((resolve) => {
						release = resolve;
					});
				}
			}, 10_000),
		);

		let first = Promise.resolve();
		let second = Promise.resolve();

		act(() => {
			result.current.schedule("first");
			first = result.current.flush();
		});
		act(() => {
			result.current.schedule("second");
			second = result.current.flush();
		});
		await act(async () => {
			release();
			await Promise.all([first, second]);
		});

		expect(written).toEqual(["first", "second"]);
	});

	test("a failed save does not overwrite an edit made while it ran", async () => {
		const written: string[] = [];
		let fail = (_: Error) => {};
		const { result } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);

				if (written.length === 1) {
					await new Promise<void>((_, reject) => {
						fail = reject;
					});
				}
			}, 10_000),
		);

		let first = Promise.resolve();

		act(() => {
			result.current.schedule("old");
			first = result.current.flush();
		});
		act(() => result.current.schedule("new"));
		await act(async () => {
			fail(new Error("offline"));
			await first;
		});
		await act(() => result.current.flush());

		expect(written).toEqual(["old", "new"]);
	});

	test("an edit is written with the save it was typed under", async () => {
		const written: string[][] = [];
		const { result, rerender } = renderHook(
			({ target }: { target: string }) =>
				useAutosave(async (value) => {
					written.push([target, value]);
				}, 20),
			{ initialProps: { target: "A" } },
		);

		act(() => result.current.schedule("typed on A"));
		rerender({ target: "B" });
		await settle(60);

		expect(written).toEqual([["A", "typed on A"]]);
	});

	test("a discarded edit is never written", async () => {
		const written: string[] = [];
		const { result, unmount } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);
			}, 20),
		);

		act(() => result.current.schedule("about to be replaced"));
		await act(() => result.current.discard());
		await settle(60);
		unmount();
		await settle(20);

		expect(written).toEqual([]);
		expect(result.current.unsaved()).toBe(false);
	});

	test("a save that fails after being discarded does not come back", async () => {
		const written: string[] = [];
		let fail = (_: Error) => {};
		const { result } = renderHook(() =>
			useAutosave(async (value) => {
				written.push(value);

				if (written.length === 1) {
					await new Promise<void>((_, reject) => {
						fail = reject;
					});
				}
			}, 10_000),
		);

		let first = Promise.resolve();
		let discarding = Promise.resolve();

		act(() => {
			result.current.schedule("before the restore");
			first = result.current.flush();
		});
		act(() => {
			discarding = result.current.discard();
		});
		await act(async () => {
			fail(new Error("offline"));
			await Promise.all([first, discarding]);
		});
		await act(() => result.current.flush());

		expect(written).toEqual(["before the restore"]);
		expect(result.current.unsaved()).toBe(false);
	});
});
