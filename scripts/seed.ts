import { createApplication } from "@/composition/create-application";
import { EnvironmentError, loadEnvironment } from "@/infrastructure/config/env";

/**
 * Publishes one small set so the bot can be exercised end to end before the MCP
 * server is wired into Claude. Real content comes from `quiz_add_questions`;
 * this exists only so the first run has something to answer.
 */
const QUESTIONS = [
	{
		type: "single_choice" as const,
		prompt: "Що означає WAL у SQLite?",
		difficulty: "easy" as const,
		topic: "SQLite",
		explanation:
			"Write-ahead log: зміни спершу пишуться в окремий журнал, а вже потім переносяться у файл бази.",
		options: [
			{ text: "Write-ahead log", isCorrect: true },
			{ text: "Weekly audit log", isCorrect: false },
			{ text: "Write-all-later", isCorrect: false },
		],
	},
	{
		type: "true_false" as const,
		prompt: "У WAL-режимі кілька читачів можуть працювати одночасно з писачем.",
		difficulty: "medium" as const,
		topic: "SQLite",
		explanation:
			"Так — саме тому WAL і вмикають: читачі бачать останній консистентний знімок і не блокують писача.",
		options: [
			{ text: "Так", isCorrect: true },
			{ text: "Ні", isCorrect: false },
		],
	},
	{
		type: "multiple_choice" as const,
		prompt: "Які з цих кроків роблять backup SQLite консистентним?",
		difficulty: "hard" as const,
		topic: "Операції",
		explanation:
			"VACUUM INTO і backup API читають у транзакції. Проста копія файлу може лишити останні записи у -wal.",
		options: [
			{ text: "VACUUM INTO", isCorrect: true },
			{ text: "SQLite backup API", isCorrect: true },
			{ text: "cp quiz.sqlite backup.sqlite", isCorrect: false },
		],
	},
];

try {
	const environment = loadEnvironment();
	const application = createApplication({
		databasePath: environment.databasePath,
		timezone: environment.appTimezone,
	});

	const { quizSetId } = await application.createQuizSet.execute({
		title: "SQLite: основи",
		language: "uk",
		description: "Демонстраційний набір для першого запуску",
		tags: ["demo", "sqlite"],
	});

	const added = await application.addQuestions.execute({
		quizSetId,
		questions: QUESTIONS,
	});

	await application.publishQuizSet.execute({ quizSetId });
	application.close();

	console.log(
		added.alreadyPresent
			? `Set ${quizSetId} already had these questions; nothing added.`
			: `Published ${quizSetId} with ${added.addedQuestionIds.length} questions. Open the bot and press /start.`,
	);
} catch (error) {
	console.error(
		error instanceof EnvironmentError || error instanceof Error
			? error.message
			: String(error),
	);
	process.exit(1);
}
