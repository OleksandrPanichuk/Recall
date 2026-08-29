import type { BrowseView } from "@recall/contracts";
import { searchPages } from "@/features/pages/lib/pages.api";
import { LibraryList } from "@/features/pages/ui/components/LibraryList";
import { PageSearch } from "@/features/pages/ui/components/PageSearch";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";
import { libraryCaption } from "./LibraryView.constants";

interface Props {
	readonly view: BrowseView | null;
}

export function LibraryView({ view }: Props) {
	if (view === null) {
		return <SignInPrompt />;
	}

	return (
		<>
			<PageHeading title="Ваша бібліотека" caption={libraryCaption(view)} />
			<div className="space-y-4">
				<PageSearch onSearch={(query) => searchPages({ data: query })} />
				<LibraryList view={view} />
			</div>
		</>
	);
}
