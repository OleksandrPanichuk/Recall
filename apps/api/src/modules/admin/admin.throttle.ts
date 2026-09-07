export const FREE_ATTEMPTS = 5;
export const BASE_DELAY_MS = 500;
export const MAX_DELAY_MS = 30_000;

export function delayAfter(failures: number): number {
	if (failures <= FREE_ATTEMPTS) {
		return 0;
	}

	const doublings = failures - FREE_ATTEMPTS - 1;

	return Math.min(BASE_DELAY_MS * 2 ** doublings, MAX_DELAY_MS);
}

export interface SignInThrottle {
	failed(): number;
	succeeded(): void;
	readonly failures: number;
}

export function createSignInThrottle(): SignInThrottle {
	let failures = 0;

	return {
		failed: () => {
			failures += 1;

			return delayAfter(failures);
		},
		succeeded: () => {
			failures = 0;
		},
		get failures() {
			return failures;
		},
	};
}
