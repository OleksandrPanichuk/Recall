import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "@/shared/lib/save-state.types";

export const AUTOSAVE_DELAY = 1200;

interface PendingEdit {
	readonly value: string;
	readonly save: (value: string) => Promise<void>;
}

export function useAutosave(
	save: (value: string) => Promise<void>,
	delay = AUTOSAVE_DELAY,
) {
	const [state, setState] = useState<SaveState>("idle");
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pending = useRef<PendingEdit | null>(null);
	const running = useRef<Promise<void> | null>(null);
	const generation = useRef(0);
	const latest = useRef(save);

	latest.current = save;

	const cancelTimer = useCallback(() => {
		if (timer.current !== null) {
			clearTimeout(timer.current);
			timer.current = null;
		}
	}, []);

	const settled = useCallback(async () => {
		while (running.current !== null) {
			await running.current;
		}
	}, []);

	const flush = useCallback(async () => {
		while (running.current !== null) {
			await running.current;
		}

		const edit = pending.current;

		if (edit === null) {
			return;
		}

		cancelTimer();
		pending.current = null;
		setState("saving");

		const started = generation.current;

		const attempt = (async () => {
			try {
				await edit.save(edit.value);
				setState(pending.current === null ? "saved" : "pending");
			} catch {
				if (pending.current === null && generation.current === started) {
					pending.current = edit;
				}

				setState("failed");
			}
		})();

		running.current = attempt;

		try {
			await attempt;
		} finally {
			running.current = null;
		}
	}, [cancelTimer]);

	const schedule = useCallback(
		(value: string) => {
			pending.current = { value, save: latest.current };
			setState("pending");
			cancelTimer();
			timer.current = setTimeout(() => {
				timer.current = null;
				void flush();
			}, delay);
		},
		[cancelTimer, delay, flush],
	);

	const discard = useCallback(async () => {
		generation.current += 1;
		cancelTimer();
		pending.current = null;
		await settled();
		setState("idle");
	}, [cancelTimer, settled]);

	useEffect(
		() => () => {
			cancelTimer();
			void flush();
		},
		[cancelTimer, flush],
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

	return {
		state,
		schedule,
		flush,
		discard,
		unsaved: () => pending.current !== null,
	};
}
