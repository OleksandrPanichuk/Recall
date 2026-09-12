import { text } from "drizzle-orm/pg-core";
import { user } from "./auth.schema";

export const ownerId = () =>
	text("owner_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });
