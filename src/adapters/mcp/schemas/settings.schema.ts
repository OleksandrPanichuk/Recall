import { z } from "zod";
import {
	MAX_INTERVAL_LIMIT_DAYS,
	MAX_INTERVALS,
	MAX_REPETITIONS_LIMIT,
} from "@/domain/repetition/repetition";

const days = z.number().int().min(1).max(MAX_INTERVAL_LIMIT_DAYS);

export const quizSettingsShape = {
	quizSetId: z.string().trim().min(1).max(64).optional(),
	intervalsDays: z.array(days).min(1).max(MAX_INTERVALS).optional(),
	maxIntervalDays: days.optional(),
	maxRepetitions: z.number().int().min(1).max(MAX_REPETITIONS_LIMIT).optional(),
	shuffleOptions: z.boolean().optional(),
	shuffleQuestions: z.boolean().optional(),
	inheritGlobal: z.boolean().optional(),
};

export const quizSettingsScopeShape = {
	quizSetId: z.string().trim().min(1).max(64).optional(),
};
