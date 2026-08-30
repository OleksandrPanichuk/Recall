import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";

export const loadRepetitions = createServerFn().handler(async () => ({
	due: await api().listDueRepetitions.execute({}),
	leeches: await api().listLeeches.execute({}),
}));
