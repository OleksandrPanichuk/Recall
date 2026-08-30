import { z } from "zod";
import {
	MAX_DESIRED_RETENTION,
	MAX_INTERVAL_LIMIT_DAYS,
	MAX_INTERVALS,
	MAX_REPETITIONS_LIMIT,
	MIN_DESIRED_RETENTION,
} from "@/domain/repetition/repetition";

const days = z.number().int().min(1).max(MAX_INTERVAL_LIMIT_DAYS);

export const quizSettingsShape = {
	quizSetId: z.string().trim().min(1).max(64).optional(),
	scheduler: z.enum(["ladder", "fsrs"]).optional(),
	desiredRetention: z
		.number()
		.min(MIN_DESIRED_RETENTION)
		.max(MAX_DESIRED_RETENTION)
		.optional(),
	intervalsDays: z.array(days).min(1).max(MAX_INTERVALS).optional(),
	maxIntervalDays: days.optional(),
	maxRepetitions: z.number().int().min(1).max(MAX_REPETITIONS_LIMIT).optional(),
	shuffleOptions: z.boolean().optional(),
	shuffleQuestions: z.boolean().optional(),
	examMode: z.boolean().optional(),
	inheritGlobal: z.boolean().optional(),
};

export const quizSettingsScopeShape = {
	quizSetId: z.string().trim().min(1).max(64).optional(),
};
