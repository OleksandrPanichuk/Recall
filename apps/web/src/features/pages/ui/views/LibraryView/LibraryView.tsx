import type { BrowseView } from "@recall/contracts";
import { NewQuizButton } from "@/features/authoring/ui/components/NewQuizButton";
import { searchPages } from "@/features/pages/lib/pages.api";
import { LibraryList } from "@/features/pages/ui/components/LibraryList";
import { NewPageButton } from "@/features/pages/ui/components/NewPageButton";
import { PageSearch } from "@/features/pages/ui/components/PageSearch";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";
import { libraryCaption } from "./LibraryView.constants";

interface Props {
	readonly view: BrowseView | null;
	readonly inProgressQuizId?: string;
}

export function LibraryView({ view, inProgressQuizId }: Props) {
	if (view === null) {
		return <SignInPrompt />;
	}

	return (
		<>
			<PageHeading title="Ваша бібліотека" caption={libraryCaption(view)}>
				<NewPageButton label="Нова сторінка" />
				<NewQuizButton folderId={view.folderId} />
			</PageHeading>
			<div className="space-y-4">
				<PageSearch onSearch={(query) => searchPages({ data: query })} />
				<LibraryList view={view} inProgressQuizId={inProgressQuizId} />
			</div>
		</>
	);
}
