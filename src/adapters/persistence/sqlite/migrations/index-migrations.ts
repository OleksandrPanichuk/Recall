import { initialSchema } from "./001-initial-schema";
import type { Migration } from "./migration";

/**
 * Every migration this application knows about, in ascending version order.
 * The runner sorts defensively, but keeping the list ordered makes an appended
 * migration obvious in review. This module exports only the list — it is
 * deliberately not a barrel that re-exports migration internals.
 */
export const migrations: readonly Migration[] = [initialSchema];
