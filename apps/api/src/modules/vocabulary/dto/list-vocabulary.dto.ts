import { listVocabularyCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listVocabularyDto = listVocabularyCommandSchema;

export type ListVocabularyDto = z.output<typeof listVocabularyDto>;
