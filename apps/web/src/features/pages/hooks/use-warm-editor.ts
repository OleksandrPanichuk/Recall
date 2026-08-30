import { useEffect } from "react";

const WARM_EDITOR_DELAY_MS = 1500;

export function useWarmEditor(): void {
	useEffect(() => {
		const warm = () => {
			void import("@/features/pages/ui/components/NotionEditor");
		};
		const idle = globalThis.requestIdleCallback;

		if (idle !== undefined) {
			const handle = idle(warm, { timeout: WARM_EDITOR_DELAY_MS });

			return () => globalThis.cancelIdleCallback?.(handle);
		}

		const timer = setTimeout(warm, WARM_EDITOR_DELAY_MS);

		return () => clearTimeout(timer);
	}, []);
}
