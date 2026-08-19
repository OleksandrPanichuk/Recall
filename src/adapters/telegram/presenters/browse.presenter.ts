import type { BrowseView } from "@/application/use-cases/folders/browse-folder";
import type { CallbackAction } from "../callbacks/callback-data.constants";
import { CallbackAction as Action } from "../callbacks/callback-data.constants";
import { MAX_BUTTON_TEXT } from "./question.presenter";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";

export const BROWSE_PAGE_SIZE = 8;

export type LeafAction =
	| typeof CallbackAction.StartSet
	| typeof CallbackAction.StatisticsFor
	| typeof CallbackAction.SettingsFor
	| typeof CallbackAction.MistakesFor
	| typeof CallbackAction.WeakTopicsFor;

interface Entry {
	readonly label: string;
	readonly button: InlineButton;
}

const truncate = (text: string): string => {
	const characters = [...text];

	return characters.length <= MAX_BUTTON_TEXT
		? text
		: `${characters.slice(0, MAX_BUTTON_TEXT - 1).join("")}…`;
};

const breadcrumbOf = (view: BrowseView): string =>
	[...view.breadcrumb.map((crumb) => crumb.name), view.name]
		.filter((name): name is string => name !== undefined)
		.join(" › ");

const headingOf = (view: BrowseView, leaf: LeafAction): string => {
	if (view.folderId !== undefined) {
		return breadcrumbOf(view);
	}

	if (leaf === Action.StatisticsFor) {
		return "Статистика — оберіть набір:";
	}

	if (leaf === Action.MistakesFor) {
		return "Помилки — оберіть набір:";
	}

	if (leaf === Action.WeakTopicsFor) {
		return "Слабкі теми — оберіть набір:";
	}

	return leaf === Action.SettingsFor
		? "Налаштування — оберіть набір:"
		: "Оберіть набір:";
};

export function browseScreen(
	view: BrowseView,
	leaf: LeafAction,
	page: number,
): Screen {
	const entries: readonly Entry[] = [
		...view.children.map((child) => {
			const label = `📁 ${child.name} (${child.itemCount})`;

			return {
				label,
				button: button(truncate(label), {
					action: Action.Browse,
					leaf,
					folderId: child.id,
				}),
			};
		}),
		...view.sets.map((set) => {
			const label = `📘 ${set.title} (${set.questionCount})`;

			return {
				label,
				button: button(truncate(label), { action: leaf, quizSetId: set.id }),
			};
		}),
	];

	const pageCount = Math.max(1, Math.ceil(entries.length / BROWSE_PAGE_SIZE));
	const current = Math.min(Math.max(page, 0), pageCount - 1);
	const shown = entries.slice(
		current * BROWSE_PAGE_SIZE,
		current * BROWSE_PAGE_SIZE + BROWSE_PAGE_SIZE,
	);

	const pager: InlineButton[] = [];

	if (current > 0) {
		pager.push(
			button("‹ Попередні", {
				action: Action.Browse,
				leaf,
				folderId: view.folderId,
				page: current - 1,
			}),
		);
	}

	if (current < pageCount - 1) {
		pager.push(
			button("Наступні ›", {
				action: Action.Browse,
				leaf,
				folderId: view.folderId,
				page: current + 1,
			}),
		);
	}

	const navigation: InlineButton[][] = [];

	if (view.folderId !== undefined) {
		navigation.push([
			button("« Назад", {
				action: Action.Browse,
				leaf,
				folderId: view.parentId,
			}),
		]);
	}

	navigation.push([button("« Меню", { action: Action.Menu })]);

	const heading = headingOf(view, leaf);
	const clipped = shown.filter((entry) => entry.button.text !== entry.label);
	const body =
		entries.length === 0
			? view.folderId === undefined
				? "Опублікованих наборів ще немає. Створіть набір через Claude (MCP)."
				: "Ця папка порожня."
			: [
					clipped.length === 0
						? undefined
						: clipped.map((entry) => entry.label).join("\n"),
					pageCount > 1 ? `Сторінка ${current + 1} з ${pageCount}` : undefined,
				]
					.filter((line) => line !== undefined)
					.join("\n\n");

	return {
		text: body.length === 0 ? heading : `${heading}\n\n${body}`,
		keyboard: [
			...shown.map((entry) => [entry.button]),
			...(pager.length === 0 ? [] : [pager]),
			...navigation,
		],
	};
}
