import type {
	DetachedQuiz as WireDetachedQuiz,
	PageRevision as WirePageRevision,
	PageTreeNode as WirePageTreeNode,
} from "@recall/contracts";
import type { PageRevision } from "./pages.repository";
import type { DetachedQuiz, PageTreeNode } from "./use-cases";

const text = (value: string | undefined): string | undefined =>
	value === undefined ? undefined : value;

export const detachedQuizToWire = (
	detached: DetachedQuiz,
): WireDetachedQuiz => ({
	folderId: String(detached.folderId),
	folderName: detached.folderName,
	quizSetId: String(detached.quizSetId),
});

export const revisionToWire = (revision: PageRevision): WirePageRevision => ({
	id: revision.id,
	title: revision.title,
	summary: revision.summary,
	authorKind: revision.authorKind,
	createdAt: revision.createdAt.toISOString(),
});

export const pageTreeNodeToWire = (node: PageTreeNode): WirePageTreeNode => ({
	id: String(node.id),
	name: node.name,
	icon: text(node.icon),
	parentId: node.parentId === undefined ? undefined : String(node.parentId),
	depth: node.depth,
	setCount: node.setCount,
	unpublishedCount: node.unpublishedCount,
});
