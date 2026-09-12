import type {
	AttachedQuiz as WireAttachedQuiz,
	BrowseView as WireBrowseView,
	DetachedQuiz as WireDetachedQuiz,
	PageRevision as WirePageRevision,
	PageTreeNode as WirePageTreeNode,
	QuizSummary as WireQuizSummary,
} from "@recall/contracts";
import type { LinkedQuizSummary } from "./page.quiz-link";
import type { PageRevision } from "./pages.repository";
import type {
	AttachedQuiz,
	BrowseView,
	DetachedQuiz,
	PageTreeNode,
} from "./use-cases";

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

export const linkedQuizToWire = (quiz: LinkedQuizSummary): WireQuizSummary => ({
	id: String(quiz.id),
	title: quiz.title,
	status: quiz.status,
	questionCount: quiz.questionCount,
	updatedAt: quiz.updatedAt.toISOString(),
});

export const attachedQuizToWire = (
	attached: AttachedQuiz,
): WireAttachedQuiz => ({
	folderId: String(attached.folderId),
	folderName: attached.folderName,
	quizSetId: String(attached.quizSetId),
	title: attached.title,
});

export const browseViewToWire = (view: BrowseView): WireBrowseView => ({
	folderId: view.folderId === undefined ? undefined : String(view.folderId),
	name: view.name,
	summary: view.summary,
	icon: view.icon,
	parentId: view.parentId === undefined ? undefined : String(view.parentId),
	breadcrumb: view.breadcrumb.map((crumb) => ({
		id: String(crumb.id),
		name: crumb.name,
	})),
	children: view.children.map((child) => ({
		id: String(child.id),
		name: child.name,
		itemCount: child.itemCount,
	})),
	sets: view.sets.map(linkedQuizToWire),
	attached: view.attached.map(linkedQuizToWire),
	shareToken: view.shareToken,
});
