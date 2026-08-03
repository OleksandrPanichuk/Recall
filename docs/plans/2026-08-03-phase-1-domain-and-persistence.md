# Phase 1 — Domain Model and Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `run-reviewed-development` (project skill) to execute this plan task-by-task: a fresh implementer per task, an independent read-only reviewer, findings back to the implementer, scoped re-review of every fix. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure quiz domain model and the SQLite persistence layer behind application-owned repository ports, so Phase 2 use cases have a tested foundation with no transport or database knowledge leaking across layers.

**Architecture:** Ports and Adapters. `src/domain` holds aggregates, value types, invariants and lifecycle transitions with zero infrastructure imports. `src/application/ports/repositories` declares what application code needs. `src/adapters/persistence/sqlite` implements those ports over `bun:sqlite`, plus a versioned migration runner. All repository and transaction methods are **synchronous**, because `bun:sqlite` is synchronous and the existing `Transaction` port already forbids crossing an `await` boundary inside a transaction.

**Tech Stack:** Bun, strict TypeScript, `bun:sqlite`, `bun test`, Biome, zod (already present, used only at adapter/MCP boundaries — never inside `src/domain`).

## Global Constraints

- Runtime is Bun; never introduce Node-only infrastructure where Bun has a primitive.
- `src/domain` must not import Telegraf, MCP, `bun:sqlite`, zod, `src/application`, `src/adapters` or `src/infrastructure`.
- `src/application` may import `src/domain` and its own ports only; it must not import concrete adapters.
- Dependency direction is `entrypoints/composition -> adapters -> application -> domain`; no circular imports, no cross-layer barrel `index.ts`.
- Repositories return domain objects or explicit read models, never raw SQLite rows, Telegraf types or MCP types.
- Repository interfaces live in `src/application/ports/repositories`; implementations live in `src/adapters/persistence/sqlite/repositories`.
- Every multi-write operation runs inside one transaction via the existing `Transaction` port (`src/application/ports/transaction.ts`).
- Every behavior change is implemented TDD: failing test first, minimal implementation, passing test.
- File and directory names are `kebab-case`; types are `PascalCase`; functions and variables are `camelCase`; no `I` prefix on interfaces.
- Unit tests are colocated as `*.test.ts`; SQLite integration tests live under `tests/integration/sqlite/`.
- No `helpers`, `utils`, `core`, `common` directories and no global `types.ts`.
- Do not create directories that the current task does not need.
- Timestamps are `Date` in the domain and ISO-8601 `TEXT` (`toISOString()`) in SQLite.
- IDs are generated through the existing `IdGenerator` port, never inside the domain or a repository.
- Verification per task: `bun test <changed test paths>`; before each PR: `bun run verify`.

## PR chain

Three stacked pull requests, each merged in order:

| PR | Branch | Base | Tasks |
| --- | --- | --- | --- |
| PR A | `feat/phase-1-1-domain-model` | `main` | 1–4 |
| PR B | `feat/phase-1-2-sqlite-migrations` | `feat/phase-1-1-domain-model` | 5–6 |
| PR C | `feat/phase-1-3-repositories` | `feat/phase-1-2-sqlite-migrations` | 7–9 |

Rebase each downstream branch after its base merges. Run `bun run verify` before opening and before merging each PR.

---

## Task 1: Branded identifiers and the question model

**Files:**
- Create: `src/domain/branded-id.ts`
- Create: `src/domain/branded-id.test.ts`
- Create: `src/domain/quiz-set/question.ts` (types and constants only)
- Create: `src/domain/quiz-set/create-question.ts`
- Create: `src/domain/quiz-set/create-question.test.ts`
- Create: `src/domain/quiz-set/question-fingerprint.ts`
- Create: `src/domain/quiz-set/question-fingerprint.test.ts`
- Create: `src/domain/quiz-set/quiz-set.errors.ts`

Each module owns one responsibility: `question.ts` describes the shape, `create-question.ts` enforces invariants, `question-fingerprint.ts` derives the content hash. No barrel `index.ts` and no re-exports — importers reference the owning module.

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // src/domain/branded-id.ts
  declare const idBrand: unique symbol;
  export type BrandedId<TBrand extends string> = string & {
  	readonly [idBrand]: TBrand;
  };
  export function brandedId<TBrand extends string>(
  	value: string,
  	label: string,
  ): BrandedId<TBrand>; // throws InvalidIdentifierError when value.trim() is empty

  // src/domain/quiz-set/quiz-set.errors.ts
  export class InvalidIdentifierError extends Error {} // message: `${label} must be a non-empty identifier`
  export class QuestionValidationError extends Error {
  	readonly issues: readonly string[];
  } // message: `Invalid question:\n- <issue>\n- <issue>`

  // src/domain/quiz-set/question.ts
  export type QuestionId = BrandedId<"QuestionId">;
  export type QuestionOptionId = BrandedId<"QuestionOptionId">;
  export const toQuestionId: (value: string) => QuestionId;
  export const toQuestionOptionId: (value: string) => QuestionOptionId;

  // Named constants with a derived union: call sites use QuestionType.SingleChoice,
  // while the type stays a string literal union so SQLite rows and zod output stay
  // structurally assignable and no runtime enum object is emitted.
  // Do not use a TypeScript `enum`.
  export const QuestionType = {
  	SingleChoice: "single_choice",
  	MultipleChoice: "multiple_choice",
  	TrueFalse: "true_false",
  } as const;
  export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

  export const Difficulty = {
  	Easy: "easy",
  	Medium: "medium",
  	Hard: "hard",
  } as const;
  export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

  export interface QuestionOption {
  	readonly id: QuestionOptionId;
  	readonly text: string;
  	readonly isCorrect: boolean;
  	readonly position: number;
  }

  interface QuestionFields {
  	readonly id: QuestionId;
  	readonly prompt: string;
  	readonly options: readonly QuestionOption[];
  	readonly difficulty: Difficulty;
  	readonly position: number;
  	readonly explanation?: string;
  	readonly sourceReference?: string;
  	readonly topic?: string;
  	readonly hint?: string;
  }

  export interface SingleChoiceQuestion extends QuestionFields {
  	readonly type: "single_choice";
  }
  export interface MultipleChoiceQuestion extends QuestionFields {
  	readonly type: "multiple_choice";
  }
  export interface TrueFalseQuestion extends QuestionFields {
  	readonly type: "true_false";
  }
  export type Question =
  	| SingleChoiceQuestion
  	| MultipleChoiceQuestion
  	| TrueFalseQuestion;

  // create-question.ts
  /** Validates every invariant and reports all issues at once. */
  export function createQuestion(draft: {
  	readonly id: QuestionId;
  	readonly type: QuestionType;
  	readonly prompt: string;
  	readonly difficulty: Difficulty;
  	readonly position: number;
  	readonly options: readonly QuestionOption[];
  	readonly explanation?: string;
  	readonly sourceReference?: string;
  	readonly topic?: string;
  	readonly hint?: string;
  }): Question;

  // question-fingerprint.ts
  /** Stable content hash used for duplicate detection and idempotent import. */
  export function questionFingerprint(question: Question): string;
  ```

**Invariants `createQuestion` must enforce** (collect all failures into `QuestionValidationError.issues`, in this order):
1. `prompt` trimmed is non-empty — `"prompt must not be empty"`.
2. `position` is a non-negative safe integer — `"position must be a non-negative integer"`.
3. every option `text` trimmed is non-empty — `"option text must not be empty"`.
4. option `position` values are unique and form `0..n-1` — `"option positions must be unique and start at 0"`.
5. `single_choice` and `multiple_choice` have at least two options — `"<type> requires at least two options"`.
6. `true_false` has exactly two options — `"true_false requires exactly two options"`.
7. `single_choice` and `true_false` have exactly one correct option — `"<type> requires exactly one correct option"`.
8. `multiple_choice` has at least one correct option — `"multiple_choice requires at least one correct option"`.

`createQuestion` trims `prompt`, `explanation`, `sourceReference`, `topic`, `hint` and option `text`, and drops optional fields that are empty after trimming (they become `undefined`, not `""`).

`questionFingerprint` is `Bun.hash` of a canonical string built from `type`, trimmed lowercased `prompt`, and the trimmed lowercased option texts **sorted alphabetically together with their `isCorrect` flag**, so reordered options of the same question produce the same fingerprint. Return the hash as a base-36 string.

- [ ] **Step 1: Write the failing tests for `brandedId`**

```ts
// src/domain/branded-id.test.ts
import { describe, expect, test } from "bun:test";
import { brandedId } from "./branded-id";
import { InvalidIdentifierError } from "./quiz-set/quiz-set.errors";

