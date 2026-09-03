import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "@/shared/lib/save-state.types";

export const AUTOSAVE_DELAY = 1200;

export function useAutosave(
	save: (value: string) => Promise<void>,
	delay = AUTOSAVE_DELAY,
) {
	const [state, setState] = useState<SaveState>("idle");
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pending = useRef<string | null>(null);
	const inFlight = useRef(false);
	const latest = useRef(save);

	latest.current = save;

	const flush = useCallback(async () => {
		const value = pending.current;

		if (value === null || inFlight.current) {
			return;
		}

		pending.current = null;
		inFlight.current = true;
		setState("saving");

		try {
			await latest.current(value);
			setState(pending.current === null ? "saved" : "pending");
		} catch {
			pending.current = value;
			setState("failed");
		} finally {
			inFlight.current = false;
		}
	}, []);

	const schedule = useCallback(
		(value: string) => {
			pending.current = value;
			setState("pending");

			if (timer.current !== null) {
				clearTimeout(timer.current);
			}

			timer.current = setTimeout(flush, delay);
		},
		[delay, flush],
	);

	useEffect(
		() => () => {
			if (timer.current !== null) {
				clearTimeout(timer.current);
			}

			void flush();
		},
		[flush],
	);

	useEffect(() => {
		const leaving = (event: BeforeUnloadEvent): void => {
			if (pending.current === null) {
				return;
			}

			void flush();
			event.preventDefault();
		};

		globalThis.addEventListener("beforeunload", leaving);

		return () => globalThis.removeEventListener("beforeunload", leaving);
	}, [flush]);

	return { state, schedule, flush, unsaved: () => pending.current !== null };
}
