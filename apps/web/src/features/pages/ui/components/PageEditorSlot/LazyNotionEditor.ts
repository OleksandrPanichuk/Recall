import { lazy } from "react";

export const LazyNotionEditor = lazy(async () => ({
	default: (await import("@/features/pages/ui/components/NotionEditor"))
		.NotionEditor,
}));