describe("brandedId", () => {
	test("returns the trimmed value", () => {
		expect(brandedId(" abc ", "QuestionId")).toBe("abc");
	});

	test.each(["", "   "])("rejects %p", (value) => {
		expect(() => brandedId(value, "QuestionId")).toThrow(
			InvalidIdentifierError,
		);
	});

	test("names the identifier in the failure message", () => {
		expect(() => brandedId("", "QuizSetId")).toThrow(
			"QuizSetId must be a non-empty identifier",
		);
	});
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test src/domain/branded-id.test.ts`
Expected: FAIL — `Cannot find module './branded-id'`.

- [ ] **Step 3: Implement `branded-id.ts` and `quiz-set.errors.ts`**

Minimal implementation only: the brand type, `brandedId`, `InvalidIdentifierError`, `QuestionValidationError`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `bun test src/domain/branded-id.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for `createQuestion`**

Tests for `createQuestion` live in `create-question.test.ts`; the fingerprint group lives in `question-fingerprint.test.ts`. Cover, in `describe("createQuestion")` groups:
- `"with a valid draft"`: returns a frozen `Question` with trimmed fields; drops whitespace-only optional fields to `undefined`; preserves the discriminant so `question.type === "single_choice"` narrows.
- `"with an invalid draft"`: one test per invariant 1–8 asserting the exact issue string, plus one test asserting **two** simultaneous problems produce **two** issues in the documented order.
- `"fingerprint"`: identical content produces an equal fingerprint; reordered options produce an equal fingerprint; a changed `isCorrect` flag or a changed prompt produces a different fingerprint.

Example of the required shape:

```ts
// src/domain/quiz-set/question.test.ts
import { describe, expect, test } from "bun:test";
import {
	createQuestion,
	questionFingerprint,
	toQuestionId,
	toQuestionOptionId,
} from "./question";
import { QuestionValidationError } from "./quiz-set.errors";

const option = (text: string, isCorrect: boolean, position: number) => ({
	id: toQuestionOptionId(`option-${position}`),
	text,
	isCorrect,
	position,
});

const validDraft = {
	id: toQuestionId("question-1"),
	type: "single_choice" as const,
	prompt: "  What does replication improve?  ",
	difficulty: "medium" as const,
	position: 0,
	options: [option("Availability", true, 0), option("Index size", false, 1)],
	explanation: "  Replication keeps copies on several nodes.  ",
	topic: "   ",
};

describe("createQuestion", () => {
	test("trims text and drops blank optional fields", () => {
		const question = createQuestion(validDraft);

		expect(question.prompt).toBe("What does replication improve?");
		expect(question.explanation).toBe(
			"Replication keeps copies on several nodes.",
		);
		expect(question.topic).toBeUndefined();
	});

	test("reports every invariant failure at once", () => {
		let issues: readonly string[] = [];

		try {
			createQuestion({
				...validDraft,
				prompt: "  ",
				options: [option("Only one", false, 0), option("Other", false, 1)],
			});
		} catch (caught) {
			issues = (caught as QuestionValidationError).issues;
		}

		expect(issues).toEqual([
			"prompt must not be empty",
			"single_choice requires exactly one correct option",
		]);
	});
});
```

- [ ] **Step 6: Run the tests and confirm they fail**

Run: `bun test src/domain/quiz-set`
Expected: FAIL — `createQuestion` is not exported yet.

- [ ] **Step 7: Implement `question.ts`, `create-question.ts` and `question-fingerprint.ts`**

Implement the types and constants, `toQuestionId`, `toQuestionOptionId`, `createQuestion` and `questionFingerprint` in their owning modules. Freeze returned objects with `Object.freeze`. No zod, no imports outside `src/domain`.

- [ ] **Step 8: Run the focused tests and the whole suite**

Run: `bun test src/domain`
Then: `bun test`
Expected: all pass, previously existing 17 tests still pass.

- [ ] **Step 9: Commit**

```bash
git add src/domain
git commit -m "feat: add question domain model with branded identifiers"
```

---

## Task 2: QuizSet aggregate and lifecycle transitions

**Files:**
- Create: `src/domain/quiz-set/quiz-set.ts`
- Create: `src/domain/quiz-set/quiz-set.test.ts`
- Modify: `src/domain/quiz-set/quiz-set.errors.ts` (add the transition and publish errors)

**Interfaces:**
- Consumes: `Question`, `QuestionId`, `questionFingerprint`, `BrandedId`, `brandedId`, `QuestionValidationError` from Task 1.
- Produces:
  ```ts
  export type QuizSetId = BrandedId<"QuizSetId">;
  export const toQuizSetId: (value: string) => QuizSetId;

  export type QuizSetStatus = "draft" | "published" | "archived";

  export interface QuizSet {
  	readonly id: QuizSetId;
  	readonly title: string;
  	readonly status: QuizSetStatus;
  	readonly language: string;
  	readonly questions: readonly Question[];
  	readonly tags: readonly string[];
  	readonly createdAt: Date;
  	readonly updatedAt: Date;
  	readonly description?: string;
  	readonly source?: string;
  	readonly sourceChapters?: string;
  	readonly publishedAt?: Date;
  	readonly archivedAt?: Date;
  }

  export function createQuizSet(draft: {
  	readonly id: QuizSetId;
  	readonly title: string;
  	readonly language: string;
  	readonly createdAt: Date;
  	readonly description?: string;
  	readonly source?: string;
  	readonly sourceChapters?: string;
  	readonly tags?: readonly string[];
  }): QuizSet; // always status "draft", questions [], updatedAt = createdAt

  export function addQuestions(
  	quizSet: QuizSet,
  	questions: readonly Question[],
  	at: Date,
  ): QuizSet; // appends, renumbers positions, rejects duplicates and non-draft sets

  export function publishQuizSet(quizSet: QuizSet, at: Date): QuizSet;
  export function archiveQuizSet(quizSet: QuizSet, at: Date): QuizSet;
  ```
  ```ts
  // added to quiz-set.errors.ts
  export class QuizSetValidationError extends Error {
  	readonly issues: readonly string[];
  } // message: `Invalid quiz set:\n- <issue>`, same shape as QuestionValidationError
  export class QuizSetTransitionError extends Error {} // `A ${from} quiz set cannot be ${action}`
  export class DuplicateQuestionError extends Error {
  	readonly fingerprints: readonly string[];
  }
  export class EmptyQuizSetError extends Error {} // "A quiz set without questions cannot be published"
  ```

**Rules:**
- `createQuizSet` trims `title` and `language`, requires both non-empty, deduplicates and trims tags, and drops blank optional fields. Validation failures throw `QuizSetValidationError` with an `issues` array — issue strings `"title must not be empty"` and `"language must not be empty"`, in that order. Do not reuse `QuestionValidationError`.
- `addQuestions` only works on `draft`; on `published` or `archived` it throws `QuizSetTransitionError` with action `"modified"`. Published content is never edited in place.
- `addQuestions` rejects a batch containing a question whose `questionFingerprint` already exists in the set, or that repeats inside the batch, with `DuplicateQuestionError` listing the offending fingerprints. This is what makes a retried MCP batch safe.
- `addQuestions` renumbers appended questions so positions stay contiguous from the existing count, and returns a new `QuizSet` with `updatedAt = at`.
- `publishQuizSet`: `draft -> published` only; empty question list throws `EmptyQuizSetError`; sets `publishedAt = at`; publishing an already published set throws `QuizSetTransitionError` (`action: "published"`).
- `archiveQuizSet`: `draft -> archived` and `published -> archived`; already archived throws `QuizSetTransitionError`; sets `archivedAt = at`.
- Every function is pure and returns a new frozen object; no mutation of the input.

- [ ] **Step 1: Write the failing tests**

`describe("QuizSet")` with groups `"createQuizSet"`, `"addQuestions"`, `"publishQuizSet"`, `"archiveQuizSet"`. Required cases:
- create: defaults to `draft` with no questions and `updatedAt === createdAt`; trims title/language; deduplicates tags; rejects blank title with the issue `"title must not be empty"`.
- addQuestions: appends and renumbers positions to `0,1,2`; does not mutate the input set (`expect(draft.questions).toHaveLength(0)`); rejects a duplicate fingerprint already in the set; rejects a duplicate inside the same batch; rejects adding to a published set with `QuizSetTransitionError`; updates `updatedAt`.
- publishQuizSet: `draft` with one question becomes `published` with `publishedAt === at`; empty set throws `EmptyQuizSetError`; publishing twice throws `QuizSetTransitionError`.
- archiveQuizSet: from `draft` and from `published` both reach `archived` with `archivedAt === at`; archiving twice throws.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test src/domain/quiz-set/quiz-set.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `quiz-set.ts` and extend `quiz-set.errors.ts`**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `bun test src/domain` then `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add quiz set aggregate with explicit lifecycle transitions"
```

---

## Task 3: QuizAttempt aggregate, responses and score

**Files:**
- Create: `src/domain/quiz-attempt/quiz-attempt.ts`
- Create: `src/domain/quiz-attempt/quiz-attempt.test.ts`
- Create: `src/domain/quiz-attempt/quiz-attempt.errors.ts`
- Create: `src/domain/quiz-attempt/score.ts`
- Create: `src/domain/quiz-attempt/score.test.ts`

**Interfaces:**
- Consumes: `QuizSetId` (Task 2), `QuestionId`, `QuestionOptionId` (Task 1), `BrandedId`, `brandedId`.
- Produces:
  ```ts
  // score.ts
  export interface Score {
  	readonly correct: number;
  	readonly total: number;
  	readonly percentage: number; // 0..100, rounded to one decimal
  }
  export function calculateScore(
  	responses: readonly QuestionResponse[],
  	total: number,
  ): Score; // total 0 -> { correct: 0, total: 0, percentage: 0 }

  // quiz-attempt.ts
  export type QuizAttemptId = BrandedId<"QuizAttemptId">;
  export const toQuizAttemptId: (value: string) => QuizAttemptId;

  export type QuizAttemptStatus = "active" | "paused" | "completed";
  export type QuizAttemptMode = "full" | "mistakes" | "weak_topics";

  export interface QuestionResponse {
  	readonly questionId: QuestionId;
  	readonly selectedOptionIds: readonly QuestionOptionId[];
  	readonly isCorrect: boolean;
  	readonly answeredAt: Date;
  }

  export interface QuizAttempt {
  	readonly id: QuizAttemptId;
  	readonly quizSetId: QuizSetId;
  	readonly telegramUserId: number;
  	readonly mode: QuizAttemptMode;
  	readonly status: QuizAttemptStatus;
  	readonly questionIds: readonly QuestionId[]; // ordered session plan
  	readonly responses: readonly QuestionResponse[];
  	readonly startedAt: Date;
  	readonly updatedAt: Date;
  	readonly completedAt?: Date;
  }

  export function startQuizAttempt(draft: {
  	readonly id: QuizAttemptId;
  	readonly quizSetId: QuizSetId;
  	readonly telegramUserId: number;
  	readonly mode: QuizAttemptMode;
  	readonly questionIds: readonly QuestionId[];
  	readonly startedAt: Date;
  }): QuizAttempt;

  export function currentQuestionId(attempt: QuizAttempt): QuestionId | undefined;
  export function recordResponse(
  	attempt: QuizAttempt,
  	response: QuestionResponse,
  ): QuizAttempt;
  export function pauseQuizAttempt(attempt: QuizAttempt, at: Date): QuizAttempt;
  export function resumeQuizAttempt(attempt: QuizAttempt, at: Date): QuizAttempt;
  export function completeQuizAttempt(attempt: QuizAttempt, at: Date): QuizAttempt;
  export function attemptScore(attempt: QuizAttempt): Score;
  ```
  ```ts
  // quiz-attempt.errors.ts
  export class QuizAttemptTransitionError extends Error {} // `A ${from} attempt cannot be ${action}`
  export class EmptyQuizAttemptError extends Error {} // "An attempt requires at least one question"
  export class QuestionNotInAttemptError extends Error {}
  export class DuplicateResponseError extends Error {}
  ```

**Rules:**
- `startQuizAttempt` requires a non-empty `questionIds` (else `EmptyQuizAttemptError`), rejects duplicate ids inside `questionIds`, requires `telegramUserId` to be a positive safe integer, starts `active` with no responses and `updatedAt = startedAt`.
- `currentQuestionId` returns `questionIds[responses.length]`, or `undefined` when every planned question is answered.
- `recordResponse` is the idempotency guard for duplicated Telegram callbacks:
  - throws `QuizAttemptTransitionError` unless status is `active`;
  - throws `QuestionNotInAttemptError` when the question is not in `questionIds`;
  - throws `DuplicateResponseError` when a response for that question already exists;
  - throws `QuestionNotInAttemptError` when the question is not the current one (answering out of order is not supported in the MVP);
  - appends the response and sets `updatedAt = response.answeredAt`.
- `pauseQuizAttempt`: `active -> paused`; anything else throws. `resumeQuizAttempt`: `paused -> active`; anything else throws. `completeQuizAttempt`: `active | paused -> completed`, sets `completedAt = at`; a completed attempt throws.
- `attemptScore` delegates to `calculateScore(attempt.responses, attempt.questionIds.length)`.
- Percentage rounding: `Math.round((correct / total) * 1000) / 10`.

- [ ] **Step 1: Write the failing tests for `calculateScore`**

Groups: `"with no responses"` (0/0 → percentage 0; 0/5 → 0), `"with mixed responses"` (2 correct of 3 → `{correct: 2, total: 3, percentage: 66.7}`), `"with every answer correct"` (→ 100), `"when responses exceed the plan"` is not a case — instead assert `total` is taken from the argument, not from `responses.length`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test src/domain/quiz-attempt/score.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `score.ts`**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `bun test src/domain/quiz-attempt/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for the attempt aggregate**

`describe("QuizAttempt")` groups and required cases:
- `"startQuizAttempt"`: starts `active`; rejects an empty plan with `EmptyQuizAttemptError`; rejects duplicate question ids; rejects a non-positive `telegramUserId`.
- `"currentQuestionId"`: first planned id initially; second id after one response; `undefined` when all answered.
- `"recordResponse"`: appends and advances the current question; does not mutate the input attempt; rejects a second response for the same question with `DuplicateResponseError` (this is the duplicate-callback guard); rejects a question outside the plan; rejects answering out of order; rejects recording on a `paused` attempt.
- `"transitions"`: `active -> paused -> active -> completed` works; `pause` on `paused` throws; `resume` on `active` throws; `complete` sets `completedAt`; `complete` twice throws.
- `"attemptScore"`: an attempt with 1 correct of 2 planned questions scores `{correct: 1, total: 2, percentage: 50}`.

- [ ] **Step 6: Run the tests and confirm they fail**

Run: `bun test src/domain/quiz-attempt`
Expected: FAIL — `quiz-attempt` module not found.

- [ ] **Step 7: Implement `quiz-attempt.ts` and `quiz-attempt.errors.ts`**

- [ ] **Step 8: Run the focused tests and the whole suite**

Run: `bun test src/domain` then `bun test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/domain
git commit -m "feat: add quiz attempt aggregate with idempotent response recording"
```

---

## Task 4: Review item model

**Files:**
- Create: `src/domain/review/review-item.ts`
- Create: `src/domain/review/review-item.test.ts`
- Create: `src/domain/review/review.errors.ts`

**Interfaces:**
- Consumes: `QuestionId` (Task 1), `BrandedId`, `brandedId`.
- Produces:
  ```ts
  export type ReviewItemId = BrandedId<"ReviewItemId">;
  export const toReviewItemId: (value: string) => ReviewItemId;

  export type ReviewItemState = "pending" | "learning" | "retired";

  export interface ReviewItem {
  	readonly id: ReviewItemId;
  	readonly questionId: QuestionId;
  	readonly telegramUserId: number;
  	readonly state: ReviewItemState;
  	readonly streak: number;
  	readonly dueAt: Date;
  	readonly createdAt: Date;
  	readonly lastReviewedAt?: Date;
  }

  export function createReviewItem(draft: {
  	readonly id: ReviewItemId;
  	readonly questionId: QuestionId;
  	readonly telegramUserId: number;
  	readonly createdAt: Date;
  	readonly dueAt: Date;
  }): ReviewItem; // state "pending", streak 0

  /** A wrong answer resets progress and makes the item due again. */
  export function markReviewFailed(
  	item: ReviewItem,
  	at: Date,
  	dueAt: Date,
  ): ReviewItem; // state "pending", streak 0, lastReviewedAt = at

  /** A correct repetition advances the streak; interval selection is Phase 5. */
  export function markReviewPassed(
  	item: ReviewItem,
  	at: Date,
  	dueAt: Date,
  ): ReviewItem; // streak + 1, state "learning", or "retired" once streak reaches RETIREMENT_STREAK

  export const RETIREMENT_STREAK = 4;
  ```
  ```ts
  // review.errors.ts
  export class RetiredReviewItemError extends Error {} // "A retired review item cannot be reviewed again"
  ```

**Rules:** `markReviewPassed` and `markReviewFailed` throw `RetiredReviewItemError` on a `retired` item. Both are pure and return frozen objects. `streak` never goes negative. Interval arithmetic and timezone-safe scheduling are explicitly **out of scope** — Phase 5.3 owns them; this task only stores the `dueAt` its caller computes.

- [ ] **Step 1: Write the failing tests**

Groups: `"createReviewItem"` (starts `pending` with streak 0, rejects a non-positive user id), `"markReviewFailed"` (resets streak to 0 from 3, sets `state` to `pending`, sets `lastReviewedAt`, does not mutate the input), `"markReviewPassed"` (streak 1 → `learning`; streak reaching `RETIREMENT_STREAK` → `retired`), `"retired items"` (both mark functions throw `RetiredReviewItemError`).

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test src/domain/review`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `review-item.ts` and `review.errors.ts`**

- [ ] **Step 4: Run the tests, then the whole suite**

Run: `bun test src/domain` then `bun run verify`
Expected: all pass, Biome and typecheck clean.

- [ ] **Step 5: Commit and open PR A**

```bash
git add src/domain
git commit -m "feat: add review item model for repeated mistakes"
git push -u origin feat/phase-1-1-domain-model
gh pr create --base main --title "Phase 1.1: quiz domain model" --body "<summary + verification output>"
```

**PR A acceptance criteria (Phase 1.1 gate):** `QuizSet`, `Question`, `QuizAttempt`, `QuestionResponse` and `ReviewItem` exist; no file under `src/domain` imports Telegraf, MCP, `bun:sqlite`, zod, or any layer outside `src/domain`. Verify with:

```bash
grep -rnE "from \"(telegraf|zod|bun:sqlite|@/(application|adapters|infrastructure))" src/domain || echo "domain is clean"
```

---

## Task 5: SQLite connection and migration runner

**Files:**
- Create: `src/adapters/persistence/sqlite/database.ts`
- Create: `src/adapters/persistence/sqlite/migrations/migration.ts`
- Create: `tests/integration/sqlite/migration-runner.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  // database.ts
  import { Database } from "bun:sqlite";
  export function createDatabase(options: { readonly path: string }): Database;
  // enables `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON`,
  // and `PRAGMA busy_timeout = 5000`

  // migrations/migration.ts
  export interface Migration {
  	readonly version: number;
  	readonly name: string;
  	up(database: Database): void;
  }
  export interface AppliedMigration {
  	readonly version: number;
  	readonly name: string;
  	readonly appliedAt: string;
  }
  export function runMigrations(
  	database: Database,
  	migrations: readonly Migration[],
  ): readonly AppliedMigration[]; // returns only the migrations applied by this call
  export function appliedMigrations(
  	database: Database,
  ): readonly AppliedMigration[];
  ```

**Rules:**
- `runMigrations` creates `schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)` when missing.
- It sorts migrations by `version`, skips already-applied versions, and runs each remaining migration **inside a transaction together with its `schema_migrations` insert**, so a failing migration leaves no partial schema.
- Re-running is idempotent: a second call returns an empty array and changes nothing.
- A duplicate `version` in the input array throws before anything is applied.
- A migration whose `up` throws propagates the error and rolls back that migration's transaction; previously applied migrations stay applied.
- `foreign_keys` must be enabled for connections created by `createDatabase`; the runner must not disable it.

- [ ] **Step 1: Write the failing integration tests**

```ts
// tests/integration/sqlite/migration-runner.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import {
	appliedMigrations,
	type Migration,
	runMigrations,
} from "@/adapters/persistence/sqlite/migrations/migration";

let database: Database;

beforeEach(() => {
	database = createDatabase({ path: ":memory:" });
});

afterEach(() => {
	database.close();
});

const createExample: Migration = {
	version: 1,
	name: "example",
	up: (db) => db.run("CREATE TABLE example (id TEXT PRIMARY KEY)"),
};

describe("runMigrations", () => {
	test("applies pending migrations once", () => {
		expect(runMigrations(database, [createExample])).toHaveLength(1);
		expect(runMigrations(database, [createExample])).toHaveLength(0);
		expect(appliedMigrations(database).map((m) => m.version)).toEqual([1]);
	});

	test("rolls back a failing migration", () => {
		const broken: Migration = {
			version: 2,
			name: "broken",
			up: (db) => {
				db.run("CREATE TABLE half (id TEXT PRIMARY KEY)");
				throw new Error("boom");
			},
		};

		expect(() => runMigrations(database, [createExample, broken])).toThrow(
			"boom",
		);
		expect(appliedMigrations(database).map((m) => m.version)).toEqual([1]);
		const tables = database
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type = 'table'",
			)
			.all()
			.map((row) => row.name);
		expect(tables).not.toContain("half");
	});

	test("rejects duplicate versions before applying anything", () => {
		expect(() =>
			runMigrations(database, [createExample, { ...createExample }]),
		).toThrow("Duplicate migration version 1");
		expect(appliedMigrations(database)).toHaveLength(0);
	});

	test("enables foreign key enforcement", () => {
		const [row] = database
			.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
			.all();
		expect(row?.foreign_keys).toBe(1);
	});
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test tests/integration/sqlite/migration-runner.test.ts`
Expected: FAIL — `Cannot find module '@/adapters/persistence/sqlite/database'`.

- [ ] **Step 3: Implement `database.ts` and `migrations/migration.ts`**

Use `database.transaction(() => { ... })()` from `bun:sqlite` for the per-migration boundary. Do not import anything from `src/domain` or `src/application` here.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `bun test tests/integration/sqlite/migration-runner.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters tests/integration
git commit -m "feat: add sqlite connection factory and migration runner"
```

---

## Task 6: Initial schema migration

**Files:**
- Create: `src/adapters/persistence/sqlite/migrations/001-initial-schema.ts`
- Create: `src/adapters/persistence/sqlite/migrations/index-migrations.ts` (the ordered migration list; named this way deliberately — it is not a barrel re-export)
- Create: `tests/integration/sqlite/initial-schema.test.ts`
- Create: `scripts/migrate.ts`
- Modify: `package.json` (add `"migrate": "bun run ./scripts/migrate.ts"`)
- Modify: `README.md` (document `bun run migrate`)

**Interfaces:**
- Consumes: `Migration`, `runMigrations`, `createDatabase` (Task 5); `loadEnvironment` (already in `src/infrastructure/config/env.ts`).
- Produces:
  ```ts
  export const initialSchema: Migration; // version 1, name "initial-schema"
  export const migrations: readonly Migration[]; // from index-migrations.ts
  ```

**Schema** — exact DDL to implement:

```sql
CREATE TABLE quiz_sets (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	description TEXT,
	language TEXT NOT NULL,
	source TEXT,
	source_chapters TEXT,
	tags TEXT NOT NULL DEFAULT '[]',
	status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	published_at TEXT,
	archived_at TEXT
);

CREATE TABLE questions (
	id TEXT PRIMARY KEY,
	quiz_set_id TEXT NOT NULL REFERENCES quiz_sets (id) ON DELETE CASCADE,
	type TEXT NOT NULL CHECK (
		type IN ('single_choice', 'multiple_choice', 'true_false')
	),
	prompt TEXT NOT NULL,
	explanation TEXT,
	source_reference TEXT,
	topic TEXT,
	difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
	hint TEXT,
	position INTEGER NOT NULL,
	fingerprint TEXT NOT NULL,
	UNIQUE (quiz_set_id, position),
	UNIQUE (quiz_set_id, fingerprint)
);

CREATE TABLE question_options (
	id TEXT PRIMARY KEY,
	question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
	text TEXT NOT NULL,
	is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
	position INTEGER NOT NULL,
	UNIQUE (question_id, position)
);

CREATE TABLE quiz_attempts (
	id TEXT PRIMARY KEY,
	quiz_set_id TEXT NOT NULL REFERENCES quiz_sets (id) ON DELETE CASCADE,
	telegram_user_id INTEGER NOT NULL,
	mode TEXT NOT NULL CHECK (mode IN ('full', 'mistakes', 'weak_topics')),
	status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
	question_ids TEXT NOT NULL,
	started_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	completed_at TEXT
);

CREATE TABLE question_responses (
	attempt_id TEXT NOT NULL REFERENCES quiz_attempts (id) ON DELETE CASCADE,
	question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
	selected_option_ids TEXT NOT NULL,
	is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
	answered_at TEXT NOT NULL,
	PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE review_items (
	id TEXT PRIMARY KEY,
	question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
	telegram_user_id INTEGER NOT NULL,
	state TEXT NOT NULL CHECK (state IN ('pending', 'learning', 'retired')),
	streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
	due_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	last_reviewed_at TEXT,
	UNIQUE (telegram_user_id, question_id)
);

CREATE INDEX idx_quiz_sets_status ON quiz_sets (status);
CREATE INDEX idx_questions_quiz_set ON questions (quiz_set_id, position);
CREATE INDEX idx_quiz_attempts_user_status
	ON quiz_attempts (telegram_user_id, status);
CREATE INDEX idx_review_items_due ON review_items (telegram_user_id, due_at);
```

`question_responses` uses a composite primary key instead of a surrogate id: that constraint **is** the database-level guarantee that one question is scored once per attempt.

`scripts/migrate.ts` loads the environment, opens the database at `DATABASE_PATH`, runs `migrations`, prints the applied versions (or `"database is up to date"`), and exits non-zero on failure.

- [ ] **Step 1: Write the failing integration tests**

Required cases in `describe("initial schema")`:
- creates every expected table: assert the `sqlite_master` table-name set equals `["question_options", "question_responses", "questions", "quiz_attempts", "quiz_sets", "review_items", "schema_migrations"]` (sorted).
- rejects an unknown `quiz_sets.status` value (`CHECK` violation).
- rejects a `questions` row whose `quiz_set_id` does not exist (foreign key violation) — proves `PRAGMA foreign_keys` is active in tests.
- deletes questions and options when their quiz set is deleted (`ON DELETE CASCADE`).
- rejects two questions with the same `fingerprint` inside one quiz set, and allows the same fingerprint in a different set.
- rejects a second `question_responses` row for the same `(attempt_id, question_id)` pair.
- rejects two `review_items` for the same `(telegram_user_id, question_id)` pair.
- is idempotent: running `runMigrations(database, migrations)` twice applies one migration and then zero.

Use a helper in the test file that inserts a minimal valid quiz set / question / attempt so each constraint test stays readable. Keep the helper inside the test file — no shared fixture module until a second test file needs it (Task 7 will introduce `tests/fixtures/` if that happens).

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test tests/integration/sqlite/initial-schema.test.ts`
Expected: FAIL — `001-initial-schema` module not found.

- [ ] **Step 3: Implement the migration, the migration list and `scripts/migrate.ts`**

- [ ] **Step 4: Run the tests and verify the CLI against a temporary database**

Run: `bun test tests/integration/sqlite`
Then:
```bash
DATABASE_PATH=./tmp/migrate-check.sqlite bun run migrate
DATABASE_PATH=./tmp/migrate-check.sqlite bun run migrate   # second run prints "database is up to date"
rm -rf ./tmp/migrate-check.sqlite
```
Expected: first run reports version 1 applied, second run reports no work. `tmp` is already gitignored.

- [ ] **Step 5: Run full verification, commit and open PR B**

```bash
bun run verify
git add src/adapters tests/integration scripts package.json README.md
git commit -m "feat: add initial sqlite schema and migration command"
git push -u origin feat/phase-1-2-sqlite-migrations
gh pr create --base feat/phase-1-1-domain-model --title "Phase 1.2: sqlite schema and migrations" --body "<summary + verification output>"
```

**PR B acceptance criteria (Phase 1.2 gate):** the migration creates a fresh database; a repeated run is idempotent; foreign keys are enforced; migration tests run against a temporary/in-memory database and leave no files behind.

---

## Task 7: Transaction adapter and quiz set repository

**Files:**
- Create: `src/application/ports/repositories/quiz-set.repository.ts`
- Create: `src/adapters/persistence/sqlite/sqlite-transaction.ts`
- Create: `src/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository.ts`
- Create: `src/adapters/persistence/sqlite/repositories/quiz-set.mapper.ts`
- Create: `tests/integration/sqlite/sqlite-quiz-set.repository.test.ts`
- Create: `tests/fixtures/quiz-set.fixture.ts`

**Interfaces:**
- Consumes: `QuizSet`, `QuizSetId`, `QuizSetStatus`, `Question` (Tasks 1–2); `Transaction` (`src/application/ports/transaction.ts`); `createDatabase`, `runMigrations`, `migrations` (Tasks 5–6).
- Produces:
  ```ts
  // src/application/ports/repositories/quiz-set.repository.ts
  export interface QuizSetSummary {
  	readonly id: QuizSetId;
  	readonly title: string;
  	readonly status: QuizSetStatus;
  	readonly questionCount: number;
  	readonly updatedAt: Date;
  }

  export interface QuizSetRepository {
  	/** Inserts or replaces the whole aggregate, questions and options included. */
  	save(quizSet: QuizSet): void;
  	findById(id: QuizSetId): QuizSet | undefined;
  	list(filter?: {
  		readonly statuses?: readonly QuizSetStatus[];
  	}): readonly QuizSetSummary[];
  }

  // src/adapters/persistence/sqlite/sqlite-transaction.ts
  export function createSqliteTransaction(database: Database): Transaction;

  // src/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository.ts
  export function createSqliteQuizSetRepository(
  	database: Database,
  	transaction: Transaction,
  ): QuizSetRepository;

  // tests/fixtures/quiz-set.fixture.ts
  export function aQuestion(overrides?: Partial<{...}>): Question;
  export function aQuizSet(overrides?: Partial<{...}>): QuizSet;
  ```

**Rules:**
- `save` writes the quiz set row, deletes and rewrites its questions and options, all inside one `transaction.run(...)`. A failure anywhere leaves the previous state intact.
- `save` persists `tags` as a JSON array string, dates as `toISOString()`, `isCorrect` as `0`/`1`, and each question's `questionFingerprint(question)` into `questions.fingerprint`.
- `findById` returns `undefined` for an unknown id, and otherwise a fully reconstructed aggregate with questions ordered by `position` and options ordered by `position`. Reconstruction goes through `createQuestion`/domain constructors so a corrupted row cannot produce an invalid aggregate silently.
- `list` returns summaries ordered by `updatedAt` descending, filtered by `statuses` when provided; with no filter it returns every set including archived ones.
- The mapper module owns row-to-domain and domain-to-row conversion; the repository owns SQL and transaction usage. Neither imports Telegraf, MCP or zod.
- The repository must use prepared statements (`database.query(...)`) rather than string interpolation of values.

- [ ] **Step 1: Write the failing integration tests**

Set up in `beforeEach`: `createDatabase({ path: ":memory:" })`, `runMigrations(database, migrations)`, `createSqliteQuizSetRepository(database, createSqliteTransaction(database))`.

Required cases in `describe("SqliteQuizSetRepository")`:
- `"save and findById"`: round-trips a draft with two questions, preserving question order, option order, `isCorrect` flags, tags, optional fields left `undefined`, and `Date` values (compare `toISOString()`).
- `"findById"`: returns `undefined` for an unknown id.
- `"save"`: saving the same aggregate twice does not duplicate questions (`questionCount` stays the same) — the retried-import guarantee.
- `"save"`: saving an updated aggregate with one appended question replaces the question set rather than appending twice.
- `"save"`: a failure inside the transaction (attempt to save a set whose two questions share a fingerprint, hitting the `UNIQUE (quiz_set_id, fingerprint)` constraint) leaves the previously stored version unchanged.
- `"list"`: returns summaries newest-first with the correct `questionCount`; filtering by `["published"]` excludes drafts and archived sets; an empty database returns `[]`.
- `"published sets"`: a published aggregate round-trips with `status === "published"` and a defined `publishedAt`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test tests/integration/sqlite/sqlite-quiz-set.repository.test.ts`
Expected: FAIL — repository module not found.

- [ ] **Step 3: Implement the port, the transaction adapter, the mapper and the repository**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `bun test tests/integration/sqlite`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application src/adapters tests
git commit -m "feat: add sqlite quiz set repository behind an application port"
```

---

## Task 8: Quiz attempt repository

**Files:**
- Create: `src/application/ports/repositories/quiz-attempt.repository.ts`
- Create: `src/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository.ts`
- Create: `src/adapters/persistence/sqlite/repositories/quiz-attempt.mapper.ts`
- Create: `tests/integration/sqlite/sqlite-quiz-attempt.repository.test.ts`
- Modify: `tests/fixtures/quiz-set.fixture.ts` (add `anAttempt(...)`) or create `tests/fixtures/quiz-attempt.fixture.ts` if the file exceeds a single responsibility

**Interfaces:**
- Consumes: `QuizAttempt`, `QuizAttemptId`, `QuestionResponse`, `QuizAttemptStatus` (Task 3); `QuizSetId`, `QuestionId`; `Transaction`; Task 7's database setup pattern.
- Produces:
  ```ts
  export interface AttemptStatistics {
  	readonly attemptId: QuizAttemptId;
  	readonly quizSetId: QuizSetId;
  	readonly correct: number;
  	readonly total: number;
  	readonly completedAt?: Date;
  }

  export interface TopicAccuracy {
  	readonly topic: string | undefined;
  	readonly answered: number;
  	readonly correct: number;
  }

  export interface QuizAttemptRepository {
  	save(attempt: QuizAttempt): void;
  	findById(id: QuizAttemptId): QuizAttempt | undefined;
  	findActiveByUser(telegramUserId: number): QuizAttempt | undefined;
  	listCompletedBySet(
  		telegramUserId: number,
  		quizSetId: QuizSetId,
  	): readonly AttemptStatistics[];
  	topicAccuracy(telegramUserId: number): readonly TopicAccuracy[];
  	incorrectQuestionIds(
  		telegramUserId: number,
  	): readonly QuestionId[];
  }

  export function createSqliteQuizAttemptRepository(
  	database: Database,
  	transaction: Transaction,
  ): QuizAttemptRepository;
  ```

**Rules:**
- `save` upserts the attempt row and its responses in one transaction. Responses are written with `INSERT ... ON CONFLICT (attempt_id, question_id) DO NOTHING`, so replaying a save can never double-score a question; the composite primary key backs this at the database level.
- `questionIds` is stored as a JSON array string, in plan order, and restored through `startQuizAttempt` + `recordResponse` (or a dedicated `restoreQuizAttempt` factory added to `quiz-attempt.ts` if the implementer finds reconstruction through the transition functions awkward — if so, that factory must validate the same invariants and be covered by its own unit test).
- `findActiveByUser` returns the single attempt whose status is `active` or `paused`, most recently updated first; `undefined` when none exists. Pausing and resuming across a process restart must round-trip.
- `listCompletedBySet` returns only `completed` attempts, oldest first, so Phase 2.3 can compute improvement between the first and the last attempt.
- `topicAccuracy` aggregates `question_responses` joined to `questions`, grouping by `topic` (a `NULL` topic maps to `undefined`), counting answered and correct.
- `incorrectQuestionIds` returns distinct question ids the user answered incorrectly and has not since answered correctly.
- All read models are plain application types; no SQLite row shapes escape the adapter.

- [ ] **Step 1: Write the failing integration tests**

Required cases in `describe("SqliteQuizAttemptRepository")`:
- round-trips an active attempt with two responses, preserving plan order and response order.
- `findById` returns `undefined` for an unknown id.
- saving the same attempt twice keeps exactly two responses (idempotent replay).
- `findActiveByUser` finds an `active` attempt, finds a `paused` attempt after a simulated restart (new repository instance over the same database), and returns `undefined` once the attempt is completed.
- `listCompletedBySet` returns only completed attempts, oldest first, with correct `correct`/`total` counts.
- `topicAccuracy` groups by topic and reports `answered`/`correct`; a question with no topic appears once with `topic: undefined`.
- `incorrectQuestionIds` returns a question answered incorrectly, and omits it after a later attempt answers it correctly.
- deleting a quiz set cascades to its attempts and responses (assert `findById` becomes `undefined`).

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test tests/integration/sqlite/sqlite-quiz-attempt.repository.test.ts`
Expected: FAIL — repository module not found.

- [ ] **Step 3: Implement the port, the mapper and the repository**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `bun test tests/integration/sqlite`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application src/adapters tests
git commit -m "feat: add sqlite quiz attempt repository with idempotent responses"
```

---

## Task 9: Review repository and Phase 1 closure

**Files:**
- Create: `src/application/ports/repositories/review.repository.ts`
- Create: `src/adapters/persistence/sqlite/repositories/sqlite-review.repository.ts`
- Create: `src/adapters/persistence/sqlite/repositories/review-item.mapper.ts`
- Create: `tests/integration/sqlite/sqlite-review.repository.test.ts`
- Modify: `README.md` (current structure section: add `domain`, `adapters/persistence/sqlite`, `tests/integration`, `scripts`)

**Interfaces:**
- Consumes: `ReviewItem`, `ReviewItemId`, `ReviewItemState` (Task 4); `QuestionId`; `Transaction`.
- Produces:
  ```ts
  export interface ReviewRepository {
  	save(item: ReviewItem): void;
  	findByQuestion(
  		telegramUserId: number,
  		questionId: QuestionId,
  	): ReviewItem | undefined;
  	listDue(
  		telegramUserId: number,
  		now: Date,
  		limit: number,
  	): readonly ReviewItem[];
  	countPending(telegramUserId: number): number;
  }

  export function createSqliteReviewRepository(
  	database: Database,
  	transaction: Transaction,
  ): ReviewRepository;
  ```

**Rules:**
- `save` upserts on the `(telegram_user_id, question_id)` unique constraint, so the same wrong answer never creates unbounded duplicate review items (the Phase 5.1 gate depends on this).
- `listDue` returns items with `due_at <= now.toISOString()` and state other than `retired`, ordered by `due_at` ascending, limited by `limit`; `limit` must be a positive safe integer.
- `countPending` counts non-retired items for the user regardless of due date.
- Dates round-trip through ISO strings; `lastReviewedAt` stays `undefined` when never reviewed.

- [ ] **Step 1: Write the failing integration tests**

Required cases in `describe("SqliteReviewRepository")`:
- round-trips a pending item, including `undefined` `lastReviewedAt`.
- saving twice for the same `(user, question)` keeps exactly one row and applies the newer state and streak.
- `findByQuestion` returns `undefined` for an unknown question and scopes by user id.
- `listDue` excludes future items, excludes `retired` items, orders by `due_at` ascending and honours `limit`; rejects a non-positive `limit`.
- `countPending` counts non-retired items only.
- deleting the question cascades the review item away.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `bun test tests/integration/sqlite/sqlite-review.repository.test.ts`
Expected: FAIL — repository module not found.

- [ ] **Step 3: Implement the port, the mapper and the repository**

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `bun test tests/integration/sqlite`
Expected: PASS.

- [ ] **Step 5: Update the README structure section**

- [ ] **Step 6: Run full verification, commit and open PR C**

```bash
bun run verify
git add src/application src/adapters tests README.md
git commit -m "feat: add sqlite review repository for repeated mistakes"
git push -u origin feat/phase-1-3-repositories
gh pr create --base feat/phase-1-2-sqlite-migrations --title "Phase 1.3: repositories" --body "<summary + verification output>"
```

**PR C acceptance criteria (Phase 1.3 gate):** repository integration tests cover happy path, constraint violations, transaction rollback and not-found cases for all three repositories; no adapter type reaches `src/application` or `src/domain`; `bun run verify` is green.

---

## Phase 1 final gate

Run after PR C is approved, before merging the chain:

- [ ] `bun run verify` from a clean tree.
- [ ] `grep -rnE "from \"(telegraf|zod|bun:sqlite|@/(application|adapters|infrastructure))" src/domain` prints nothing.
- [ ] `grep -rnE "from \"(telegraf|bun:sqlite|@/adapters)" src/application` prints nothing.
- [ ] Every acceptance gate in `DEVELOPMENT_PLAN.md` §1.1–1.3 has a test that demonstrates it; list the test name next to each gate in the PR description.
- [ ] `git status` is clean, no stray database files, no `.env`, no generated `dist/`.
