import { ApiErrorName } from "@recall/contracts";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";
import { idInput, missingAsNull } from "@/shared/lib/request";

export const loadLibrary = createServerFn()
	.inputValidator((value: unknown) => ({
		folderId: value === undefined ? undefined : String(value),
	}))
	.handler(async ({ data }) =>
		missingAsNull(
			() => api().browseFolder.execute(data),
			[ApiErrorName.FolderNotFound],
		),
	);

export const saveSummary = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { folderId: string; summary: string };

		return { folderId: String(input.folderId), summary: String(input.summary) };
	})
	.handler(async ({ data }) => {
		await api().writeSummary.execute(data);

		return api().browseFolder.execute({ folderId: data.folderId });
	});

export const searchPages = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => ({ query: String(value) }))
	.handler(async ({ data }) => api().searchPages.execute(data));

export const createPage = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { name: string; parentId?: string };

		return { name: String(input.name), parentId: input.parentId };
	})
	.handler(async ({ data }) => api().createPage.execute(data));

export const renamePage = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { folderId: string; name: string };

		return { folderId: String(input.folderId), name: String(input.name) };
	})
	.handler(async ({ data }) => {
		await api().renamePage.execute(data);

		return api().browseFolder.execute({ folderId: data.folderId });
	});

export const setPageIcon = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => {
		const input = value as { folderId: string; icon?: string };

		return { folderId: String(input.folderId), icon: input.icon };
	})
	.handler(async ({ data }) => {
		await api().setPageIcon.execute(data);

		return api().browseFolder.execute({ folderId: data.folderId });
	});

export const deletePage = createServerFn({ method: "POST" })
	.inputValidator(idInput)
	.handler(async ({ data }) => {
		await api().deletePage.execute({ folderId: data.id });
	});

export const loadPageTree = createServerFn().handler(async () => ({
	nodes: await api().listPageTree.execute({}),
}));
