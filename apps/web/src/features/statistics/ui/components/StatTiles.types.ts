import type { ReactNode } from "react";

export interface Stat {
	readonly label: string;
	readonly value: string;
	readonly hint?: string;
	readonly icon: ReactNode;
}
