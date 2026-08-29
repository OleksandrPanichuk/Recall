import { type ApiErrorName, isApiError } from "@recall/contracts";

export const idInput = (value: unknown): { id: string } => ({
	id: String(value),
});

export const missingAsNull = async <T>(
	load: () => Promise<T>,
	names: readonly ApiErrorName[],
): Promise<T | null> => {
	try {
		return await load();
	} catch (error) {
		if (names.some((name) => isApiError(error, name))) {
			return null;
		}

		throw error;
	}
};
