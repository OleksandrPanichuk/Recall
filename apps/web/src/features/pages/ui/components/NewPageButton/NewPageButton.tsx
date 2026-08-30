import { useNavigate } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createPage } from "@/features/pages/lib/pages.api";
import { UNTITLED } from "./NewPageButton.constants";

interface Props {
	readonly parentId?: string;
	readonly label: string;
	readonly onCreated?: () => void;
}

export function NewPageButton({ parentId, label, onCreated }: Props) {
	const navigate = useNavigate();
	const [busy, setBusy] = useState(false);

	return (
		<Button
			variant="ghost"
			size="sm"
			disabled={busy}
			onClick={async () => {
				setBusy(true);

				try {
					const { folderId } = await createPage({
						data: { name: UNTITLED, parentId },
					});

					onCreated?.();
					await navigate({
						to: "/folders/$folderId",
						params: { folderId },
					});
				} finally {
					setBusy(false);
				}
			}}
		>
			<FilePlus2 />
			{label}
		</Button>
	);
}
