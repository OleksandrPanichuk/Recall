import type { Context } from "telegraf";
import type { TelegramUseCases } from "../../bot";
import { currentQuestionScreen } from "../../presenters/question.presenter";
import { render } from "../../screen";

export async function showCurrentQuestion(
	ctx: Context,
	useCases: TelegramUseCases,
): Promise<void> {
	await render(
		ctx,
		currentQuestionScreen(await useCases.getCurrentQuestion.execute({})),
	);
}
