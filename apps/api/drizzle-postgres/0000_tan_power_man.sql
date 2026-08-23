CREATE TABLE "attempt_questions" (
	"attempt_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question_id" uuid NOT NULL,
	"presented_option_order" jsonb,
	CONSTRAINT "attempt_questions_attempt_id_position_pk" PRIMARY KEY("attempt_id","position"),
	CONSTRAINT "attempt_questions_attempt_question_unique" UNIQUE("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"quiz_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "attempts_legacy_unique" UNIQUE("legacy_id"),
	CONSTRAINT "attempts_status_check" CHECK ("attempts"."status" in ('active', 'paused', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"parent_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text,
	"content_md" text,
	"position" numeric(20, 10) DEFAULT '0' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pages_legacy_unique" UNIQUE("legacy_id"),
	CONSTRAINT "pages_parent_slug_unique" UNIQUE NULLS NOT DISTINCT("parent_id","slug"),
	CONSTRAINT "pages_visibility_check" CHECK ("pages"."visibility" in ('private', 'unlisted', 'public'))
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"question_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"match_key" text,
	"position" integer NOT NULL,
	CONSTRAINT "question_options_legacy_unique" UNIQUE("legacy_id"),
	CONSTRAINT "question_options_question_position_unique" UNIQUE("question_id","position")
);
--> statement-breakpoint
CREATE TABLE "question_sources" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"term_pair_id" uuid NOT NULL,
	"direction" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"quiz_id" uuid NOT NULL,
	"type" text NOT NULL,
	"prompt" text NOT NULL,
	"explanation" text,
	"source_reference" text,
	"topic" text,
	"difficulty" text NOT NULL,
	"hint" text,
	"position" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "questions_legacy_unique" UNIQUE("legacy_id"),
	CONSTRAINT "questions_quiz_position_unique" UNIQUE("quiz_id","position"),
	CONSTRAINT "questions_quiz_fingerprint_unique" UNIQUE("quiz_id","fingerprint"),
	CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty" in ('easy', 'medium', 'hard'))
);
--> statement-breakpoint
CREATE TABLE "quiz_attachments" (
	"page_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"position" numeric(20, 10) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attachments_page_id_quiz_id_pk" PRIMARY KEY("page_id","quiz_id")
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"page_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"language" text NOT NULL,
	"source" text,
	"source_chapters" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "quizzes_legacy_unique" UNIQUE("legacy_id"),
	CONSTRAINT "quizzes_status_check" CHECK ("quizzes"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "quizzes_visibility_check" CHECK ("quizzes"."visibility" in ('private', 'unlisted', 'public'))
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_ids" uuid[] NOT NULL,
	"is_correct" boolean NOT NULL,
	"typed_answer" text,
	"skipped" boolean DEFAULT false NOT NULL,
	"credit_earned" integer,
	"credit_possible" integer,
	"answered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "responses_attempt_id_question_id_pk" PRIMARY KEY("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "review_states" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"repetition_count" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"interval_days" integer,
	"stability" numeric(10, 4),
	"difficulty" numeric(10, 4),
	"last_reviewed_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid,
	"intervals_days" integer[] NOT NULL,
	"max_interval_days" integer NOT NULL,
	"max_repetitions" integer NOT NULL,
	"shuffle_options" boolean DEFAULT false NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"exam_mode" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_settings_scope_unique" UNIQUE NULLS NOT DISTINCT("scope_type","scope_id"),
	CONSTRAINT "study_settings_scope_check" CHECK ("study_settings"."scope_type" in ('owner', 'page', 'quiz'))
);
--> statement-breakpoint
CREATE TABLE "term_pairs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"quiz_id" uuid NOT NULL,
	"terms" text[] NOT NULL,
	"translations" text[] NOT NULL,
	"transcription" text,
	"example" text,
	"topic" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "term_pairs_legacy_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_term_pair_id_term_pairs_id_fk" FOREIGN KEY ("term_pair_id") REFERENCES "public"."term_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attachments" ADD CONSTRAINT "quiz_attachments_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attachments" ADD CONSTRAINT "quiz_attachments_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_states" ADD CONSTRAINT "review_states_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_pairs" ADD CONSTRAINT "term_pairs_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_quiz_status_idx" ON "attempts" USING btree ("quiz_id","status");--> statement-breakpoint
CREATE INDEX "pages_parent_idx" ON "pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "quiz_attachments_quiz_idx" ON "quiz_attachments" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "quizzes_status_idx" ON "quizzes" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "quizzes_page_idx" ON "quizzes" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "responses_question_idx" ON "responses" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "review_states_due_idx" ON "review_states" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "term_pairs_quiz_idx" ON "term_pairs" USING btree ("quiz_id");