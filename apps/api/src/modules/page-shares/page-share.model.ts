import type {
	SharedPage as WireSharedPage,
	SharedPageView as WireSharedPageView,
} from "@recall/contracts";
import type { SharedPage, SharedPageView } from "./use-cases";

const text = (value: string | undefined): string | undefined =>
	value === undefined ? undefined : value;

export const sharedPageToWire = (shared: SharedPage): WireSharedPage => ({
	folderId: String(shared.folderId),
	name: shared.name,
	token: shared.token,
	createdAt: shared.createdAt.toISOString(),
});

export const sharedPageViewToWire = (
	view: SharedPageView,
): WireSharedPageView => ({
	name: view.name,
	icon: text(view.icon),
	summary: text(view.summary),
	updatedAt: view.updatedAt.toISOString(),
});
