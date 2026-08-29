--
-- PostgreSQL database dump
--

\restrict 527EeIQvc994vXJ3YHw4VAkcvNnJnmc3B3HAn6iGxhLEI27WLApxlbDq6fRgtam

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: recall
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO recall;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: recall
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO recall;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: recall
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO recall;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: recall
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: attempt_questions; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.attempt_questions (
    attempt_id uuid NOT NULL,
    "position" integer NOT NULL,
    question_id uuid NOT NULL,
    presented_option_order jsonb
);


ALTER TABLE public.attempt_questions OWNER TO recall;

--
-- Name: attempts; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.attempts (
    id uuid NOT NULL,
    legacy_id text,
    quiz_id uuid NOT NULL,
    telegram_user_id integer,
    mode text NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT attempts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text])))
);


ALTER TABLE public.attempts OWNER TO recall;

--
-- Name: pages; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.pages (
    id uuid NOT NULL,
    legacy_id text,
    parent_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    icon text,
    content_md text,
    "position" numeric(20,10) DEFAULT '0'::numeric NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT pages_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))
);


ALTER TABLE public.pages OWNER TO recall;

--
-- Name: question_options; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.question_options (
    id uuid NOT NULL,
    legacy_id text,
    question_id uuid NOT NULL,
    text text NOT NULL,
    is_correct boolean NOT NULL,
    match_key text,
    "position" integer NOT NULL
);


ALTER TABLE public.question_options OWNER TO recall;

--
-- Name: question_sources; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.question_sources (
    question_id uuid NOT NULL,
    term_pair_id uuid NOT NULL,
    direction text NOT NULL
);


ALTER TABLE public.question_sources OWNER TO recall;

--
-- Name: questions; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.questions (
    id uuid NOT NULL,
    legacy_id text,
    quiz_id uuid NOT NULL,
    type text NOT NULL,
    prompt text NOT NULL,
    explanation text,
    source_reference text,
    topic text,
    difficulty text NOT NULL,
    hint text,
    "position" integer NOT NULL,
    fingerprint text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT questions_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])))
);


ALTER TABLE public.questions OWNER TO recall;

--
-- Name: quiz_attachments; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.quiz_attachments (
    page_id uuid NOT NULL,
    quiz_id uuid NOT NULL,
    "position" numeric(20,10) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quiz_attachments OWNER TO recall;

--
-- Name: quizzes; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.quizzes (
    id uuid NOT NULL,
    legacy_id text,
    page_id uuid,
    title text NOT NULL,
    description text,
    language text NOT NULL,
    source text,
    source_chapters text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    status text NOT NULL,
    visibility text DEFAULT 'private'::text NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    archived_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT quizzes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT quizzes_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text])))
);


ALTER TABLE public.quizzes OWNER TO recall;

--
-- Name: responses; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.responses (
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_option_ids uuid[] NOT NULL,
    is_correct boolean NOT NULL,
    typed_answer text,
    skipped boolean DEFAULT false NOT NULL,
    credit_earned integer,
    credit_possible integer,
    answered_at timestamp with time zone NOT NULL
);


ALTER TABLE public.responses OWNER TO recall;

--
-- Name: review_states; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.review_states (
    question_id uuid NOT NULL,
    telegram_user_id integer,
    repetition_count integer DEFAULT 0 NOT NULL,
    lapses integer DEFAULT 0 NOT NULL,
    interval_days integer,
    stability numeric(10,4),
    difficulty numeric(10,4),
    last_reviewed_at timestamp with time zone,
    due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.review_states OWNER TO recall;

--
-- Name: study_settings; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.study_settings (
    id uuid NOT NULL,
    scope_type text NOT NULL,
    scope_id uuid,
    intervals_days integer[] NOT NULL,
    max_interval_days integer NOT NULL,
    max_repetitions integer NOT NULL,
    shuffle_options boolean DEFAULT false NOT NULL,
    shuffle_questions boolean DEFAULT false NOT NULL,
    exam_mode boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT study_settings_scope_check CHECK ((scope_type = ANY (ARRAY['owner'::text, 'page'::text, 'quiz'::text])))
);


ALTER TABLE public.study_settings OWNER TO recall;

--
-- Name: term_pairs; Type: TABLE; Schema: public; Owner: recall
--

CREATE TABLE public.term_pairs (
    id uuid NOT NULL,
    legacy_id text,
    quiz_id uuid NOT NULL,
    terms text[] NOT NULL,
    translations text[] NOT NULL,
    transcription text,
    example text,
    topic text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.term_pairs OWNER TO recall;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: recall
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: recall
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: attempt_questions; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.attempt_questions (attempt_id, "position", question_id, presented_option_order) FROM stdin;
a6a89c01-6161-8a73-a229-d32d06d52b87	0	818c6acd-d71c-884f-b789-200afa196196	\N
a6a89c01-6161-8a73-a229-d32d06d52b87	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
a6a89c01-6161-8a73-a229-d32d06d52b87	2	bd1b441b-be06-815e-a8ef-438fa70764ad	\N
fdde0f4b-347c-84da-87a8-425d55dac234	0	cd281ab2-0b80-8059-ac87-cca56165b018	\N
7c3cf6f6-b2d5-8275-a5cf-3195553052e3	0	cd281ab2-0b80-8059-ac87-cca56165b018	\N
18411bac-36b2-847e-bf65-7c7e5f66e7c8	0	cd281ab2-0b80-8059-ac87-cca56165b018	\N
a0089e72-2cc5-8625-88b3-7fffd4f89e07	0	818c6acd-d71c-884f-b789-200afa196196	\N
a0089e72-2cc5-8625-88b3-7fffd4f89e07	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
82091eb7-6926-8778-952a-a00c16b252e1	0	818c6acd-d71c-884f-b789-200afa196196	\N
82091eb7-6926-8778-952a-a00c16b252e1	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
a4b71692-5d80-86b4-a447-4b420635b696	0	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	\N
a4b71692-5d80-86b4-a447-4b420635b696	1	d70b28a9-3b88-816a-b648-f7b6f382d310	\N
a4b71692-5d80-86b4-a447-4b420635b696	2	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	\N
a4b71692-5d80-86b4-a447-4b420635b696	3	18f2dd47-df78-8767-bce8-d538e95faf7d	\N
a4b71692-5d80-86b4-a447-4b420635b696	4	2ce73501-0026-8a1f-a2f3-179d11168257	\N
a4b71692-5d80-86b4-a447-4b420635b696	5	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	\N
a4b71692-5d80-86b4-a447-4b420635b696	6	3c66d373-a56e-85b1-93cd-020a008b8464	\N
a4b71692-5d80-86b4-a447-4b420635b696	7	f793c91f-f869-8b6e-84bc-6211307ac9cf	\N
a4b71692-5d80-86b4-a447-4b420635b696	8	0ce4ea40-2eed-8840-8112-99c462ed7b18	\N
a4b71692-5d80-86b4-a447-4b420635b696	9	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	\N
a4b71692-5d80-86b4-a447-4b420635b696	10	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	\N
a4b71692-5d80-86b4-a447-4b420635b696	11	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	\N
a4b71692-5d80-86b4-a447-4b420635b696	12	54936afa-d480-8098-9fb1-bdd4b2595a41	\N
a4b71692-5d80-86b4-a447-4b420635b696	13	333d31fd-565e-8488-ba3b-f94b61de08c3	\N
a4b71692-5d80-86b4-a447-4b420635b696	14	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
a4b71692-5d80-86b4-a447-4b420635b696	15	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
a4b71692-5d80-86b4-a447-4b420635b696	16	c8e05d70-730c-88b0-b577-84e9649571c5	\N
a4b71692-5d80-86b4-a447-4b420635b696	17	67f3c878-5f15-81be-8806-3c9728b415d8	\N
a4b71692-5d80-86b4-a447-4b420635b696	18	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	\N
a4b71692-5d80-86b4-a447-4b420635b696	19	cde1048f-b752-8b92-8d91-ba64737e534e	\N
54c2e9d5-3ed2-8014-9f1d-b967a84c3ccb	0	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
54c2e9d5-3ed2-8014-9f1d-b967a84c3ccb	1	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
54c2e9d5-3ed2-8014-9f1d-b967a84c3ccb	2	c8e05d70-730c-88b0-b577-84e9649571c5	\N
54c2e9d5-3ed2-8014-9f1d-b967a84c3ccb	3	67f3c878-5f15-81be-8806-3c9728b415d8	\N
4e06b8e2-17f5-81b7-a005-ab25fba57273	0	cd281ab2-0b80-8059-ac87-cca56165b018	\N
a662da74-fd47-83c8-b939-57d93b009a6f	0	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	\N
a662da74-fd47-83c8-b939-57d93b009a6f	1	d70b28a9-3b88-816a-b648-f7b6f382d310	\N
a662da74-fd47-83c8-b939-57d93b009a6f	2	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	\N
a662da74-fd47-83c8-b939-57d93b009a6f	3	18f2dd47-df78-8767-bce8-d538e95faf7d	\N
a662da74-fd47-83c8-b939-57d93b009a6f	4	2ce73501-0026-8a1f-a2f3-179d11168257	\N
a662da74-fd47-83c8-b939-57d93b009a6f	5	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	\N
a662da74-fd47-83c8-b939-57d93b009a6f	6	3c66d373-a56e-85b1-93cd-020a008b8464	\N
a662da74-fd47-83c8-b939-57d93b009a6f	7	f793c91f-f869-8b6e-84bc-6211307ac9cf	\N
a662da74-fd47-83c8-b939-57d93b009a6f	8	0ce4ea40-2eed-8840-8112-99c462ed7b18	\N
a662da74-fd47-83c8-b939-57d93b009a6f	9	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	\N
a662da74-fd47-83c8-b939-57d93b009a6f	10	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	\N
a662da74-fd47-83c8-b939-57d93b009a6f	11	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	\N
a662da74-fd47-83c8-b939-57d93b009a6f	12	54936afa-d480-8098-9fb1-bdd4b2595a41	\N
a662da74-fd47-83c8-b939-57d93b009a6f	13	333d31fd-565e-8488-ba3b-f94b61de08c3	\N
a662da74-fd47-83c8-b939-57d93b009a6f	14	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
a662da74-fd47-83c8-b939-57d93b009a6f	15	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
a662da74-fd47-83c8-b939-57d93b009a6f	16	c8e05d70-730c-88b0-b577-84e9649571c5	\N
a662da74-fd47-83c8-b939-57d93b009a6f	17	67f3c878-5f15-81be-8806-3c9728b415d8	\N
a662da74-fd47-83c8-b939-57d93b009a6f	18	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	\N
a662da74-fd47-83c8-b939-57d93b009a6f	19	cde1048f-b752-8b92-8d91-ba64737e534e	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	0	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	1	d70b28a9-3b88-816a-b648-f7b6f382d310	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	2	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	3	18f2dd47-df78-8767-bce8-d538e95faf7d	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	4	2ce73501-0026-8a1f-a2f3-179d11168257	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	5	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	6	3c66d373-a56e-85b1-93cd-020a008b8464	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	7	f793c91f-f869-8b6e-84bc-6211307ac9cf	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	8	0ce4ea40-2eed-8840-8112-99c462ed7b18	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	9	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	10	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	11	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	12	54936afa-d480-8098-9fb1-bdd4b2595a41	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	13	333d31fd-565e-8488-ba3b-f94b61de08c3	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	14	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	15	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	16	c8e05d70-730c-88b0-b577-84e9649571c5	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	17	67f3c878-5f15-81be-8806-3c9728b415d8	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	18	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	\N
1db60439-94cb-820e-9b7a-4d44b53f380e	19	cde1048f-b752-8b92-8d91-ba64737e534e	\N
0ec954e6-f87e-8960-bd30-cae65914bf75	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
0ec954e6-f87e-8960-bd30-cae65914bf75	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
0ec954e6-f87e-8960-bd30-cae65914bf75	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
0ec954e6-f87e-8960-bd30-cae65914bf75	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
37166f82-a3b1-8e0b-9f81-3686dbf928e9	0	818c6acd-d71c-884f-b789-200afa196196	\N
37166f82-a3b1-8e0b-9f81-3686dbf928e9	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
37166f82-a3b1-8e0b-9f81-3686dbf928e9	2	bd1b441b-be06-815e-a8ef-438fa70764ad	\N
e46047f8-4046-8118-ba3c-e75fd4a26530	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
e46047f8-4046-8118-ba3c-e75fd4a26530	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
e46047f8-4046-8118-ba3c-e75fd4a26530	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
e46047f8-4046-8118-ba3c-e75fd4a26530	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
7200bb9e-1034-8cdf-8428-0a820505b77c	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
7200bb9e-1034-8cdf-8428-0a820505b77c	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
7200bb9e-1034-8cdf-8428-0a820505b77c	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
7200bb9e-1034-8cdf-8428-0a820505b77c	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
897a1223-9340-84bb-9c7c-09cef22cfeea	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
897a1223-9340-84bb-9c7c-09cef22cfeea	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
897a1223-9340-84bb-9c7c-09cef22cfeea	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
897a1223-9340-84bb-9c7c-09cef22cfeea	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
d3c237c7-4d8f-86dc-99e3-d692ab10a8d8	0	818c6acd-d71c-884f-b789-200afa196196	\N
d3c237c7-4d8f-86dc-99e3-d692ab10a8d8	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
d3c237c7-4d8f-86dc-99e3-d692ab10a8d8	2	bd1b441b-be06-815e-a8ef-438fa70764ad	\N
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
327e8e6c-2984-8c09-8f02-fec7a8fc9703	0	818c6acd-d71c-884f-b789-200afa196196	\N
327e8e6c-2984-8c09-8f02-fec7a8fc9703	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
327e8e6c-2984-8c09-8f02-fec7a8fc9703	2	bd1b441b-be06-815e-a8ef-438fa70764ad	\N
aaecfbbf-4678-8b7d-a967-b3a568fecd36	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
aaecfbbf-4678-8b7d-a967-b3a568fecd36	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
aaecfbbf-4678-8b7d-a967-b3a568fecd36	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
aaecfbbf-4678-8b7d-a967-b3a568fecd36	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
8e6514f8-adf3-868b-87b2-9f5dffa3b94d	0	818c6acd-d71c-884f-b789-200afa196196	\N
8e6514f8-adf3-868b-87b2-9f5dffa3b94d	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
8e6514f8-adf3-868b-87b2-9f5dffa3b94d	2	bd1b441b-be06-815e-a8ef-438fa70764ad	\N
d255f3b6-6507-8ecb-b862-e6779de0af92	0	818c6acd-d71c-884f-b789-200afa196196	\N
d255f3b6-6507-8ecb-b862-e6779de0af92	1	cd281ab2-0b80-8059-ac87-cca56165b018	\N
d255f3b6-6507-8ecb-b862-e6779de0af92	2	bd1b441b-be06-815e-a8ef-438fa70764ad	\N
30ea588a-77ba-8e82-abef-d273375574ce	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
30ea588a-77ba-8e82-abef-d273375574ce	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
30ea588a-77ba-8e82-abef-d273375574ce	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
30ea588a-77ba-8e82-abef-d273375574ce	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	0	f1037adb-1988-8b66-bad2-ffa44ed0825e	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	1	1924c112-1179-8e2f-ad89-68063c0fb4ba	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	2	6b378dee-6b57-89e1-9353-e8523409b93e	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	3	8ab7e970-c7c3-831d-897c-a3909736a573	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	4	926f924e-f393-85df-9a9c-d0207306c0c1	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	5	af729aba-bb95-8766-b73c-6b81997dd7b7	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	6	0e7e852f-e50b-8952-bc3e-c0c83de81cac	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	7	b931cb06-d05e-8ec6-9795-c489217db379	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	8	a24b40d9-727d-81ed-98f1-b989e072a0a0	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	9	efc13df1-fda7-8b42-8fcb-ca888f4545d5	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	10	be6554d4-f65c-811c-a2d7-0a66b186bc2c	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	11	02c3c4b9-5132-8b3e-9114-c9f146ad4f63	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	12	60b4995a-c666-8a54-bae4-ea04723842b7	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	13	ea37c658-195d-840c-a522-1955c7c6f53f	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	14	e7678d2e-ded4-8dbc-ac4e-7a1c3bf4acb7	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	15	fe874b23-e369-8879-a5cb-e44f41453788	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	16	9f1784c8-79a9-8412-ac89-aa73c30edb4b	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	17	78f9fdd3-d042-82f6-9f78-72fd962f617b	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	18	8dfd3a56-a49e-8031-afaa-39c372f61ec9	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	19	0f529282-d38c-8783-8b0b-f65e31c4abc0	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	20	4c256dee-8118-8976-945c-99e84cacea9b	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	21	a53aa7ae-7e47-8eb1-bb3b-5ef27ec5d3aa	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	22	7bff993f-8a2e-8c2a-8d1b-e57e392574a5	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	23	67493a3e-9e27-831e-b630-1b721eca7d41	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	24	d8148550-5148-8b1e-974b-6ed02a6754c1	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	25	6732320d-e771-86b1-8afb-292069131611	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	26	4bda6e56-3c08-82fb-b6d9-87e8e37fd461	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	27	00ca5865-c1a1-88f1-b3b8-dade63883e8d	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	28	77ab2f42-4ae7-8b10-8fea-15e43c590a57	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	29	94cec9f1-4846-84b1-9dc8-8d93efd417ad	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	30	0354deb1-6fb6-88a3-a2ac-4bb19afb7224	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	31	0b73f77e-db3d-8899-a73d-c60fb6c29683	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	32	7e92a1d0-a3f6-83fc-a7be-e88f71419f68	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	33	0f08d9e8-0b97-82e5-9bfa-d7931ba7c404	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	34	e53929bf-d21f-8806-82ff-7530cdcf641a	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	35	a8efb48a-b05e-8768-b3fd-bcfbdb9ed074	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	36	ddbc9a48-4047-8646-ac6d-6e85ded76f42	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	37	d23670eb-5087-8357-9940-175b65829981	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	38	01a2cbe4-f74d-88c9-a8a3-514b3ecf4f97	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	39	bdecf5a6-62bd-8b62-bdc6-6a9f54c2831c	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	40	43cb3fe3-b62c-8baf-b77c-28f9c1ad529e	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	41	c5555818-485c-8f68-985f-bfd5fddc5eba	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	42	f14b8c4d-1afc-8adc-9006-308318e0e258	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	43	024c7c63-d5f4-8f29-9470-ca3af756dc51	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	44	13561850-3a37-82af-84ce-454f4caf47fe	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	45	cf7bb76e-641e-8b56-bccc-9de7922c735e	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	46	5affe485-36d6-8a5e-8992-eb9f9d093cbf	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	47	fc1c519c-dee8-8641-9d33-182724f0e452	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	48	833020c1-5468-88f3-a31c-f81a99229fe4	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	49	f021f898-d2cc-887e-84be-dc02c320abd2	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	50	bf9f079f-f9ed-8ad0-86bf-d1c0e2aefc02	\N
516c50d3-2206-89d1-9109-b5e4c9e9052e	51	200dd31c-b6ea-8d44-a350-1c2daf328f30	\N
fe6515ed-94fa-80af-abca-5e057ac36118	0	d70b28a9-3b88-816a-b648-f7b6f382d310	\N
fe6515ed-94fa-80af-abca-5e057ac36118	1	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	\N
fe6515ed-94fa-80af-abca-5e057ac36118	2	18f2dd47-df78-8767-bce8-d538e95faf7d	\N
fe6515ed-94fa-80af-abca-5e057ac36118	3	2ce73501-0026-8a1f-a2f3-179d11168257	\N
fe6515ed-94fa-80af-abca-5e057ac36118	4	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	\N
fe6515ed-94fa-80af-abca-5e057ac36118	5	3c66d373-a56e-85b1-93cd-020a008b8464	\N
fe6515ed-94fa-80af-abca-5e057ac36118	6	f793c91f-f869-8b6e-84bc-6211307ac9cf	\N
fe6515ed-94fa-80af-abca-5e057ac36118	7	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
fe6515ed-94fa-80af-abca-5e057ac36118	8	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
fe6515ed-94fa-80af-abca-5e057ac36118	9	c8e05d70-730c-88b0-b577-84e9649571c5	\N
fe6515ed-94fa-80af-abca-5e057ac36118	10	67f3c878-5f15-81be-8806-3c9728b415d8	\N
294a5281-1ef8-84f5-a683-24c057d983f1	0	d70b28a9-3b88-816a-b648-f7b6f382d310	\N
294a5281-1ef8-84f5-a683-24c057d983f1	1	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	\N
294a5281-1ef8-84f5-a683-24c057d983f1	2	18f2dd47-df78-8767-bce8-d538e95faf7d	\N
294a5281-1ef8-84f5-a683-24c057d983f1	3	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
294a5281-1ef8-84f5-a683-24c057d983f1	4	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
294a5281-1ef8-84f5-a683-24c057d983f1	5	c8e05d70-730c-88b0-b577-84e9649571c5	\N
294a5281-1ef8-84f5-a683-24c057d983f1	6	67f3c878-5f15-81be-8806-3c9728b415d8	\N
418557ad-380a-83ad-8120-7bec8969a6a2	0	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
d8299a78-5ed7-8737-8ebc-289535e28f74	0	f54ae8b5-f277-8127-80df-11f274168b39	\N
d8299a78-5ed7-8737-8ebc-289535e28f74	1	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	\N
d8299a78-5ed7-8737-8ebc-289535e28f74	2	877742ee-5068-8db5-af02-6c30eefc4f2d	\N
d8299a78-5ed7-8737-8ebc-289535e28f74	3	29fa93aa-0d3c-8809-bd19-bbc794792ecf	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	0	f1037adb-1988-8b66-bad2-ffa44ed0825e	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	1	1924c112-1179-8e2f-ad89-68063c0fb4ba	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	2	6b378dee-6b57-89e1-9353-e8523409b93e	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	3	8ab7e970-c7c3-831d-897c-a3909736a573	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	4	926f924e-f393-85df-9a9c-d0207306c0c1	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	5	af729aba-bb95-8766-b73c-6b81997dd7b7	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	6	0e7e852f-e50b-8952-bc3e-c0c83de81cac	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	7	b931cb06-d05e-8ec6-9795-c489217db379	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	8	a24b40d9-727d-81ed-98f1-b989e072a0a0	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	9	efc13df1-fda7-8b42-8fcb-ca888f4545d5	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	10	be6554d4-f65c-811c-a2d7-0a66b186bc2c	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	11	02c3c4b9-5132-8b3e-9114-c9f146ad4f63	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	12	60b4995a-c666-8a54-bae4-ea04723842b7	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	13	ea37c658-195d-840c-a522-1955c7c6f53f	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	14	e7678d2e-ded4-8dbc-ac4e-7a1c3bf4acb7	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	15	fe874b23-e369-8879-a5cb-e44f41453788	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	16	9f1784c8-79a9-8412-ac89-aa73c30edb4b	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	17	78f9fdd3-d042-82f6-9f78-72fd962f617b	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	18	8dfd3a56-a49e-8031-afaa-39c372f61ec9	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	19	0f529282-d38c-8783-8b0b-f65e31c4abc0	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	20	4c256dee-8118-8976-945c-99e84cacea9b	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	21	a53aa7ae-7e47-8eb1-bb3b-5ef27ec5d3aa	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	22	7bff993f-8a2e-8c2a-8d1b-e57e392574a5	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	23	67493a3e-9e27-831e-b630-1b721eca7d41	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	24	d8148550-5148-8b1e-974b-6ed02a6754c1	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	25	6732320d-e771-86b1-8afb-292069131611	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	26	4bda6e56-3c08-82fb-b6d9-87e8e37fd461	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	27	00ca5865-c1a1-88f1-b3b8-dade63883e8d	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	28	77ab2f42-4ae7-8b10-8fea-15e43c590a57	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	29	94cec9f1-4846-84b1-9dc8-8d93efd417ad	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	30	0354deb1-6fb6-88a3-a2ac-4bb19afb7224	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	31	0b73f77e-db3d-8899-a73d-c60fb6c29683	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	32	7e92a1d0-a3f6-83fc-a7be-e88f71419f68	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	33	0f08d9e8-0b97-82e5-9bfa-d7931ba7c404	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	34	e53929bf-d21f-8806-82ff-7530cdcf641a	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	35	a8efb48a-b05e-8768-b3fd-bcfbdb9ed074	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	36	ddbc9a48-4047-8646-ac6d-6e85ded76f42	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	37	d23670eb-5087-8357-9940-175b65829981	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	38	01a2cbe4-f74d-88c9-a8a3-514b3ecf4f97	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	39	bdecf5a6-62bd-8b62-bdc6-6a9f54c2831c	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	40	43cb3fe3-b62c-8baf-b77c-28f9c1ad529e	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	41	c5555818-485c-8f68-985f-bfd5fddc5eba	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	42	f14b8c4d-1afc-8adc-9006-308318e0e258	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	43	024c7c63-d5f4-8f29-9470-ca3af756dc51	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	44	13561850-3a37-82af-84ce-454f4caf47fe	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	45	cf7bb76e-641e-8b56-bccc-9de7922c735e	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	46	5affe485-36d6-8a5e-8992-eb9f9d093cbf	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	47	fc1c519c-dee8-8641-9d33-182724f0e452	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	48	833020c1-5468-88f3-a31c-f81a99229fe4	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	49	f021f898-d2cc-887e-84be-dc02c320abd2	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	50	bf9f079f-f9ed-8ad0-86bf-d1c0e2aefc02	\N
60dd2594-3f02-8d60-872b-0b58da676bf8	51	200dd31c-b6ea-8d44-a350-1c2daf328f30	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	0	485bea2b-95ad-8185-b0ea-48befaef18ad	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	1	c2fa4fd5-de53-8ade-87e8-781b4ddb67c2	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	2	03048403-511c-85ec-86e4-378e9117b5db	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	3	d815296e-fc38-82e9-afe6-cdb07814ca9d	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	4	9a18a4db-0dbb-8e43-b47f-f5560016dedb	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	5	f4fccf84-7594-8ab7-ad24-959184667926	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	6	853e9353-933b-853b-a927-92bde0685559	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	7	f1ea73ab-6036-8a5c-8eee-b2d75e91b74b	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	8	ab87fbf3-6331-8bef-a903-f673df12aa0b	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	9	eb365fc9-8ea7-8f18-b591-43a21df9fa29	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	10	9f22978d-d803-8181-a4d6-8e7ee9a5fc8a	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	11	02cdf03d-9f2c-8ce4-8662-10289e1887c0	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	12	f9c7d64f-a85d-85f7-b0b3-e73367bfad01	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	13	3c8437d0-01fe-8296-b103-0d88203c29f4	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	14	240ed98f-7280-8081-ac83-966292f63e5d	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	15	9bf90618-9cff-8bf9-a04a-d7069086ec32	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	16	725a8b84-0a4d-80d9-9dce-b885f56a676c	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	17	df7a1652-262f-8e8e-9ca7-2df2829c7a28	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	18	aac13011-f59d-84da-9dad-ea7fb7eebefb	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	19	dd00a0fa-d4cf-81e3-8405-0bb23cb61d67	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	20	0776f85d-da36-88ba-86ba-d7a1aeb9229b	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	21	cbfaadb9-096a-85ab-be35-18eda4a5a71b	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	22	4620b24e-e9c3-8ab1-a2e0-83dd222381fb	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	23	9df3aa48-316d-8826-a0a4-9cd0cbad3bff	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	24	66f82326-e5d0-8cc5-82c2-90718f8bb2e9	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	25	ade4481c-3395-88fe-8c4b-63449a28a2e2	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	26	13d2b00b-9048-8726-810c-3aadfe70d16a	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	27	8b566ae7-fd72-826e-a495-10de8d99e348	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	28	5bc6a038-78b1-8992-9015-010b5a096faf	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	29	8112f2b1-c5b7-8cdd-aa6f-a2b4d48358b7	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	30	55d15681-d4f1-8936-a6cc-10885b7446ae	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	31	b1c92baf-3029-894e-bfd3-332d5d4c79df	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	32	f756a3a4-7e7c-819b-9012-d56c63291d97	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	33	545a6838-e7bb-8e79-892a-8fb95d0a2ae1	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	34	eb245695-0058-8d64-8443-0232a7b1a47d	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	35	d22aa0a3-1baf-842d-8db8-4a2bfbb86bc1	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	36	7612de5e-59eb-84a2-be24-cb050467375f	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	37	e71a9f81-33d7-851f-81d4-caf732ca0723	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	38	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	39	96f6dc83-8585-87d1-9423-23d96c95ecba	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	40	b7fa0752-b2b6-8caf-8dfb-fa53806a3a10	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	41	d20f81f7-9fe1-88dd-b241-ba1cacfe14b1	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	42	3881cb10-a5a8-8552-bb99-342a39c5ee75	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	43	0d89095f-c9e2-8c78-b4a6-3c05a9e00d21	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	44	7ce6ccec-a9c4-8401-a325-18f4317acbff	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	45	395daae3-c9e9-83a5-a290-fefc4ce1d0ba	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	46	9b6c4c20-4de2-8a6c-92f6-b4ee3cf5127b	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	47	b1c50d75-21db-84cd-beea-8cd9c9b679f4	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	48	cc0b7b72-e745-887e-907d-b0785c13a508	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	49	032e4bbc-d5df-83f7-af06-3636fe65a0a9	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	50	5df93fa2-3d18-82ef-a24e-f6b780945d6a	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	51	c466d667-35e4-85ff-9026-785bc93857dd	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	52	0fbc89c1-f1de-8cd0-abaf-a6881c401929	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	53	f8b8bc29-6d69-8ba3-b600-42766f969edf	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	54	59c2e542-6697-808a-a453-7f1676149810	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	55	055d6b8a-b534-80c0-9e32-77a218ba2780	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	56	9070dbb9-0c94-88bc-9365-025d939eea7f	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	57	cd2591b3-5949-87e4-964e-7191a7d9fbc8	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	58	efd58ea6-1580-8545-b4a4-17ff92fbdf46	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	59	a2a1e4d4-5e56-88a1-a94e-cdcd86aebec6	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	60	548ef5e9-2406-8ac4-98d8-99e497438a8a	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	61	67abaf8f-f2e9-8b68-be07-f38808a09aa6	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	62	2668d303-4413-86de-beee-702a7d54082c	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	63	02beb82d-dc1a-8e99-b768-07f887ce32f4	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	64	1c2f9159-83e6-89f6-9d03-67b85daf5d5b	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	65	d539ffb3-1414-83d4-a888-392bacfe9a04	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	66	bf4dd249-d14f-8ef6-b1f1-8bb423fb3cae	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	67	8184535d-6c50-812b-975e-f6a5c5a336c2	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	68	398e6cd8-2e76-8eaa-a5bb-aaf85c5012fa	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	69	ce78c61c-aa9b-8ae0-9a4f-881a3c1b5f91	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	70	51fda0f9-705b-8cd9-8582-879256383a87	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	71	34c6010a-6ae8-8633-9cf8-54e3d309e611	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	72	6327f423-a733-83c6-85a9-ab12704b7dac	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	73	c9c7ecfc-de70-8235-be89-074147fc8ee3	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	74	753283f9-0464-80a8-aaa4-cc70c15284ac	\N
86aba442-254e-88a3-b1a9-6e78d11f4d18	75	b04204c8-0b9a-88c9-be26-dfd354d6356c	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	0	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	1	d70b28a9-3b88-816a-b648-f7b6f382d310	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	2	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	3	18f2dd47-df78-8767-bce8-d538e95faf7d	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	4	2ce73501-0026-8a1f-a2f3-179d11168257	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	5	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	6	3c66d373-a56e-85b1-93cd-020a008b8464	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	7	f793c91f-f869-8b6e-84bc-6211307ac9cf	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	8	0ce4ea40-2eed-8840-8112-99c462ed7b18	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	9	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	10	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	11	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	12	54936afa-d480-8098-9fb1-bdd4b2595a41	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	13	333d31fd-565e-8488-ba3b-f94b61de08c3	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	14	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	15	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	16	c8e05d70-730c-88b0-b577-84e9649571c5	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	17	67f3c878-5f15-81be-8806-3c9728b415d8	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	18	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	\N
6ab8a889-a067-8365-9e0c-ae00b69721f5	19	cde1048f-b752-8b92-8d91-ba64737e534e	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	0	d753cdd4-4d6e-8b96-b924-b979f66ec8c6	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	1	788c11ea-b800-8c85-ab83-0df2e4f3923c	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	2	40a40575-be0e-8573-af1a-ddd4b1862ce5	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	3	468da566-061c-8d59-9974-55c09e8215bb	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	4	d65cfb4c-062a-8450-bba8-ccb846fe76a1	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	5	86557979-9c3c-8f79-80cb-329e36c5e99e	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	6	2bd04385-e605-8bf3-b2f1-e0a7c36cd766	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	7	bd2c9751-98b0-88f7-9223-f29721376a9e	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	8	6f9b6517-a5d3-8721-bef9-ff23a3809351	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	9	77866774-fb69-8499-8aa7-f8530ca764dc	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	10	1714869f-9ff5-8137-a14b-a99a945cf514	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	11	15535a2d-826e-8205-a33b-41f47925d22e	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	12	34f29309-50df-8290-b944-03e027d0c59d	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	13	deeeb039-35df-854d-a816-601d7386c7ce	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	14	01ffa53b-2875-8d4c-95f5-da4c04c89f9e	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	15	ba03a02e-7bcf-8475-952a-7c760012c37e	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	16	feadd348-a8d7-84f7-9e20-d9849b3d4157	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	17	95871f4e-3c26-8d26-88e6-572d96da602f	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	18	79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	19	800e98ae-c6b5-824b-826c-c8cffe76ff57	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	20	8b76ee55-c231-8734-8e63-384a82f24116	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	21	517567ba-4265-8ef8-849a-6a3c7890eeea	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	22	680c9336-42f1-84fe-b056-2611e0450aa5	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	23	1c19d9ac-239b-8cc5-8059-d54271d9ba38	\N
f0ef689e-c32e-8b2f-abac-f443552c4df5	24	868f6f7d-37cc-88f0-8d60-3c3651525291	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	0	ac4aa3b3-11c9-8125-aa74-261b5e56310e	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	1	eeb52fd5-522c-80dc-a4f7-c2a83b44421c	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	2	e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	3	fd427a6d-34dc-88b4-b938-f00097aabda9	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	4	9a211a19-8d92-825c-819d-f45f08b1dbb0	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	5	a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	6	79220895-4e55-8f69-8ba0-5faad9e97f12	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	7	10b59ad5-03cb-86fc-a265-9ceb0a087bd0	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	8	4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	9	cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	10	20010d78-12a6-8783-bc7f-386366215af6	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	11	98d2f28b-b220-8068-9755-1eae8ff052d2	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	12	ee939949-2555-851e-9674-f27bebab1af0	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	13	d787de3a-98bd-8d5b-be33-fa8c801a8e46	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	14	2834179a-ca26-8275-92a3-b05000ccb4b1	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	15	3c8c3c15-79fa-8ee9-918b-ef8495d69cad	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	16	89e593ff-4696-8e64-8c9d-5d386aa2b437	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	17	3c637446-91c1-8984-9563-80c1bcd8f0b3	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	18	f31739e3-4257-8ee6-8fcc-377f3f275fa4	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	19	5f318fff-368e-85d2-9fc5-59f8efa0d6dd	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	20	22cd375b-1acf-8360-ba2a-26e3b4f1c529	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	21	2cfa8251-a04b-8e69-a160-89bf1b78e622	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	22	5dd4bdfd-e18d-87ff-9f05-9c3447893b49	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	23	e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	24	9a68cdf4-4762-85b8-b981-b95361a814e3	\N
c3d978fb-924b-8f2f-b75c-46a06e6117f7	25	a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	0	0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	1	c4ccdb06-8158-8298-a9fe-33d186ee146e	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	2	518b33e1-4334-8a58-84b1-0dd99cdac6ce	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	3	70200632-c1de-8d49-babd-170d2b896826	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	4	1ec19a39-3492-8435-a404-bc53f87dc33a	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	5	251ffd80-870d-8f7b-b149-aaa077b66e47	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	6	28d48723-0ad1-8ffa-804a-fa45f0bfda83	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	7	547d8cd7-55dc-81ed-8dd4-ed5f115ea42b	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	8	48dfcd45-c54f-8827-930f-786dfe516c63	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	9	1870667a-01ad-8bb2-9ff1-243c8b27ae5a	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	10	98200032-2db8-8e2d-b646-f885d9ca4259	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	11	1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	12	4a0f96f0-653a-81df-a77c-384300dade32	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	13	64fabd3d-6863-8422-907a-250c3ab5b289	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	14	fa190593-0f0f-872c-9dc0-88516b47f762	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	15	b08dcd53-dc0a-8705-a742-6e4c50302aa5	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	16	c73ca850-0c62-8370-bb20-ff10b9ef8ed1	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	17	cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	18	762cd5b1-d4fa-833f-9f7a-5d64162d960d	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	19	e0d32edc-4908-83e4-805f-8945c738605c	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	20	52ba481c-097d-8cea-bb3f-9f43ed2b2be1	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	21	0ba44dfc-8221-8888-ba76-ac30a34ca3a1	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	22	f63867aa-4dea-82bd-b5f4-def14df0b116	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	23	e6efc7ff-23ee-8457-8254-8d01416835a2	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	24	8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	25	fffb38a6-067b-8733-bc78-3162c40cbf6a	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	26	fef1cb06-7f6a-8698-a69a-6d9895bf82bf	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	27	e36595fa-b28d-8cf0-916e-d8b649288822	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	28	f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	29	29149c08-624b-8964-8532-e7bb888eafd3	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	30	6ea13554-4f77-8120-a798-703b4efcd29c	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	31	cf13f13c-e8e9-8c93-858a-4df6a31c258c	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	32	d9606bee-fed2-8305-8fc4-18117c0dcba3	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	33	09be3ff3-1403-891d-aea7-d6ae41a62bc8	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	34	efa69e8b-d383-8371-b742-716e644512f4	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	35	94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	36	226ce076-a057-8ef8-a48e-0669ad379701	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	37	c1b61b3f-d9ea-87db-a256-3e5ab2686e53	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	38	81e06311-a749-8c85-b477-4c2c213c0db5	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	39	d9cf128e-ecea-8533-b85c-eab045522b9a	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	40	3dc0172a-bad6-89de-8207-cff14f2b95f5	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	41	0f67d24b-0a4f-8acb-9858-1cf7db90f854	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	42	7b0be6e7-7d15-8d22-a99c-c008bee13204	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	43	27b0780a-72a9-898b-95b6-593afbb151f5	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	44	ee033d47-a447-8c33-8f22-da9c2c1139ba	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	45	902657f7-edd5-828f-8768-56e35f1166b6	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	46	1789be8f-08a0-8c7d-ad5a-ca56c5070b12	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	47	6e65f4d6-d90b-8157-9002-f7118f211efe	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	48	c1f0db99-722f-8a49-afef-939116ea9e24	\N
a7408889-377b-86cd-a3c3-deb5d1380daf	49	b206788a-01b9-8fd2-bd71-a2c9415ba174	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	0	c37c9ae4-666f-801c-892d-16efaf60a66d	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	1	9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	2	13525375-1855-87f9-a506-ad882d6e9662	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	3	2bf82f23-7734-8f97-9e42-97abb45eefa6	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	4	19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	5	1ad09b97-f93c-8a17-b194-dc1cf2067597	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	6	c2af6150-ffac-8294-8e92-fd0281ffce05	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	7	f769fe1c-d743-88a2-9add-f1cc3f94fe03	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	8	c7e7d4d9-1faa-888a-8614-f4e329ef6f16	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	9	8c7e731b-b835-8095-9b01-56763a4209d9	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	10	658715ed-295b-84ab-9144-c532e6b4ee79	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	11	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	12	290c3db5-299b-8d89-8151-1d9abc8584d7	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	13	c2c200f0-4559-8d23-8883-8b5577a99c9e	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	14	54e7ac12-7800-846c-833f-6e8bdf55ea7d	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	15	db2f66db-5d99-823d-a2ec-3f29d907b28f	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	16	bf69aa1e-d263-882f-93ca-94634446955b	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	17	3d9c4cc6-2e85-886e-91c9-a135a8467c45	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	18	7f738a26-77d8-802c-a087-d96d3083c5d3	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	19	7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	20	f8101924-53a1-8a05-98fe-0f7543eba194	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	21	1a963fd5-5a70-890d-8500-a4076dddd161	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	22	727a7d0e-a227-852b-9493-e6e5516f5093	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	23	a6ad60b9-0b48-82bb-98ea-edc36fbf1756	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	24	daa7f706-e343-8d89-969f-a2ef67eb4ac9	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	25	cf9a6f8d-d091-8c5d-80e3-1db49f31623a	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	26	ca01857e-ebd2-8cad-af43-7c9d5f2e1849	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	27	4050b806-1050-896c-963a-30fbfa3a383b	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	28	6cf248b3-ef20-81c0-8ffd-25cb9020ada0	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	29	2f3a6ad2-3e01-8532-aadd-18e0cffece86	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	30	f4c17d81-0f88-8f70-86bf-f48e5ec04854	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	31	80e95d2a-436a-82b9-b270-a3336b065c3f	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	32	ee897593-a4d0-8de2-af3b-3ca065d53e26	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	33	bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	34	0a91ac19-81f4-83f7-aea2-83f713b46764	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	35	5691bb7c-8592-8999-a296-143809294193	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	36	8b7978e3-2ade-893a-ba36-e7497326659c	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	37	cfecff05-f00f-8178-97d7-27b450543d93	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	38	4f0f05b6-6bcc-8201-9b2b-4a5b5975b505	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	39	fd26ad66-1a47-8ba0-bf6c-2111da50584c	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	40	691f4b64-6f30-889c-836a-d09001606728	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	41	4e9568c2-787a-8d19-ba7c-5b0dc71a2c4f	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	42	65789a15-ec78-8505-82ea-f4df69754a07	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	43	be54437f-d5e9-876b-b691-27009848bb48	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	44	e43bbddf-419b-8165-bf19-3e8654f82eaf	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	45	f8a2fe7c-7da1-8a6b-bd07-af42744f554b	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	46	75e38364-4e93-831f-8d1e-73f96601b1e8	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	47	336283db-749b-8cea-b5b5-a670d877a41d	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	48	9718cbdc-48f6-8e50-a412-a9589360f397	\N
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	49	68444d79-c6c7-80ad-b5d4-0daf97754e11	\N
56232963-20e4-47ed-b958-1905f2f124fd	0	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	\N
56232963-20e4-47ed-b958-1905f2f124fd	1	d70b28a9-3b88-816a-b648-f7b6f382d310	\N
56232963-20e4-47ed-b958-1905f2f124fd	2	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	\N
56232963-20e4-47ed-b958-1905f2f124fd	3	18f2dd47-df78-8767-bce8-d538e95faf7d	\N
56232963-20e4-47ed-b958-1905f2f124fd	4	2ce73501-0026-8a1f-a2f3-179d11168257	\N
56232963-20e4-47ed-b958-1905f2f124fd	5	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	\N
56232963-20e4-47ed-b958-1905f2f124fd	6	3c66d373-a56e-85b1-93cd-020a008b8464	\N
56232963-20e4-47ed-b958-1905f2f124fd	7	f793c91f-f869-8b6e-84bc-6211307ac9cf	\N
56232963-20e4-47ed-b958-1905f2f124fd	8	0ce4ea40-2eed-8840-8112-99c462ed7b18	\N
56232963-20e4-47ed-b958-1905f2f124fd	9	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	\N
56232963-20e4-47ed-b958-1905f2f124fd	10	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	\N
56232963-20e4-47ed-b958-1905f2f124fd	11	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	\N
56232963-20e4-47ed-b958-1905f2f124fd	12	54936afa-d480-8098-9fb1-bdd4b2595a41	\N
56232963-20e4-47ed-b958-1905f2f124fd	13	333d31fd-565e-8488-ba3b-f94b61de08c3	\N
56232963-20e4-47ed-b958-1905f2f124fd	14	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	\N
56232963-20e4-47ed-b958-1905f2f124fd	15	7da3ea12-5863-8c58-99ac-cd058ab2634d	\N
56232963-20e4-47ed-b958-1905f2f124fd	16	c8e05d70-730c-88b0-b577-84e9649571c5	\N
56232963-20e4-47ed-b958-1905f2f124fd	17	67f3c878-5f15-81be-8806-3c9728b415d8	\N
56232963-20e4-47ed-b958-1905f2f124fd	18	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	\N
56232963-20e4-47ed-b958-1905f2f124fd	19	cde1048f-b752-8b92-8d91-ba64737e534e	\N
\.


--
-- Data for Name: attempts; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.attempts (id, legacy_id, quiz_id, telegram_user_id, mode, status, started_at, updated_at, completed_at) FROM stdin;
a6a89c01-6161-8a73-a229-d32d06d52b87	584q4h2f1t0f505o6s	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	full	completed	2026-08-08 10:11:10.967+00	2026-08-08 10:12:10.717+00	2026-08-08 10:12:10.717+00
fdde0f4b-347c-84da-87a8-425d55dac234	236f0n3b7341446434	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	mistakes	completed	2026-08-08 10:18:08.964+00	2026-08-08 10:18:16.814+00	2026-08-08 10:18:16.814+00
7c3cf6f6-b2d5-8275-a5cf-3195553052e3	5b4p1d056p665v2c2z	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	mistakes	completed	2026-08-08 10:18:20.022+00	2026-08-08 10:18:41.32+00	2026-08-08 10:18:41.32+00
18411bac-36b2-847e-bf65-7c7e5f66e7c8	5n3t4i3p311m5e5z6e	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	mistakes	completed	2026-08-08 10:18:44.706+00	2026-08-08 10:20:51.566+00	2026-08-08 10:20:51.566+00
a0089e72-2cc5-8625-88b3-7fffd4f89e07	6w370u4r3w1h3b5j22	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	weak_topics	completed	2026-08-08 10:20:54.942+00	2026-08-08 10:21:12.096+00	2026-08-08 10:21:12.096+00
82091eb7-6926-8778-952a-a00c16b252e1	5a503k150b3e401d5s	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	weak_topics	completed	2026-08-08 10:21:18.26+00	2026-08-08 10:21:27.844+00	2026-08-08 10:21:27.844+00
a4b71692-5d80-86b4-a447-4b420635b696	0h031z2m561t29325s	09501038-b4de-8557-822b-a486db4bf004	797736131	full	completed	2026-08-13 21:33:11.708+00	2026-08-13 21:37:04.155+00	2026-08-13 21:37:04.155+00
54c2e9d5-3ed2-8014-9f1d-b967a84c3ccb	3i5s5h426o6k344n0r	09501038-b4de-8557-822b-a486db4bf004	797736131	weak_topics	completed	2026-08-13 21:37:14.606+00	2026-08-13 21:37:27.391+00	2026-08-13 21:37:27.391+00
4e06b8e2-17f5-81b7-a005-ab25fba57273	3820200o2n0u2p1353	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	mistakes	completed	2026-08-13 21:37:32.497+00	2026-08-15 05:02:33.627+00	2026-08-15 05:02:33.627+00
a662da74-fd47-83c8-b939-57d93b009a6f	674j3c5d2o20362n3d	09501038-b4de-8557-822b-a486db4bf004	797736131	full	completed	2026-08-15 05:02:51.004+00	2026-08-15 05:04:06.603+00	2026-08-15 05:04:06.603+00
1db60439-94cb-820e-9b7a-4d44b53f380e	274b0z48002e3g2r3p	09501038-b4de-8557-822b-a486db4bf004	797736131	full	completed	2026-08-15 05:05:48.429+00	2026-08-15 05:05:52.932+00	2026-08-15 05:05:52.932+00
0ec954e6-f87e-8960-bd30-cae65914bf75	010t5c0455340f5669	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 06:00:03.472+00	2026-08-15 06:00:03.482+00	2026-08-15 06:00:03.482+00
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	653x40313a1g66423b	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 06:00:09.818+00	2026-08-15 06:00:09.83+00	2026-08-15 06:00:09.83+00
37166f82-a3b1-8e0b-9f81-3686dbf928e9	0x6e171a1w2o0u2j13	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	full	completed	2026-08-15 06:05:01.674+00	2026-08-15 06:05:16.072+00	2026-08-15 06:05:16.072+00
e46047f8-4046-8118-ba3c-e75fd4a26530	660917656u1f4k2y02	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 06:05:23.902+00	2026-08-15 06:06:16.96+00	2026-08-15 06:06:16.96+00
7200bb9e-1034-8cdf-8428-0a820505b77c	1a6u736x4b103d1s5y	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 06:06:39.666+00	2026-08-15 06:07:21.848+00	2026-08-15 06:07:21.848+00
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	722u1e514p1t5k3w1o	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 17:42:44.902+00	2026-08-15 17:43:23.485+00	2026-08-15 17:43:23.485+00
897a1223-9340-84bb-9c7c-09cef22cfeea	71176t4b1u0u3b2w2h	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 17:43:40.058+00	2026-08-15 17:44:26.292+00	2026-08-15 17:44:26.292+00
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	3x6d336q5a1749253j	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 18:25:46.038+00	2026-08-15 18:26:24.01+00	2026-08-15 18:26:24.01+00
d3c237c7-4d8f-86dc-99e3-d692ab10a8d8	6126483k492x4z3d5s	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	full	completed	2026-08-15 20:47:02.369+00	2026-08-15 20:47:22.4+00	2026-08-15 20:47:22.4+00
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	62236p1155220d4l54	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 20:47:41.085+00	2026-08-15 20:48:12.61+00	2026-08-15 20:48:12.61+00
327e8e6c-2984-8c09-8f02-fec7a8fc9703	1z0n2y4u4m246t0j5m	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	full	completed	2026-08-15 20:49:38.728+00	2026-08-15 20:50:03.567+00	2026-08-15 20:50:03.567+00
aaecfbbf-4678-8b7d-a967-b3a568fecd36	6p56371i0j386s5x3l	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-15 20:50:24.628+00	2026-08-15 20:50:56.802+00	2026-08-15 20:50:56.802+00
8e6514f8-adf3-868b-87b2-9f5dffa3b94d	442z1e2w4d4a565i36	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	full	completed	2026-08-16 06:00:38.46+00	2026-08-16 06:00:53.608+00	2026-08-16 06:00:53.608+00
d255f3b6-6507-8ecb-b862-e6779de0af92	4l3n6y1q7336650g5m	b1177332-3109-8cdb-ab5e-942bf9c85ef7	797736131	full	completed	2026-08-16 06:53:29.487+00	2026-08-16 06:53:40.558+00	2026-08-16 06:53:40.558+00
30ea588a-77ba-8e82-abef-d273375574ce	2z6v4e1k5m0s0i4w6x	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-17 14:50:29.321+00	2026-08-17 14:51:01.008+00	2026-08-17 14:51:01.008+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	1g5b24731h263a0o6t	bcd84e48-222b-887e-9937-ee30570c01ba	797736131	full	completed	2026-08-17 17:22:29.625+00	2026-08-17 17:26:59.655+00	2026-08-17 17:26:59.655+00
fe6515ed-94fa-80af-abca-5e057ac36118	4n5m735c5p67063670	09501038-b4de-8557-822b-a486db4bf004	797736131	weak_topics	completed	2026-08-19 20:36:14.108+00	2026-08-19 20:39:16.605+00	2026-08-19 20:39:16.605+00
294a5281-1ef8-84f5-a683-24c057d983f1	3g24455n3u466c0k6n	09501038-b4de-8557-822b-a486db4bf004	797736131	weak_topics	completed	2026-08-19 20:39:43.948+00	2026-08-19 20:39:59.93+00	2026-08-19 20:39:59.93+00
418557ad-380a-83ad-8120-7bec8969a6a2	4w690m3205481j704y	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-19 20:40:05.45+00	2026-08-19 20:40:14.235+00	2026-08-19 20:40:14.235+00
d8299a78-5ed7-8737-8ebc-289535e28f74	3h1y4p0y28470b561q	26205776-4908-8a07-ac8e-aa997bd7b85e	797736131	full	completed	2026-08-19 20:40:39.654+00	2026-08-19 20:41:07.607+00	2026-08-19 20:41:07.607+00
60dd2594-3f02-8d60-872b-0b58da676bf8	1a6i4x043l222j0g3n	bcd84e48-222b-887e-9937-ee30570c01ba	797736131	full	completed	2026-08-19 21:42:22.506+00	2026-08-19 21:42:26.355+00	2026-08-19 21:42:26.355+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	610v6753561t3g1t15	5143fe75-0dde-8625-a96a-888f7f33fea4	797736131	full	completed	2026-08-19 21:47:43.26+00	2026-08-20 18:20:32.046+00	2026-08-20 18:20:32.046+00
6ab8a889-a067-8365-9e0c-ae00b69721f5	6e4l505w5h580l6j6h	09501038-b4de-8557-822b-a486db4bf004	797736131	full	completed	2026-08-20 18:20:44.509+00	2026-08-20 18:20:46.864+00	2026-08-20 18:20:46.864+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	063w566t52032b3a45	399d7d59-7f36-8c81-b878-ffd73a0c830b	797736131	full	completed	2026-08-20 18:20:57.814+00	2026-08-20 18:32:13.042+00	2026-08-20 18:32:13.042+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	1r31481k0k650z2s4x	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	797736131	full	completed	2026-08-20 18:32:29.632+00	2026-08-20 18:44:36.581+00	2026-08-20 18:44:36.581+00
a7408889-377b-86cd-a3c3-deb5d1380daf	321e2h6f42441m0g6p	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	797736131	full	completed	2026-08-23 08:51:50.205+00	2026-08-23 10:10:11.91+00	2026-08-23 10:10:11.91+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	2l1b4e2c4g006a1c23	8d50a017-1da9-8de5-bf68-ffcbebad128f	797736131	full	completed	2026-08-23 10:10:23.217+00	2026-08-23 10:33:01.101+00	2026-08-23 10:33:01.101+00
56232963-20e4-47ed-b958-1905f2f124fd	\N	09501038-b4de-8557-822b-a486db4bf004	42	full	active	2026-08-25 15:48:36.656+00	2026-08-25 15:48:36.694+00	\N
\.


--
-- Data for Name: pages; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.pages (id, legacy_id, parent_id, title, slug, icon, content_md, "position", visibility, version, created_at, updated_at, deleted_at) FROM stdin;
b266d410-f9cd-821f-92b8-fdfc4d102db5	4f5q5x1i3q442u506k	\N	Books	books	\N	\N	0.0000000000	private	0	2026-08-20 17:46:38.839+00	2026-08-20 17:46:38.839+00	\N
e1f2d1fe-dc7b-87bf-9179-f0deff2b1e78	23673f534p3n0d4r3p	\N	English	english	\N	\N	0.0000000000	private	0	2026-08-14 20:12:31.106+00	2026-08-14 20:12:31.106+00	\N
063cf5fd-2e8f-8135-bf20-74785a2bb519	5h1f6e1033051d090r	\N	Programming	programming	\N	\N	0.0000000000	private	0	2026-08-14 20:12:31.099+00	2026-08-14 20:12:31.099+00	\N
c9e327b3-516a-840a-8812-243d478b8f63	5a2m5c2c6z620o0118	b266d410-f9cd-821f-92b8-fdfc4d102db5	Designing Data-Intensive Applications	designing-data-intensive-applications	\N	\N	0.0000000000	private	0	2026-08-20 17:46:38.84+00	2026-08-20 17:46:38.84+00	\N
ac899bec-4a21-8cf1-85f2-734773365b1a	2z600z4c36231u4960	063cf5fd-2e8f-8135-bf20-74785a2bb519	Linux	linux	\N	\N	0.0000000000	private	0	2026-08-23 08:44:23.365+00	2026-08-23 08:44:23.365+00	\N
c39ee411-b12e-809c-b29e-7999049fa199	0x3t6c0c713v0y6v49	063cf5fd-2e8f-8135-bf20-74785a2bb519	SQL	sql	\N	\N	0.0000000000	private	0	2026-08-14 20:12:31.113+00	2026-08-14 20:12:31.113+00	\N
2184b1cb-5721-8655-ab1c-90ed397b92c5	296u6q236w6b6v5224	e1f2d1fe-dc7b-87bf-9179-f0deff2b1e78	Vocabulary	vocabulary	\N	\N	0.0000000000	private	0	2026-08-14 20:12:31.106+00	2026-08-14 20:12:31.106+00	\N
554f245a-9266-8f5a-9084-d1c55a6b0f6c	2f6k3s0u3y4w5g4y5s	2184b1cb-5721-8655-ab1c-90ed397b92c5	By levels	by-levels	\N	\N	0.0000000000	private	0	2026-08-14 20:12:31.106+00	2026-08-14 20:12:31.106+00	\N
0b42d4a1-942a-807b-8706-dbe80fddc7b8	052e6w6t50083b1k5y	c9e327b3-516a-840a-8812-243d478b8f63	Part I — Foundations	part-i-foundations	\N	\N	0.0000000000	private	0	2026-08-20 17:46:38.841+00	2026-08-20 17:46:38.841+00	\N
3d119068-f214-8c9e-9f7d-ec0614dafe0d	043j400c1i5z481y4z	ac899bec-4a21-8cf1-85f2-734773365b1a	Shell	shell	\N	\N	0.0000000000	private	0	2026-08-23 08:44:23.367+00	2026-08-23 08:44:23.367+00	\N
37456bb3-acb6-866f-80e0-e3cf3ad36ac5	466k6s5l22733p4t2y	554f245a-9266-8f5a-9084-d1c55a6b0f6c	A1	a1	\N	\N	0.0000000000	private	0	2026-08-14 20:12:31.106+00	2026-08-14 20:12:31.106+00	\N
90760bed-788c-8aad-9e00-96bcdba1851d	5l0i39664z293u2y0s	0b42d4a1-942a-807b-8706-dbe80fddc7b8	Chapter 01 — Reliable, Scalable and Maintainable	chapter-01-reliable-scalable-and-maintainable	\N	\N	0.0000000000	private	0	2026-08-20 17:46:38.842+00	2026-08-20 17:46:38.842+00	\N
f2c2932f-b4f4-85a0-b9d5-98f2b507525d	3x6m316832491f0r1r	0b42d4a1-942a-807b-8706-dbe80fddc7b8	Chapter 02 — Data Models and Query Languages	chapter-02-data-models-and-query-languages	\N	\N	0.0000000000	private	0	2026-08-20 17:46:42.724+00	2026-08-20 17:46:42.724+00	\N
\.


--
-- Data for Name: question_options; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.question_options (id, legacy_id, question_id, text, is_correct, match_key, "position") FROM stdin;
adf9acb6-f8eb-8b8b-bb2e-c476e3a1574d	4u6l6v0q1b555t3p1e	1924c112-1179-8e2f-ad89-68063c0fb4ba	bread	t	p0	0
8ea50220-c987-8f95-82d8-42e6f5f67f41	1k1l2a085z6h1x3n0s	1924c112-1179-8e2f-ad89-68063c0fb4ba	milk	t	p1	1
05620cbc-a767-8036-aeb6-f41e9a0f53e0	220q4i1b0z0n211t05	1924c112-1179-8e2f-ad89-68063c0fb4ba	water	t	p2	2
9ea3c3b6-14c6-899e-9253-88c09a9a5444	460r3917483v1x3n5z	1924c112-1179-8e2f-ad89-68063c0fb4ba	tea	t	p3	3
eb767f6c-ee83-8b7f-8eea-d0d8f568fcc4	5o5i546u1a1t420h3m	1924c112-1179-8e2f-ad89-68063c0fb4ba	coffee	t	p4	4
f3738308-9dd4-8aef-ae7c-3c1bb95befdb	6z3d2x3c4k5a6t104z	1924c112-1179-8e2f-ad89-68063c0fb4ba	хліб	t	p0	5
55085cee-2f19-8219-a356-82509c626526	0r0l383h0m4l5l0w3k	1924c112-1179-8e2f-ad89-68063c0fb4ba	молоко	t	p1	6
53009f1f-6ee1-8ffd-8b21-72dfedaccf4b	6d373g0m6s5r5j0w6h	1924c112-1179-8e2f-ad89-68063c0fb4ba	вода	t	p2	7
788e86f5-5f1d-8ed6-a7a0-0eea32822b0b	1f4e5e2v6d6a6w4k61	1924c112-1179-8e2f-ad89-68063c0fb4ba	чай	t	p3	8
3d857775-30a5-805b-b5bb-b79befb9f9ae	293j2a4n1j26651x63	1924c112-1179-8e2f-ad89-68063c0fb4ba	кава	t	p4	9
2efe7a99-6e78-8d84-82d0-4acff0a10a65	105o3i1f4z5x650s0y	7da3ea12-5863-8c58-99ac-cd058ab2634d	Schema-on-read ≈ динамічна (runtime) типізація, schema-on-write ≈ статична (compile-time) типізація	t	\N	0
09597c0a-03ea-8616-9829-fb352db51aad	4x153d2t525o63685t	7da3ea12-5863-8c58-99ac-cd058ab2634d	Schema-on-read ≈ статична типізація, schema-on-write ≈ динамічна типізація	f	\N	1
f2e5dd94-be60-822b-a6fc-d3614e9117e2	3z0l4o361e5r5t6951	7da3ea12-5863-8c58-99ac-cd058ab2634d	Schema-on-read ≈ garbage collection, schema-on-write ≈ ручне керування пам'яттю	f	\N	2
02f34f8a-aac8-8594-af15-9c5e47f4d898	413c43732c0l6y365e	7da3ea12-5863-8c58-99ac-cd058ab2634d	Schema-on-read ≈ інтерпретація, schema-on-write ≈ JIT-компіляція	f	\N	3
4f956722-a43a-82aa-b591-dd97da2baaa4	5d724d102u251o3d5y	ab87fbf3-6331-8bef-a903-f673df12aa0b	шарф	t	\N	0
c9d6a1f1-cc27-8ba5-b4ad-081bcc7c4d70	5w6c2l3f275h0r584j	ab87fbf3-6331-8bef-a903-f673df12aa0b	шарфа	t	\N	1
6f6c3006-26b8-8e77-985e-62ada152b041	1t3u081j0f62473732	f54ae8b5-f277-8127-80df-11f274168b39	cat	t	\N	0
02d92acf-8ad6-835c-af0c-f46187353510	602g4153003l0s6b4n	8c7e731b-b835-8095-9b01-56763a4209d9	Processes from all users, readable user-oriented columns, including processes without a terminal	t	\N	0
dc4d0ec3-7147-85c0-ac5a-fbab5bfd9749	2l3f2f1x1n2k14225v	8c7e731b-b835-8095-9b01-56763a4209d9	Only the current shell's background jobs	f	\N	1
df883a2f-2d90-8ec8-9a3a-2833957c7702	49163l38266z550c1p	8c7e731b-b835-8095-9b01-56763a4209d9	Only listening network processes	f	\N	2
0cf767fc-3842-8c46-a866-69e7c8b1dce7	4h07051t4q3i380v4u	8c7e731b-b835-8095-9b01-56763a4209d9	Only processes owned by root	f	\N	3
156875f3-634b-8eaa-adfb-40539f2f8ece	6u0g0j240z301z3965	902657f7-edd5-828f-8768-56e35f1166b6	command > both.txt 2>&1	t	\N	0
fdffb14e-f0aa-8bae-842d-b633acff716e	6z5s3y4m5n4i354m6s	902657f7-edd5-828f-8768-56e35f1166b6	command 1> both.txt 2>&1	t	\N	1
db082d7d-4c8a-834e-9f42-1e24ca9c8873	4g6e6u130k3o6i6h71	77ab2f42-4ae7-8b10-8fea-15e43c590a57	молоко	t	\N	0
85abf4a4-5b8c-8835-aef0-e23a01d54606	620v1j0g0b0r2t3i3y	6cf248b3-ef20-81c0-8ffd-25cb9020ada0	kill -l	t	\N	0
04a850b4-d091-8b93-b600-3c9033eebc6c	030y386u3r1e11462u	6cf248b3-ef20-81c0-8ffd-25cb9020ada0	kill -a	f	\N	1
84bea9a9-9d1b-8d7b-b54e-bcb3964c6062	6r5y1l6k0k4a0t6u2a	6cf248b3-ef20-81c0-8ffd-25cb9020ada0	signals --help	f	\N	2
441f9f71-8d33-88e0-b070-7328d30d3fa3	105z224j3n3a721m5j	6cf248b3-ef20-81c0-8ffd-25cb9020ada0	ps -signals	f	\N	3
b1778916-8b73-8a07-babe-72b430a1bd03	3v2h6y3p6m510l312p	5f318fff-368e-85d2-9fc5-59f8efa0d6dd	References between independently stored entities are important	t	\N	0
4a25b9a6-5e0d-842b-bc83-12636a650860	506l3b413e4b61490z	5f318fff-368e-85d2-9fc5-59f8efa0d6dd	Join support or equivalent application-side work becomes important	t	\N	1
d76d8d22-8b4e-8d5d-9328-a8e77e0cbf1b	491q4m105a2n662i4q	5f318fff-368e-85d2-9fc5-59f8efa0d6dd	A single isolated tree is unlikely to represent all relationships cleanly	t	\N	2
a452b134-0db2-8d50-9ba1-87406ef556e6	2z5l1b53002i51704w	5f318fff-368e-85d2-9fc5-59f8efa0d6dd	Duplicating every entity into every profile guarantees simple updates	f	\N	3
d117b2c7-6de8-89dc-909e-b42e541e22a7	2l365r060c280p6k2f	8ab7e970-c7c3-831d-897c-a3909736a573	bread	t	\N	0
9edde1bc-0784-802c-920d-03f76174d531	593g3b5l630v5o1q28	1714869f-9ff5-8137-a14b-a99a945cf514	Response time includes service time plus queueing and network delays	t	\N	0
17763236-452a-8ec0-a02b-46587077403e	5q5b0h6i536p6w215l	1714869f-9ff5-8137-a14b-a99a945cf514	Service time includes all network delays, while response time does not	f	\N	1
f9cdab06-fc03-820b-9d4d-284070f3eec3	6w37456d6j4s08046d	1714869f-9ff5-8137-a14b-a99a945cf514	They are always identical	f	\N	2
d746b42e-7746-8127-9279-1e4924cbd657	5p2b5948634m0k0k5s	1714869f-9ff5-8137-a14b-a99a945cf514	Response time measures throughput rather than duration	f	\N	3
ee0bedfd-eb82-8930-99b3-1bf9fa5d0e3f	3m670j39380b30724x	67f3c878-5f15-81be-8806-3c9728b415d8	Є багато різних типів об'єктів, і непрактично класти кожен тип в окрему таблицю	t	\N	0
e69712a3-9526-8448-bfca-2b67c7d21f04	2w71535d3h6o2d1z1b	67f3c878-5f15-81be-8806-3c9728b415d8	Структура даних визначається зовнішніми системами, які ви не контролюєте і які можуть змінитися будь-коли	t	\N	1
431020c8-176e-8e34-b13e-300d7cd62eab	4n0m4w4y11220f5534	67f3c878-5f15-81be-8806-3c9728b415d8	Усі записи очікувано мають однакову структуру	f	\N	2
15be95be-823a-88b6-a136-9bdc91a1c550	584q411h150p4s413x	67f3c878-5f15-81be-8806-3c9728b415d8	Потрібно документувати та примусово застосовувати структуру даних	f	\N	3
e8742d4a-672e-88f5-beba-2d34b4842dcb	2w222l414n452j4q12	6f9b6517-a5d3-8721-bef9-ff23a3809351	The quantity, complexity, or rate of change of its data is the main challenge	t	\N	0
6ed34d22-4252-8e47-88c8-fbed400d5c12	2a4m2v152a3i3o5f6c	6f9b6517-a5d3-8721-bef9-ff23a3809351	It uses more than one programming language	f	\N	1
246e0664-714a-8d67-be4d-3b5e5992ea71	3r344831626105162u	6f9b6517-a5d3-8721-bef9-ff23a3809351	Its CPU always runs at 100% utilization	f	\N	2
1465815c-dc62-89be-b3bf-7170d2cbe22a	041z412l3h0e3d286i	6f9b6517-a5d3-8721-bef9-ff23a3809351	It must be deployed across several regions	f	\N	3
ab5f73df-fafd-87c1-b8f6-2997d54a7ae5	513x553e315g502815	6e65f4d6-d90b-8157-9002-f7118f211efe	It omits the trailing newline	t	\N	0
11b22fd1-dc7f-8dbd-a0cf-246f3f07a0f7	5y5v6p5v2r5y002s0g	6e65f4d6-d90b-8157-9002-f7118f211efe	It numbers the output	f	\N	1
a9724bba-6c16-8596-a0d3-da443b10fe01	4x3i606e6z5s502f4v	6e65f4d6-d90b-8157-9002-f7118f211efe	It writes to stderr	f	\N	2
9c8e1ca4-1f2c-8cb0-a655-b37f27d74ea0	6b120z0c0w1v530r0g	6e65f4d6-d90b-8157-9002-f7118f211efe	It disables variable expansion	f	\N	3
21c47366-9c51-83db-90d0-9341be70d193	5b055h315c214z2p3a	c2fa4fd5-de53-8ade-87e8-781b4ddb67c2	кросівки	t	\N	0
c92a5a48-a281-84a3-a4e3-bbfdfa94d677	3o5k1v41415k0s6n59	c2af6150-ffac-8294-8e92-fd0281ffce05	jobs	t	p0	0
02b573e9-b1b0-8560-baa2-2c02fcf649f1	5q4b2b164r2r3u2v2p	c2af6150-ffac-8294-8e92-fd0281ffce05	bg	t	p1	1
25dbcb96-7bb5-892d-9b04-f21e5eae716f	10020d6w5c705b1x21	c2af6150-ffac-8294-8e92-fd0281ffce05	fg	t	p2	2
e15870e7-d842-8f25-ae3f-9a442bdc7006	485s270l315n5r3h0s	c2af6150-ffac-8294-8e92-fd0281ffce05	fg %2	t	p3	3
24bb7ee3-ac47-832c-912f-b20f4f0670e8	336v3r3u0g561r2h45	c2af6150-ffac-8294-8e92-fd0281ffce05	List jobs for the current shell session	t	p0	4
66a7872d-0869-8f32-8a3c-c6df3acb20bf	020d0d6v6k0l5b5o1l	c2af6150-ffac-8294-8e92-fd0281ffce05	Resume a suspended job in the background	t	p1	5
37ec1099-efb8-817d-a12e-3ab1f35b4973	5k2h490n001p0n2r52	c2af6150-ffac-8294-8e92-fd0281ffce05	Bring a job to the foreground	t	p2	6
8391c3c4-7ae6-8b33-843f-3b301c51d3e9	260i0r3s1r2e6t6a0w	c2af6150-ffac-8294-8e92-fd0281ffce05	Bring job 2 to the foreground	t	p3	7
0ac886c6-e2c8-8dae-a006-a18d860a0d18	0w473h0p062e1a1q1q	fc1c519c-dee8-8641-9d33-182724f0e452	цукор	t	\N	0
68574ea1-515e-8c26-99ef-110f4122b61f	144d5l5e504h3h5f5p	e53929bf-d21f-8806-82ff-7530cdcf641a	апельсин	t	\N	0
041aeeb2-a100-8aa0-8499-96f42c73e051	1k4v415h1k715h6s3c	6327f423-a733-83c6-85a9-ab12704b7dac	shirt	t	\N	0
2a572c43-9213-8cb4-a34d-b1feb9ee5521	0954566223250y5v6u	54e7ac12-7800-846c-833f-6e8bdf55ea7d	Prevents `find` from descending beyond two levels	t	\N	0
736395b7-bae4-8887-95c4-0af417187710	2i283m2g513q416t6o	54e7ac12-7800-846c-833f-6e8bdf55ea7d	Returns at most two results	f	\N	1
e9e7c9b8-69ab-8334-92b0-9a3c1d2b2545	4f2g3a2b010y35594w	54e7ac12-7800-846c-833f-6e8bdf55ea7d	Finds files at least two levels deep	f	\N	2
a5ca5047-8d53-8a05-b2d4-53e47b3fe6e6	15221f5t5e65035k45	54e7ac12-7800-846c-833f-6e8bdf55ea7d	Limits each filename to two characters	f	\N	3
d7729f2e-604a-80a0-af84-a6bf5e542d6a	2o1o325e6s2u3m4f5w	5df93fa2-3d18-82ef-a24e-f6b780945d6a	сумка	t	\N	0
231ca617-009b-8597-9929-10d2c37f7ff1	2c6g6l1u1m34673w5b	5df93fa2-3d18-82ef-a24e-f6b780945d6a	сумку	t	\N	1
30a84f03-4100-86c7-9373-81315624b38d	1u0t472l0i334n0r6a	df7a1652-262f-8e8e-9ca7-2df2829c7a28	uniform	t	\N	0
911843b9-2e0b-85a5-9cfe-2bc11fea86da	64286y1b395l6j143b	0ce4ea40-2eed-8840-8112-99c462ed7b18	Бо ID не має значення для людей, тож ніколи не потребує зміни — усунення дублювання є ключовою ідеєю нормалізації	t	\N	0
a9f635ce-326a-8359-a93c-e0cc5f9721fe	5k0b4h233s5y090h41	0ce4ea40-2eed-8840-8112-99c462ed7b18	Бо цілі числа займають менше місця на диску, ніж рядки	f	\N	1
b4b63c25-0db4-85f7-a93b-a09e6d282f69	2t0b3d294g5i5d6i4i	0ce4ea40-2eed-8840-8112-99c462ed7b18	Бо document-бази не підтримують текстові поля довші за 255 символів	f	\N	2
7f51e8e8-fbd5-8e9b-a7aa-4ea5b685287f	6117182p1508346z1o	0ce4ea40-2eed-8840-8112-99c462ed7b18	Бо ID автоматично індексується, а рядки — ні	f	\N	3
de36f5a4-5119-8535-a5b9-ace17c29537b	562s165r5k6i1b4z6j	4620b24e-e9c3-8ab1-a2e0-83dd222381fb	ремінь	t	\N	0
cb3c1257-2695-8bac-9912-f918bde2c36d	0a0v56024763183c45	4620b24e-e9c3-8ab1-a2e0-83dd222381fb	ременя	t	\N	1
6e65fafb-17bf-894b-9049-a4a1c196b881	2f25731l5n3l1y545y	333d31fd-565e-8488-ba3b-f94b61de08c3	Хибно	t	\N	0
71546067-69fa-89e2-a0c7-82dda2d85c43	6j3u5h4825504e4t5x	333d31fd-565e-8488-ba3b-f94b61de08c3	Істинно	f	\N	1
6c5b5045-02a0-86bb-9e71-a9cbe9b32f2e	161m410g6a1w6k5z0q	8b76ee55-c231-8734-8e63-384a82f24116	The same latent bug may affect many correlated nodes at once	t	\N	0
33a0731e-d2f6-852c-8d8a-25814830432b	1o70020s6x5q4r4z0s	8b76ee55-c231-8734-8e63-384a82f24116	Software faults can only be fixed by replacing every server	f	\N	1
12c39659-5e2e-8ffb-9b5c-d55cfc781667	26310g6v5a584l155d	8b76ee55-c231-8734-8e63-384a82f24116	Software faults are always immediately visible	f	\N	2
a5ee8f4e-4419-8ee2-996f-8a91eb11ed1a	1q01200h5g4p485f4f	8b76ee55-c231-8734-8e63-384a82f24116	Replication automatically prevents identical bugs	f	\N	3
6f1c6c64-bbdb-8cb7-bb1e-e47f3092751e	6j571q2a2z6r1w2q40	680c9336-42f1-84fe-b056-2611e0450aa5	Typical requests are fast, but a meaningful tail becomes slow under load	t	\N	0
80442baf-a3da-8043-9565-43c8bba54a07	2v3o102q1u6l1z170r	680c9336-42f1-84fe-b056-2611e0450aa5	Capacity or queueing behavior should be investigated at peak load	t	\N	1
1e44b484-bbae-8aae-8f1a-6ab082d72b45	2u562t2r0726176364	680c9336-42f1-84fe-b056-2611e0450aa5	The median alone proves the service meets all user-experience goals	f	\N	2
70fd554d-6446-8368-8d3c-96ec9ce40135	5h2d6r540g614g2r3g	680c9336-42f1-84fe-b056-2611e0450aa5	The p99 problem can be ignored because only averages matter	f	\N	3
9baa77f9-0dcf-8dbd-b6c8-9775ac1f9ab0	0b0w1g1x031n3b3x3b	251ffd80-870d-8f7b-b149-aaa077b66e47	With `<`, `wc` reads stdin and is not given a filename argument	t	\N	0
420fe05d-c1c7-8483-91f0-f243d0afc930	4a47073s5f3v3j5a5t	251ffd80-870d-8f7b-b149-aaa077b66e47	`<` removes whitespace from the output	f	\N	1
198a26c0-2b18-8b04-ba4f-c31eac03dc17	1o532o4k5z5m4i2k5h	251ffd80-870d-8f7b-b149-aaa077b66e47	`wc` cannot open files directly	f	\N	2
93b82291-7d3c-8ea3-b445-33b7fa961194	4g4s336l5e216a6z0i	251ffd80-870d-8f7b-b149-aaa077b66e47	`<` redirects stderr	f	\N	3
37f92918-75b2-8f71-904d-46675dc66eca	5l5j4t5x6j6y232x46	a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	Relational systems increasingly support document data, while document systems add join-like capabilities	t	\N	0
7d86a9af-b628-8b87-bdeb-faecd73f1da7	47544k6b0b2u0m3b5b	a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	Both models require identical schemas and query languages	f	\N	1
a2a7da4c-4a31-8a44-9235-97fd68661480	0o2h2t3v3c4o4g1h4z	a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	Neither model supports nested data	f	\N	2
ea295563-ea8c-8471-ac6b-31a8bfc014f1	3u4573682i0t261d05	a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	All databases now use exactly the same storage engine	f	\N	3
007de105-f44a-807a-be47-690c68d39b67	0y59294d6m001f4a03	bd2c9751-98b0-88f7-9223-f29721376a9e	Use a hybrid strategy: precompute feeds for ordinary users but handle celebrity posts differently	t	\N	0
6cda5947-2091-8513-b5f2-aafb98bd04f1	4m3m27451a2d3w6z5z	bd2c9751-98b0-88f7-9223-f29721376a9e	Use the identical fan-out strategy for every account regardless of follower count	f	\N	1
e7c97db2-d564-8d2a-9e64-f87e71f5fba2	0m190w1n4x082o6l6b	bd2c9751-98b0-88f7-9223-f29721376a9e	Store every user's feed only in the browser	f	\N	2
edce7c94-d2c8-8e02-8b26-b12940ea9490	3u1v17376i5x0h4h02	bd2c9751-98b0-88f7-9223-f29721376a9e	Measure only the average number of followers and ignore outliers	f	\N	3
bd7dffb0-55d8-8e66-aff4-7ebd5b5bc576	6b682y5p626s0w3g0t	cf13f13c-e8e9-8c93-858a-4df6a31c258c	grep ERROR logs/api.log	t	\N	0
d5a189e9-dbb8-89d7-a126-a860a36c3935	5b6y3g3l380v1q5m6e	cf13f13c-e8e9-8c93-858a-4df6a31c258c	cat grep ERROR logs/api.log	f	\N	1
9d19e06d-65a5-8f26-9cfa-7bf42e23340a	162n1m045k1i2x3f12	cf13f13c-e8e9-8c93-858a-4df6a31c258c	grep logs/api.log | ERROR	f	\N	2
4406d1d5-84fc-8e5f-b1b3-9393f3da9cee	3m5o120m09384h2q60	cf13f13c-e8e9-8c93-858a-4df6a31c258c	less logs/api.log > grep ERROR	f	\N	3
77cda005-cba1-8ccf-9258-8c4abd43b433	0u0w3k5t124n0h4o2e	800e98ae-c6b5-824b-826c-c8cffe76ff57	A fault occurred, but it did not become a system failure	t	\N	0
e8df49f0-5547-8d8a-ac4e-fa90bdf751a4	53695l3h6x326n0m2m	800e98ae-c6b5-824b-826c-c8cffe76ff57	A system failure occurred because any disk failure is a system failure	f	\N	1
93c8216b-e6ca-8c6d-ab4a-531f0b996951	3s58585h2q3k6o4d1i	800e98ae-c6b5-824b-826c-c8cffe76ff57	No fault occurred because users saw no error	f	\N	2
c1617182-3a0c-82be-b9fb-5780abdc7e55	5g4r144p0z0y34442w	800e98ae-c6b5-824b-826c-c8cffe76ff57	Replication converted a hardware fault into a human fault	f	\N	3
ff895ea8-f382-8dc4-b891-d895a6389359	05316w2c5t4v3w4w5d	c1f0db99-722f-8a49-afef-939116ea9e24	Leading tabs	t	\N	0
d30a0435-8663-8f5f-b202-94c8b513e6b9	3j3h461w002u4o5a6e	c1f0db99-722f-8a49-afef-939116ea9e24	Leading spaces and tabs	f	\N	1
845c50fc-c821-8d59-a4a5-7c1536a642f3	4a5p134s583315566j	c1f0db99-722f-8a49-afef-939116ea9e24	Trailing whitespace	f	\N	2
ea964f0a-5c0f-8fd3-8a9d-4d57214a3aae	0v5m535j6w0b6s234w	c1f0db99-722f-8a49-afef-939116ea9e24	Shell variables	f	\N	3
4de344ec-57a3-83a6-8f1a-0b478434ecbe	1q5d314l3a5j4n085j	eeb52fd5-522c-80dc-a4f7-c2a83b44421c	The translation gap between in-memory application objects and relational tables	t	\N	0
cf6ef5b8-3892-87ea-a4ab-d13703641f28	1b233i664c47732565	eeb52fd5-522c-80dc-a4f7-c2a83b44421c	A network error between two database replicas	f	\N	1
8ba1d7cc-719a-80aa-9626-18b0960f9000	3b3h060y3o3g3m5l5e	eeb52fd5-522c-80dc-a4f7-c2a83b44421c	A difference between SQL keywords in uppercase and lowercase	f	\N	2
453a5779-4590-8a23-a548-6e04eb9c89ac	2a01293811483k2k6z	eeb52fd5-522c-80dc-a4f7-c2a83b44421c	A failure caused by storing too many indexes	f	\N	3
deff6c01-7c8e-8edd-8f1d-27043b13bc0c	4s2v6i2252550v4149	3881cb10-a5a8-8552-bb99-342a39c5ee75	shoes	t	\N	0
b66570fd-0270-869c-be39-74447584d62a	1t3b5k3y5d54061e0s	c37c9ae4-666f-801c-892d-16efaf60a66d	-l	t	p0	0
ef1797ca-4ae5-8b4b-ac53-aa67ab74d8d6	5f0x0k1u1c084j3k5m	c37c9ae4-666f-801c-892d-16efaf60a66d	-c	t	p1	1
eca6b32d-b36e-8380-be68-77954ff3661c	6a0c6r6n446u2o2w26	c37c9ae4-666f-801c-892d-16efaf60a66d	-v	t	p2	2
026d66e7-4557-8a70-8b47-f580ca2aa78b	6b0e1906555a5q0o55	c37c9ae4-666f-801c-892d-16efaf60a66d	-w	t	p3	3
7022f2d5-ce2d-8f62-a1a1-1a55a9db5dd9	2t551z6r0e0z6w0f2w	c37c9ae4-666f-801c-892d-16efaf60a66d	Print filenames containing matches	t	p0	4
45bb51dc-8066-8ac0-a00d-1a1464d5a1a8	4j07131s3a5a6m460q	c37c9ae4-666f-801c-892d-16efaf60a66d	Print a count of matches	t	p1	5
e6426096-7995-8041-9e0c-45c8237a1019	5e2e4k4w0m012p504f	c37c9ae4-666f-801c-892d-16efaf60a66d	Select nonmatching lines	t	p2	6
5fdfecd3-c21b-8ac2-80f8-4f2c0e87f989	720s0n386x0z2t5z1k	c37c9ae4-666f-801c-892d-16efaf60a66d	Match whole words only	t	p3	7
184549ac-db5f-8d61-9f25-ca18a29d26e8	594n332y3y4z0y5128	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	Шлях від кореневого запису вздовж ланцюжків вказівників — єдиний спосіб дістатися до запису	t	\N	0
50da6092-44b1-8d37-a992-9c2016fc016d	6k5z2a6j6h6q404k68	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	Права доступу користувача до певних записів	f	\N	1
e4826c06-1aa5-8af5-abd5-91fc2affc9ea	3n5s16384e044p1d3x	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	Індекс, який автоматично будує query optimizer	f	\N	2
1a37456d-534c-816b-9c8c-ab3dce7f25b4	3z083l0a261v2w6s6e	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	Фізичне розташування файлу бази даних на диску	f	\N	3
fed4738b-ef05-878f-b390-83997734e784	4u1n031q1d0w2n553a	9bf90618-9cff-8bf9-a04a-d7069086ec32	bag	t	\N	0
8a1798a1-50ea-84f9-9ce7-2a5f386ba6b6	422d0h3w3y0v5h4y1g	03048403-511c-85ec-86e4-378e9117b5db	костюм	t	\N	0
4951aa8d-dfc5-8285-9aad-ee3e80dcaaeb	5n330w603632023w4y	03048403-511c-85ec-86e4-378e9117b5db	костюма	t	\N	1
7c71aa09-0160-8760-a5cd-2f0ee1570521	5s274e2w683t076s1b	2ce73501-0026-8a1f-a2f3-179d11168257	З електроніки — узгодження опору між виходом одного контуру та входом іншого	t	\N	0
24166966-72f1-8646-9cb5-1f3ec4370377	5p471054235b5g4d1o	2ce73501-0026-8a1f-a2f3-179d11168257	З механіки — невідповідність передавальних чисел	f	\N	1
06e43e94-106a-8a00-ba4a-eb89a80979ce	5h730r6u146l5i6464	2ce73501-0026-8a1f-a2f3-179d11168257	З лінгвістики — розбіжність між мовами	f	\N	2
0e9ee8bb-2101-844e-8b13-ab9470b51d64	3n68586h233x3j2z2s	2ce73501-0026-8a1f-a2f3-179d11168257	З теорії керування — затримка зворотного зв'язку	f	\N	3
d655d710-d2ac-849e-bf26-9fdbd48041fb	6m083p1h0q6m1t385o	788c11ea-b800-8c85-ab83-0df2e4f3923c	Replicate data across independent machines	t	\N	0
4986aa81-7b67-800c-a145-ac52aa35888d	1g5e0o035j1c1k2s3p	788c11ea-b800-8c85-ab83-0df2e4f3923c	Fail over to a replacement component	t	\N	1
8372f667-4cf0-8e0e-a986-2ee8076ab60e	561o710c6b180j612g	788c11ea-b800-8c85-ab83-0df2e4f3923c	Assume modern hardware cannot fail	f	\N	2
26f06f87-664e-81a7-b313-f73cb932f4ed	242z3j0v46134s090r	788c11ea-b800-8c85-ab83-0df2e4f3923c	Remove monitoring so transient errors are ignored	f	\N	3
93cbef5c-476f-8c63-a289-1a40ce8ccd24	1b3e3z280n0s4q5j3k	3dc0172a-bad6-89de-8207-cff14f2b95f5	pwd	t	\N	0
30e0a30e-8a24-8787-bc73-40480bdbab49	0c4w5y5v174z1l4l19	d9606bee-fed2-8305-8fc4-18117c0dcba3	G	t	p0	0
6ae91894-5aa3-8bf5-a33b-366994704a2b	4x1e4y3h5o5f4r4g50	d9606bee-fed2-8305-8fc4-18117c0dcba3	g	t	p1	1
fa4f0a55-cd00-8241-8e71-ba50d0c35cbd	424p5b725q160z231t	d9606bee-fed2-8305-8fc4-18117c0dcba3	/word	t	p2	2
7a3fd924-a0c0-8f6b-acb7-21b239e98f53	214n0k6u014t715v12	d9606bee-fed2-8305-8fc4-18117c0dcba3	?word	t	p3	3
c10e8803-bd5b-8e2e-aed5-fbaefbdffce1	356v262z4g2y4f356n	d9606bee-fed2-8305-8fc4-18117c0dcba3	q	t	p4	4
5e1dfc5f-a492-8515-81df-de27b336dd22	0i57703z6f05566f4y	d9606bee-fed2-8305-8fc4-18117c0dcba3	Go to end	t	p0	5
d0a9dc1b-d053-8777-819a-8832d5000aae	0k0a3m6y0957650656	d9606bee-fed2-8305-8fc4-18117c0dcba3	Go to top	t	p1	6
ac15d9e4-f70c-8fa0-93e2-4b11c5f0f414	3o694l3f4v6d6w4s45	d9606bee-fed2-8305-8fc4-18117c0dcba3	Search forward	t	p2	7
204bafb1-7ffa-8257-ab70-e2bfb8faa98b	630a3r2n5f726q3q48	d9606bee-fed2-8305-8fc4-18117c0dcba3	Search backward	t	p3	8
3683683d-8c9c-8b73-a11c-64849a084383	0o5r26722l63353p07	d9606bee-fed2-8305-8fc4-18117c0dcba3	Quit	t	p4	9
0a7dfeea-d5b8-8ece-b4a5-118ee6911e53	121j3j58713i3m4x0s	b206788a-01b9-8fd2-bd71-a2c9415ba174	grep ERROR logs/api.log | tee errors.txt	t	\N	0
b5860ef8-016d-8e2f-861b-6c2050effba6	0u732m6b3p2x22695p	b206788a-01b9-8fd2-bd71-a2c9415ba174	grep ERROR logs/api.log > errors.txt	f	\N	1
affa76e3-b6be-88d5-b0fe-8b94bc24e32d	3e5h390n3n243j6d2g	b206788a-01b9-8fd2-bd71-a2c9415ba174	tee errors.txt | grep ERROR logs/api.log	f	\N	2
e38835d6-88c6-8d84-820f-2d25e479e1c9	2y5q6f1l1y1s2s2b2t	b206788a-01b9-8fd2-bd71-a2c9415ba174	grep ERROR logs/api.log < errors.txt	f	\N	3
6df54fee-ff5e-8dce-a4ef-0d134c31893a	4m734d0a262e2c252j	691f4b64-6f30-889c-836a-d09001606728	rg "useState" -t tsx	t	\N	0
09a531b4-b023-8447-8952-2b70818227ac	5r200u226x5i6j4371	691f4b64-6f30-889c-836a-d09001606728	rg 'useState' -t tsx	t	\N	1
cb19623d-94d5-86c2-adc5-4f250e89e75d	6v165v4q193u0s1i6v	691f4b64-6f30-889c-836a-d09001606728	rg useState -t tsx	t	\N	2
d74c7f8c-8109-80a7-ad41-292c9c626931	0x2h5c6a3c3o391a2w	0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	cd	t	\N	0
8656f1a4-9991-8506-a7c6-da76253df091	266v5q2a4g3u3c6b4n	0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	cd ~	t	\N	1
a0def7fd-cb4d-878a-a9ab-de980505dfb4	0w181e3y4l2x6x002x	0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	cd -	f	\N	2
5e27a6d4-db1a-81dc-89fc-b8af0dfc3af7	4d1a0f6t2x044e4y0l	0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	cd ..	f	\N	3
1222c7ce-59b3-81d5-924d-5ed437545735	6z254117384j3d636a	4bda6e56-3c08-82fb-b6d9-87e8e37fd461	lunch	t	\N	0
8193617b-f43e-8b5c-bc64-5dc1741e951b	1e1q216n5m05435s35	64fabd3d-6863-8422-907a-250c3ab5b289	mv old.md new.md	t	\N	0
d12102ff-f284-8917-a762-fbf4e123c611	6e0o4j1t5w6c6x302o	0f529282-d38c-8783-8b0b-f65e31c4abc0	meat	t	\N	0
3213646f-3a9d-890a-8585-e4af59752d18	5h5j486443523t2g2f	f4fccf84-7594-8ab7-ad24-959184667926	розмір	t	\N	0
694498e7-a950-8319-a999-306d544ea532	0g02266p0o6g3q1x5r	f4fccf84-7594-8ab7-ad24-959184667926	розміру	t	\N	1
4ffe2dd6-0392-83d9-97c6-180aa7eec9a2	2m1s2d66425r61481h	3c637446-91c1-8984-9563-80c1bcd8f0b3	Document locality is hurting this access pattern; splitting frequently independent data may help	t	\N	0
63f5cfe5-94ae-8dd6-9bc2-2b0849c77d6e	5x2j6n3g0c0z0j0g2z	3c637446-91c1-8984-9563-80c1bcd8f0b3	The document model is always optimal because it uses one record	f	\N	1
6a1ae858-4c72-8a23-ac4e-a5303728a90e	6q62055i2y32460s3i	3c637446-91c1-8984-9563-80c1bcd8f0b3	The application should duplicate the large document more often	f	\N	2
5f1a5f54-bed2-8a26-9137-a4f6097c8b33	6u0p722z030k1m3y2s	3c637446-91c1-8984-9563-80c1bcd8f0b3	The only solution is removing all indexes	f	\N	3
930ae973-948b-8c4a-a8f4-8862781fdd48	01370n6j016n202f0w	02beb82d-dc1a-8e99-b768-07f887ce32f4	suit	t	\N	0
7e045af8-7495-8e5f-9f2f-2b5a9ec5a8cc	3i1x63231u17445932	6ea13554-4f77-8120-a798-703b4efcd29c	`-c` counts bytes; `-m` counts characters	t	\N	0
5fc04233-d486-81c7-86eb-49a17e1801d6	59432k0b5y140x6o0d	6ea13554-4f77-8120-a798-703b4efcd29c	`-c` counts characters; `-m` counts words	f	\N	1
a45c33c2-1677-8ba9-b525-0b9c4be55d1e	1m533s3e6r3c2a5x0s	6ea13554-4f77-8120-a798-703b4efcd29c	They are always identical	f	\N	2
672862b0-9872-8e66-a75c-63921e83364d	4137275y2o3a3q1p1y	6ea13554-4f77-8120-a798-703b4efcd29c	`-c` counts columns; `-m` counts matches	f	\N	3
419410c8-b41e-8f12-89df-b0f93c871b3f	5a2u3557523y0n4k56	2bf82f23-7734-8f97-9e42-97abb45eefa6	Linux memory overview	t	p0	0
ae72bb92-a0fb-8569-ac85-1cba36ade7f1	1u3b3w4j6i6v5m4c2q	2bf82f23-7734-8f97-9e42-97abb45eefa6	macOS memory overview	t	p1	1
208f12aa-2046-850a-a5fd-227d55010994	5y3s4w48580d5k0950	2bf82f23-7734-8f97-9e42-97abb45eefa6	Linux listening ports	t	p2	2
579c6841-3f0e-85ed-b8dd-c00bc18a2f7e	1u423a4a39626o030t	2bf82f23-7734-8f97-9e42-97abb45eefa6	macOS listening connections	t	p3	3
f0446572-6304-8d62-8d1a-c48bdef8298a	494k191f2n036w1j3s	2bf82f23-7734-8f97-9e42-97abb45eefa6	free -h	t	p0	4
2e34ac33-872b-85ed-92ef-7f3528869780	4r395o0w1u0m3v3y2g	2bf82f23-7734-8f97-9e42-97abb45eefa6	vm_stat	t	p1	5
b18b107b-4836-80b4-9c67-9ddb2e2fb87b	0e1o1e592j1k2k6a09	2bf82f23-7734-8f97-9e42-97abb45eefa6	ss -tulpn	t	p2	6
3d5390b2-4216-8dee-8f15-2ab203f9d306	3c0p3t346h5t6f6u19	2bf82f23-7734-8f97-9e42-97abb45eefa6	netstat -an | grep LISTEN	t	p3	7
2eca6152-3e01-8f2f-b266-ac139b343e19	312e3f6d680c3o5h3n	1ad09b97-f93c-8a17-b194-dc1cf2067597	`pgrep -af "dist/main.js"` first, then `pkill -f "dist/main.js"`	t	\N	0
246f6f7b-d406-8f75-b98f-7e55bbbe106a	0u2r5f36174h6l335g	1ad09b97-f93c-8a17-b194-dc1cf2067597	Run `pkill node` immediately	f	\N	1
dfde766e-c2e1-8183-aebe-d02b6a1261dc	0d3n442x2x052e6e39	1ad09b97-f93c-8a17-b194-dc1cf2067597	Run `kill -9 $(pgrep node)` immediately	f	\N	2
6cef2e94-547b-800a-9086-67e8d2bf4985	6r6q0q2y443m2c2f3t	1ad09b97-f93c-8a17-b194-dc1cf2067597	Delete `dist/main.js`	f	\N	3
8c457e3c-16e9-819a-9721-62274cf9fb80	723z5m4r182z6b1a34	efd58ea6-1580-8545-b4a4-17ff92fbdf46	trainers	t	\N	0
fd5b3f51-fc72-8b12-a84c-0881cefc1817	061e5k4o2u3n162w5e	bdecf5a6-62bd-8b62-bdc6-6a9f54c2831c	сир	t	\N	0
8c92e3e9-ffc6-8dad-97d9-6a2afce5051c	5e3q41594657381227	77866774-fb69-8499-8aa7-f8530ca764dc	It hides the distribution and the slow experience of users in the tail	t	\N	0
6d11939d-9414-820a-a568-743363f3f6f9	1q2p2w4k4w5c0f2q2x	77866774-fb69-8499-8aa7-f8530ca764dc	It can only be calculated for failed requests	f	\N	1
d242e2f8-5ffe-8081-abff-80d611f9ecd4	2a223j3i6s5p46640c	77866774-fb69-8499-8aa7-f8530ca764dc	It always equals the maximum latency	f	\N	2
ffae759f-5a8c-87aa-b8e1-47a14e57cbd0	6p0c4u1n3m424u195p	77866774-fb69-8499-8aa7-f8530ca764dc	It cannot be compared between two systems	f	\N	3
71b3b7d6-4b63-8238-907e-4b9b4dee0dec	4e1y5068441y1q5u1g	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	since	t	\N	0
4103d7ef-3a96-8769-91e3-9e481f31ced1	4u2l5d6z1d1a6x2d08	ee939949-2555-851e-9674-f27bebab1af0	Declarative queries state what result is wanted; imperative code specifies steps to produce it	t	\N	0
fdf79cc8-ce3a-822a-9b6d-4336eb98abdf	0j0m6e5g0p5z3n005k	ee939949-2555-851e-9674-f27bebab1af0	Declarative queries cannot filter data	f	\N	1
a25e8705-8f3e-8be8-8d74-0436e33f440c	5z5t0m4f3y5r5z2h38	ee939949-2555-851e-9674-f27bebab1af0	Imperative queries are always faster	f	\N	2
0bb485db-4454-8e7b-975f-8a6e839210d8	1r39351l17585q096h	ee939949-2555-851e-9674-f27bebab1af0	Declarative queries require the caller to choose disk blocks	f	\N	3
0d4b4577-3642-8cb6-a7cc-d2addca92c46	5i5i4o67474n563w3j	3c66d373-a56e-85b1-93cd-020a008b8464	Дерево (tree)	t	\N	0
a18b17b6-0d78-8e6d-a1af-0a9afc115296	2f344b5g024s4u6008	3c66d373-a56e-85b1-93cd-020a008b8464	Довільний граф із циклами	f	\N	1
b1ad9975-310f-89af-b5f6-a85fa9bd467e	1l590969406m4q1s43	3c66d373-a56e-85b1-93cd-020a008b8464	Двозв'язний список	f	\N	2
95d7d6c9-11e9-8891-ac20-1ed43431e4ed	1w4g2163076h3c5m4w	3c66d373-a56e-85b1-93cd-020a008b8464	Хеш-таблицю	f	\N	3
49b10cb9-7c2b-8332-ae5b-67ef95632b45	6h6757226i2b6l1r1e	db2f66db-5d99-823d-a2ec-3f29d907b28f	Reruns `docker ps` every two seconds and redraws the display	t	\N	0
6bda023e-2263-89ea-a4f5-155b1d142880	1k6t0i3t016g484r6z	db2f66db-5d99-823d-a2ec-3f29d907b28f	Runs it twice and exits	f	\N	1
86fd254a-7c1b-8e5b-a2cc-bd9ad1c70bb0	3c6r101f015o173f55	db2f66db-5d99-823d-a2ec-3f29d907b28f	Waits two minutes before running it	f	\N	2
9285b101-e7cd-8922-af00-9747fee11682	4z5f4j234o0k236k5p	db2f66db-5d99-823d-a2ec-3f29d907b28f	Saves the output to a file named `2`	f	\N	3
69f3eb9b-8b94-8f3e-a422-b0839114640e	363q416g1q3m1l5b0h	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	Хибно	t	\N	0
67bfe17a-8f15-8fe8-96da-35d608ca364b	6j56101n680e134i2f	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	Істинно	f	\N	1
4a697a78-2dc2-8937-b216-82a93623ba89	0g01656q73282l1r23	518b33e1-4334-8a58-84b1-0dd99cdac6ce	Connects one command's stdout to the next command's stdin	t	\N	0
5f7afc1e-567b-8910-a3ae-dc9049407775	4a006y140u304q294i	518b33e1-4334-8a58-84b1-0dd99cdac6ce	Appends stdout to a file	f	\N	1
0959fedd-8f12-87f2-b24b-124d425002b2	3z463h2w2v6g5h1t58	518b33e1-4334-8a58-84b1-0dd99cdac6ce	Runs both commands only if the first succeeds	f	\N	2
8d75e447-35d9-8bd7-a956-7f3273dd0a1f	2p2f2h0k5n226s6q5e	518b33e1-4334-8a58-84b1-0dd99cdac6ce	Redirects stderr to `/dev/null`	f	\N	3
e5b16fd1-244a-83ab-9463-4412835d1e8b	2d0p32202p6q4i115v	8dfd3a56-a49e-8031-afaa-39c372f61ec9	fish	t	\N	0
5ba06307-c931-8f08-8f59-364df61f791c	130k6j3g033k244e3c	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	Google Spanner — схема може оголосити, що рядки таблиці interleaved (вкладені) у батьківську таблицю	t	\N	0
8f538976-cedb-8e9a-8018-9164e104ffe7	594t4q0d2n1p042u00	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	Oracle — через multi-table index cluster tables	t	\N	1
2d0245c0-9ade-8179-972b-7a2b5d5ac428	6h0w4p1t27653r3k6h	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	Bigtable — через концепцію column-family (використовується в Cassandra та HBase)	t	\N	2
1aa12c2b-fe1e-8fdc-931a-d4462a07485b	4z512r2p094t333f07	0ab8254c-c04e-88ba-8bc4-bc089b0912a3	Redis — через кластеризацію ключів за хешем слота	f	\N	3
7b6262c0-5b2d-857e-8fe9-cfda71709f62	6x5w3q382q5c0d5q6b	9a211a19-8d92-825c-819d-f45f08b1dbb0	Denormalized copies must be updated consistently across many documents	t	\N	0
bebf98ad-0125-828d-87a3-167d235b42dd	3f5e6t5h191e6w710j	9a211a19-8d92-825c-819d-f45f08b1dbb0	The relational model can no longer represent the author	f	\N	1
76c5399b-58b4-869b-a12d-38ae5d1d8e06	3p595s5v214w293p2x	9a211a19-8d92-825c-819d-f45f08b1dbb0	Every article must receive a new primary key	f	\N	2
8a08d5d7-90d9-8bc1-8662-b263ddcba099	171c4a2j3f1g2r3w54	9a211a19-8d92-825c-819d-f45f08b1dbb0	Declarative queries become impossible in principle	f	\N	3
35c9c3ae-a384-875a-a995-408029757431	4m6102672e5g5q0w0b	7b0be6e7-7d15-8d22-a99c-c008bee13204	printf "line1\\nline2\\n"	t	\N	0
3c5838ed-a19f-85df-b1b9-cd87df41895a	2x2o4u0o4x70386t2n	7b0be6e7-7d15-8d22-a99c-c008bee13204	echo -e "line1\\nline2"	f	\N	1
41c76e58-75dd-870a-bbcc-ec5c685b615c	671y0w5o6g0l262c0m	7b0be6e7-7d15-8d22-a99c-c008bee13204	echo "line1\\nline2"	f	\N	2
710b37a4-51aa-819f-90ba-d4b11d5997ac	361o2u0u650p6d532q	7b0be6e7-7d15-8d22-a99c-c008bee13204	cat -e line1 line2	f	\N	3
43929f95-2cba-862c-844f-7282e5c1558b	1i0t6n0n1b5e015s6w	f793c91f-f869-8b6e-84bc-6211307ac9cf	Краща locality — уся релевантна інформація в одному місці, достатньо одного запиту	t	\N	0
926779d6-f694-8dc3-8d4d-f5da8704fddf	6j09071w4b0n0a6g08	f793c91f-f869-8b6e-84bc-6211307ac9cf	Гарантована узгодженість даних завдяки foreign keys	f	\N	1
42fca97e-8699-84d6-9120-f3852a6287c6	5s0n3e0c0r3x533455	f793c91f-f869-8b6e-84bc-6211307ac9cf	Автоматична валідація схеми на рівні БД	f	\N	2
e2f42305-3e3b-8623-829b-e7028f099c30	2d594m0p1a3b0g3f44	f793c91f-f869-8b6e-84bc-6211307ac9cf	Ефективніша підтримка many-to-many зв'язків	f	\N	3
69a7a3f4-5999-8c0b-8ea3-78479749a0e6	546z3s3q2o694k581q	e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	The application interprets a record's structure when reading it, allowing records with different shapes	t	\N	0
fc711977-db9a-8c9c-a3f1-aa9c7ace30e1	2u720d4s1c3e6a1t4d	e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	The database rejects all records unless every field is declared first	f	\N	1
2b82a31f-c036-897d-a9c0-56c052bc8d52	4q4j1g0q4p4y2u186b	e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	No code needs to understand the document structure	f	\N	2
b3c87763-2509-8865-b11f-436380344ed8	245o4n162b2d2w373u	e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	Data migrations are never required	f	\N	3
a703a9f9-bb43-831f-8914-207f42badac0	6s693d3d142z18221j	efa69e8b-d383-8371-b742-716e644512f4	apps/api	f	\N	0
8664b1b6-6ce6-838b-93c5-1c49ca732092	265b4w2a3l2u6m412u	efa69e8b-d383-8371-b742-716e644512f4	../archive	f	\N	1
2ee739c3-a9c2-8f4b-925a-76eeb1601141	03635g0z6p6i053o0u	efa69e8b-d383-8371-b742-716e644512f4	/var/log/app.log	t	\N	2
85b12550-ee00-8049-9b92-9a7a32b6b452	680b1i04564l4a2f04	efa69e8b-d383-8371-b742-716e644512f4	./src	f	\N	3
f4f98461-c454-8882-b46b-21a038bb060f	044p3936005s076h1d	0354deb1-6fb6-88a3-a2ac-4bb19afb7224	чай	t	\N	0
498ca366-3276-87df-ad77-c9182f43feb1	533s450d0p2n0f2z1u	fd26ad66-1a47-8ba0-bf6c-2111da50584c	Run plain `kill PID`, wait briefly, and use `kill -9` only if necessary	t	\N	0
b5cd9ad8-ff46-8a87-91cb-1b256fa81053	4y522y6w0n1j5w155t	fd26ad66-1a47-8ba0-bf6c-2111da50584c	Always start with `kill -9 PID`	f	\N	1
71e30d50-f962-8370-b473-9484de6c3ae3	125x672c6w2s4c3i21	fd26ad66-1a47-8ba0-bf6c-2111da50584c	Delete its executable	f	\N	2
bdf980a1-c3d9-89e5-a3c0-554dc8e7c0a6	0e4j431j70676k675f	fd26ad66-1a47-8ba0-bf6c-2111da50584c	Restart the computer immediately	f	\N	3
62b43d73-b3e4-8566-a39d-37d10d328e60	176d504y1y29576o65	8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	Both files in argument order, without inserting a separator	t	\N	0
a7be0ffb-4e8e-81e0-b385-e00ab774a2fa	5e3t5c2m5802093h44	8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	Only the first file	f	\N	1
07bb057d-ec0d-8c8a-9cbc-f4a7961bf7ed	30271y0s002m6v076e	8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	Both files sorted alphabetically	f	\N	2
e556c71c-f07a-8363-9796-ac5b42988b1f	0b296y1h1i2q6r0t6i	8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	A side-by-side comparison	f	\N	3
13fa7eaf-efb3-8eed-94eb-0796385ad7c8	5m4u1f5q5j70152j0z	1ec19a39-3492-8435-a404-bc53f87dc33a	Long format	t	\N	0
ced8e2b7-72fa-8a5a-a2bc-b3ee85553682	2a292i5l295s664x0m	1ec19a39-3492-8435-a404-bc53f87dc33a	Include hidden entries	t	\N	1
3308d317-a25d-8843-942a-5038de2c3ec1	366u6e432m2n141t3e	1ec19a39-3492-8435-a404-bc53f87dc33a	Human-readable sizes	t	\N	2
ca0660f2-ae08-8d01-8465-7d0ed682d60b	0k1i720r5u5p4l1p4v	1ec19a39-3492-8435-a404-bc53f87dc33a	Sort by modification time	f	\N	3
1ea1fd4d-873c-8369-8aa8-decb191a1b6e	522t0r2z5s072n6f4m	7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	`{}` is replaced by the found path; `\\;` terminates the command passed to `-exec`	t	\N	0
3a2df340-508c-814b-a115-8fc51fc86e15	2d425c5p6y5o4w5y6x	7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	`{}` selects directories; `\\;` starts a comment	f	\N	1
d6cfb8d7-c164-8e0e-b29f-cee82a3f7a41	3n2m710i2y4c6u6j46	7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	`{}` groups regex; `\\;` redirects stderr	f	\N	2
37ffb01a-7b6d-8037-8d9c-a0482ca976f6	3l0e674j3o53735o6b	7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	Both are optional decoration	f	\N	3
a0ead206-5cfc-891f-ad81-fe2e748d13ac	16004c6u4t2a6m2x6z	853e9353-933b-853b-a927-92bde0685559	True	t	\N	0
712d8793-0d2d-880c-880c-c430778138e3	6s2k5x70516u665d3p	853e9353-933b-853b-a927-92bde0685559	False	f	\N	1
a924f75c-729a-82ce-82dc-36b4f3fc46bf	1e2f070z4x6013225q	94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	It creates a new inode; permissions may change and existing open handles may remain attached to the deleted file	t	\N	0
20b12a81-35c1-8d1f-92ee-abb11d73be71	0f14164d5x4v6c3s3c	94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	`touch` cannot create files	f	\N	1
463a3284-812b-8d35-a12f-1de4ef5b3f22	0y4z0t496u3y2t4x3n	94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	`rm` always stops the process writing the log	f	\N	2
259c30eb-a782-8f4a-8b3f-58caac647027	024v3223571t621o22	94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	It appends instead of truncating	f	\N	3
8cec6b8d-b7f7-8f07-ae23-80cfae503269	2x556u695z6a4s652u	ea37c658-195d-840c-a522-1955c7c6f53f	carrot	t	\N	0
bc6fe60c-374a-8624-a581-f751fb9c1c30	210h0k2i2a6t2f143n	6b378dee-6b57-89e1-9353-e8523409b93e	хліб	t	p0	0
17568179-5fe8-8342-829e-20e06f2c6a26	4t4b4p1n5b5u0w3d0u	6b378dee-6b57-89e1-9353-e8523409b93e	молоко	t	p1	1
8520047d-e550-878b-8f4d-17a9a7cdc89b	6u600n3z444e3z3i25	6b378dee-6b57-89e1-9353-e8523409b93e	вода	t	p2	2
d02aa7c5-c2b7-80c0-9384-c4a58dc652c0	6p5h5a0p4k3l5v5v1c	6b378dee-6b57-89e1-9353-e8523409b93e	чай	t	p3	3
9f333c89-14b3-8119-bcd5-1ec4a319d39b	1j1j3m706k19340j3u	6b378dee-6b57-89e1-9353-e8523409b93e	кава	t	p4	4
d9aa7180-699e-8355-b243-655809cc3936	392d253w430s5j541n	6b378dee-6b57-89e1-9353-e8523409b93e	bread	t	p0	5
787c6d15-8e75-8d4c-927c-1145034f87b9	6o213c4l6x1t142n2s	6b378dee-6b57-89e1-9353-e8523409b93e	milk	t	p1	6
bcd9c1b9-cf26-8813-9a9e-af164ff171c1	2h0h3v4e1n5a5f0s0p	6b378dee-6b57-89e1-9353-e8523409b93e	water	t	p2	7
a033d362-950f-81f1-881f-2bde74ccbe39	2v693w206c0w3a1m5b	6b378dee-6b57-89e1-9353-e8523409b93e	tea	t	p3	8
7079300b-b20a-8eae-97af-79deca336366	405z076x3e0i5k4s19	6b378dee-6b57-89e1-9353-e8523409b93e	coffee	t	p4	9
6d48e13b-2d02-8e33-8d26-cb5be4339098	614t5p4p3x005e2p0t	d20f81f7-9fe1-88dd-b241-ba1cacfe14b1	jeans	t	\N	0
46109ebd-98a0-8470-9255-388a0771e7b6	141s5c4w2j5t0z3w1e	f1ea73ab-6036-8a5c-8eee-b2d75e91b74b	рукавички	t	\N	0
f1282b14-14eb-8290-8013-045dd5157f2e	3y3g0b6w4v1i196j46	0f67d24b-0a4f-8acb-9858-1cf7db90f854	jq '.name' <<< '{"name":"flowforge"}'	t	\N	0
b844780b-6fd5-85ff-a276-2a6eeffcf860	33121z3i5i40600t26	0f67d24b-0a4f-8acb-9858-1cf7db90f854	jq '.name' << '{"name":"flowforge"}'	f	\N	1
aebfcddf-36ee-8e8e-bcb4-f7d74b990dd9	3d580z39696b28492r	0f67d24b-0a4f-8acb-9858-1cf7db90f854	jq '.name' > '{"name":"flowforge"}'	f	\N	2
0bce7491-fbfe-86bf-a9b4-47ea4b384d5c	596y0x074q2p394k0a	0f67d24b-0a4f-8acb-9858-1cf7db90f854	jq '.name' | '{"name":"flowforge"}'	f	\N	3
19be9a8c-a540-8ef0-ab14-661cb1bc3a51	365i354a4y6y3c2242	22cd375b-1acf-8360-ba2a-26e3b4f1c529	A relational model with normalized entities and flexible joins	t	\N	0
e5a4306a-6edf-88b1-9d9e-953aa4e26584	48290r2l124e010g4w	22cd375b-1acf-8360-ba2a-26e3b4f1c529	One customer document containing every fact forever	f	\N	1
421a0762-4661-8e25-9baa-792d2221a651	1k1m3r6s042m5i6p51	22cd375b-1acf-8360-ba2a-26e3b4f1c529	A separate unqueryable file for each payment	f	\N	2
ec5adddc-2761-88ea-9dd9-0ae3067c44a8	4b402g1v3l6h4i070l	22cd375b-1acf-8360-ba2a-26e3b4f1c529	A cache used as the only durable source of truth	f	\N	3
116f9559-f89b-8c57-b296-83c7332d0afc	716u2o4j0j35306m2t	d22aa0a3-1baf-842d-8db8-4a2bfbb86bc1	scarf	t	\N	0
39cd6171-0e4a-8fab-9649-969c2f895014	532v396p2g0p3z6g6e	0b73f77e-db3d-8899-a73d-c60fb6c29683	кава	t	\N	0
232068ea-fc57-8d11-a752-0508067e4eeb	392i6e1r1a4q4m111r	2668d303-4413-86de-beee-702a7d54082c	спідниця	t	\N	0
bc5029ac-14bc-8bbf-bdbd-72a90e3e1f00	6u1j1h5k574d5z104o	2668d303-4413-86de-beee-702a7d54082c	спідницю	t	\N	1
97ef71d1-9140-8d65-9505-a7390b957ca9	1o6i1s2053356c1w5r	5affe485-36d6-8a5e-8992-eb9f9d093cbf	торт	t	\N	0
015002e3-264c-88ae-98e7-ebdf02cfcb80	600l0h52711a34103w	5affe485-36d6-8a5e-8992-eb9f9d093cbf	пиріг	t	\N	1
ece7967d-48a3-8f97-a930-27f08939eed7	3s0t073i403p6c5u6n	f1037adb-1988-8b66-bad2-ffa44ed0825e	хліб	t	\N	0
928ea9a9-247f-8297-b11e-328c96c7bd04	5y6e676i45273w3o50	e43bbddf-419b-8165-bf19-3e8654f82eaf	-A 3	t	p0	0
b8ef4bdf-579d-8260-a524-9b2af1039ffc	0p59313t4q1c320t4v	e43bbddf-419b-8165-bf19-3e8654f82eaf	-B 3	t	p1	1
43b51a40-7b77-893a-a159-c214185ac114	534r1m260f684e3b4t	e43bbddf-419b-8165-bf19-3e8654f82eaf	-C 3	t	p2	2
a1c4a25e-14b0-82b3-9747-c6bd38c1423d	0k0270394r6m0h1q05	e43bbddf-419b-8165-bf19-3e8654f82eaf	3 lines after	t	p0	3
f179a865-96aa-84c6-9eb8-c9ced0a8c211	690e6j1j6k3s3l040q	e43bbddf-419b-8165-bf19-3e8654f82eaf	3 lines before	t	p1	4
ada9e1e4-0e7e-8233-b5a1-b03c8c919edb	0q5f564y3p5b500y3k	e43bbddf-419b-8165-bf19-3e8654f82eaf	3 lines before and after	t	p2	5
e6f2a582-e3b8-8b13-9dee-a3a3f510daf7	0a2t5m4v2l592u0g2k	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	Схема існує неявно, але не примусово застосовується БД — точніше казати schema-on-read	t	\N	0
16952390-ade1-89d1-80f8-a4ec8c2d510b	5940334j4s2c3e2x38	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	Схема є, але зберігається окремо в конфігураційному файлі — точніше казати external schema	f	\N	1
81a1cd86-310d-83db-af88-b65df5765287	6n6n701k610i1h241u	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	Схема генерується автоматично при першому записі — точніше казати inferred schema	f	\N	2
3be63fd2-4d42-8a6a-8ac7-6a529f51efdd	6h4u5t6n2w0d01562z	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	Термін цілком коректний — жодної схеми справді немає	f	\N	3
0cbbf96d-0156-8453-8af1-b546b9e657cd	4f6u033b6a1j175l0g	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	Потреба у більшій масштабованості, ніж реляційні БД легко досягають (великі датасети, високий write throughput)	t	\N	0
ad36351a-0934-8654-b171-b43d16f68069	0a3o1e2m28363t4j2p	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	Широка перевага free та open source ПЗ над комерційними продуктами	t	\N	1
bfaa7f90-c4bf-8f05-947e-7e75fb0d0aef	440a3o4c5j0a6s1j22	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	Спеціалізовані операції запитів, які погано підтримуються реляційною моделлю	t	\N	2
981825df-2184-84f4-bb5b-e2f276a516d8	1h4n52141y4u4x711y	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	Незадоволення обмеженістю реляційних схем і бажання динамічнішої моделі даних	t	\N	3
bceaf8d7-d5ea-8fb3-b7a2-e22e0bca40c2	1s0e6y0q0i0752340b	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	Неможливість реалізувати ACID-транзакції в реляційних БД	f	\N	4
2ed3b3be-0cd7-8d8e-9633-90830f862439	5q03585m4i3r0q4m26	dd00a0fa-d4cf-81e3-8405-0bb23cb61d67	hat	t	\N	0
22b11d25-e608-842b-bf0d-fe19733ea851	1e4h5g312l0d615h4u	8112f2b1-c5b7-8cdd-aa6f-a2b4d48358b7	underwear	t	\N	0
a234650f-7f77-8df0-a4fc-0d92e0bf13d1	370x0l0y4l1z3s3q2h	7f738a26-77d8-802c-a087-d96d3083c5d3	grep -rn "useState" . --exclude-dir=node_modules --include="*.tsx"	t	\N	0
29eba9c7-452c-8e93-8e85-081fe71a6abc	0f2r5y6b4k1l4v644q	7f738a26-77d8-802c-a087-d96d3083c5d3	grep -n "useState" node_modules --all	f	\N	1
8b36d8a6-7125-8e5c-976e-c210dd8e31cd	2e482h2q19500h523q	7f738a26-77d8-802c-a087-d96d3083c5d3	find "useState" -type tsx	f	\N	2
7375a5eb-aa73-8d20-bdc1-e43f6b0f1d59	3r3l5z3e0e2h2p0e1f	7f738a26-77d8-802c-a087-d96d3083c5d3	grep -rn "useState" . --include=node_modules	f	\N	3
c89ef758-966d-81c2-b55f-dc65d259b493	733w1q560857030r57	0776f85d-da36-88ba-86ba-d7a1aeb9229b	button	t	\N	0
224d9da5-948e-8234-bc0d-528725ad75fb	3e5d204q0e182f6y4r	59c2e542-6697-808a-a453-7f1676149810	пальто	t	\N	0
1cb16988-4266-8962-a887-123286cc9073	4i0c3l3z403g5e173u	af729aba-bb95-8766-b73c-6b81997dd7b7	water	t	\N	0
48c97d5f-8220-8262-8b01-883d2f1f4ad8	17545g2837572s3c2i	f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	Stdout goes to the file, but stderr remains at stdout's earlier destination (usually the terminal)	t	\N	0
8794a289-aae0-8112-afa3-0f79169aca02	5f161g356p1448641f	f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	Both streams go to the file	f	\N	1
138c7897-60ca-8f70-97f3-d734733a7f45	213g064811441b035i	f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	Only stderr goes to the file	f	\N	2
dbd28a45-32f0-8041-b503-26f3ac7dfc04	3h342l02605p4q0w21	f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	Both streams are discarded	f	\N	3
f7b8782a-59a1-8859-a8b5-0f6c014994da	6s4r0y5v412a130d4a	818c6acd-d71c-884f-b789-200afa196196	Write-ahead log	t	\N	0
3e468797-f5d4-86e1-a666-1942c652f3c6	3l1t6q2p59413h204z	818c6acd-d71c-884f-b789-200afa196196	Weekly audit log	f	\N	1
636d2938-42f4-8764-b62e-bd15936a9a93	3t0p564g3m4n5f0p2b	818c6acd-d71c-884f-b789-200afa196196	Write-all-later	f	\N	2
bdaeaea5-adba-82f0-a7c4-5526fa3a5c6b	4v70676q631b6g4o5b	4a0f96f0-653a-81df-a77c-384300dade32	-i	t	\N	0
e1cf1fa2-5903-8e5d-bb4e-61c6cb40cae2	1a142q2b2d2h5r1773	4a0f96f0-653a-81df-a77c-384300dade32	-f	f	\N	1
9881f803-0624-8bb9-8f4e-ffd5e558dc12	12103w1p2p5u5w1s5s	4a0f96f0-653a-81df-a77c-384300dade32	-r	f	\N	2
0405f173-3b83-8860-bb05-acf658a5f045	101c5f5k3i4e2o254m	4a0f96f0-653a-81df-a77c-384300dade32	-n	f	\N	3
4f9f92e0-0e52-808c-93d8-5f15d8257012	5a481310302r162g5q	fe874b23-e369-8879-a5cb-e44f41453788	cheese	t	\N	0
b51305a8-4d9f-8b75-b9a5-113f54edd7fd	3a2k30153v05141i0p	b04204c8-0b9a-88c9-be26-dfd354d6356c	T-shirt	t	\N	0
89c2f5c8-b8a8-8281-b68e-39d4221f63aa	085d5g250700453z5n	f8a2fe7c-7da1-8a6b-bd07-af42744f554b	netstat -an | grep LISTEN	t	\N	0
96a8d523-251e-8745-a5b5-85654b05bd2b	70523369603p610r5k	f8a2fe7c-7da1-8a6b-bd07-af42744f554b	ss -tulpn	f	\N	1
5ec7ac5b-9a04-8768-848d-f6cc07cee7f8	1l5g0s2z012l6t5w1b	f8a2fe7c-7da1-8a6b-bd07-af42744f554b	free -h	f	\N	2
3227dce1-8624-81bf-b027-a3c0c4bc8b35	3r6m0o4e0l4l496t2r	f8a2fe7c-7da1-8a6b-bd07-af42744f554b	watch ports	f	\N	3
46e0a126-2814-8725-9da9-9f086fc88b13	36396h315d124d3c2o	48dfcd45-c54f-8827-930f-786dfe516c63	True	f	\N	0
6abe0b6c-6ff0-8282-98a1-d0ba72783eb4	0m6b032m442f4m2w4y	48dfcd45-c54f-8827-930f-786dfe516c63	False	t	\N	1
7b1df28a-6b80-826c-8b8b-1d60ae495450	5d6t6k042w173x5o0k	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	Hierarchical model — усі дані як дерево записів, вкладених у записи	t	\N	0
63c18f60-9914-8516-90dd-8285999cbb6b	3t353j154l2i3s413p	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	Network (CODASYL) model	f	\N	1
5fd1850e-b5aa-865e-88e9-cab883ae7849	2y6e5t6g2z09093w16	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	Relational model	f	\N	2
fa92dd3a-fe41-86b8-8547-3eeca3c1aef8	64305i444s0o60345r	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	Property graph model	f	\N	3
aedb6763-c9f9-88ee-a178-7360c953f64d	04050d0a3q2p5q3r2q	0f08d9e8-0b97-82e5-9bfa-d7931ba7c404	банан	t	\N	0
7e98e995-054a-8243-bdba-c030efdf80ca	1n1k0e3r62343y536a	29fa93aa-0d3c-8809-bd19-bbc794792ecf	cat	t	p0	0
3c94f1d2-759c-855f-a3eb-9668da53d50d	3s3m3p0g4i252q0r3w	29fa93aa-0d3c-8809-bd19-bbc794792ecf	dog	t	p1	1
a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d	5l5h0s2w3f2x6w1f1f	29fa93aa-0d3c-8809-bd19-bbc794792ecf	bird	t	p2	2
c12fc1a5-58b6-81ac-b191-4481c65417cb	272t1y0w15420d566z	29fa93aa-0d3c-8809-bd19-bbc794792ecf	кіт	t	p0	3
a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8	4u013k2u5l034h1x18	29fa93aa-0d3c-8809-bd19-bbc794792ecf	пес	t	p1	4
5a5c5c5f-526f-8f34-9358-915221e5c47a	6k6j59086i235o2j3k	29fa93aa-0d3c-8809-bd19-bbc794792ecf	птах	t	p2	5
78e21a8e-cbb7-8644-9767-1ae61170a7ed	4o5h4e1t0s002n0a4r	66f82326-e5d0-8cc5-82c2-90718f8bb2e9	сорочка	t	\N	0
7268331a-cddd-888b-be33-bf5f45a2411d	0a5q0s703v5c6j5y2p	66f82326-e5d0-8cc5-82c2-90718f8bb2e9	сорочку	t	\N	1
afe514da-599c-81d5-bc47-abc4c6b9e49f	6a6v3a0i0u45601b4u	c5555818-485c-8f68-985f-bfd5fddc5eba	курка	t	\N	0
6a6cc028-202d-8a07-b86f-782f25a442ce	582m031a2y136e6i1q	c5555818-485c-8f68-985f-bfd5fddc5eba	курятина	t	\N	1
2e75d0a5-d968-8568-b44b-2ff2b9ef5d13	5151334i196n2m5z1t	f8101924-53a1-8a05-98fe-0f7543eba194	du -sh *	t	\N	0
f5fe3d13-e5f1-82f0-a3d8-42dbfa50f2a0	38274153370b42103o	f8101924-53a1-8a05-98fe-0f7543eba194	df -sh *	f	\N	1
c137ae76-3977-8da3-8743-fddebf056dba	144l2f3g1y3u113a2k	f8101924-53a1-8a05-98fe-0f7543eba194	ls -sh /	f	\N	2
9df2a496-e025-81cf-ab7c-321f91a6e552	5u6k6w163d4365283c	f8101924-53a1-8a05-98fe-0f7543eba194	wc -h *	f	\N	3
4c1da5e2-ebd2-863c-8af4-3f1714c61305	6c0m4x2d2v3f0j2r4z	9a18a4db-0dbb-8e43-b47f-f5560016dedb	туфлі	t	\N	0
ae440394-89b5-850d-8734-2f837c9641fc	3n162d2202181j0u53	9a18a4db-0dbb-8e43-b47f-f5560016dedb	взуття	t	\N	1
07ae7ea0-8978-8d73-9871-98ba1d853d98	0e18392s1d0x3i4c4k	e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	Identify the entities, relationships, and expected evolution	t	\N	0
6684e916-997e-8ec0-b750-7eba51ea57ca	6k1p5c5o3a0e004d0e	e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	List the important read and write access patterns	t	\N	1
f3d89453-0647-8a91-a821-5b718b123661	391j3v3a096c0h0x22	e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	Evaluate locality, join, consistency, and schema-evolution trade-offs	t	\N	2
efd56651-7acf-815e-8dc0-910e78fe3890	2y2n412a6p505a605v	e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	Choose and validate a model against representative workloads	t	\N	3
40ff2368-addf-85ad-a57f-c2945d14d98a	6y4h5r0x1f47216z1r	547d8cd7-55dc-81ed-8dd4-ed5f115ea42b	grep INFO log.txt > tmp && mv tmp log.txt	t	\N	0
c72860c1-243b-8fbc-8137-9c044c1a1665	680g3v246x101u2r52	517567ba-4265-8ef8-849a-6a3c7890eeea	Database	t	p0	0
bc0877b0-b565-8706-9d92-1ba21bfd7c3e	3259183s110p5w5k5m	517567ba-4265-8ef8-849a-6a3c7890eeea	Cache	t	p1	1
d1fc90ec-17dc-8324-a742-378410eed52c	314d0u3x1c630b5p3g	517567ba-4265-8ef8-849a-6a3c7890eeea	Search index	t	p2	2
f836dbfc-6c80-8f1e-9c47-f7a8e33c65c3	2a3j3s2c36424c3h2q	517567ba-4265-8ef8-849a-6a3c7890eeea	Stream processor	t	p3	3
79db52c7-838b-8c57-94f0-4bdfaaa726fd	3l1j715t0p34236h3e	517567ba-4265-8ef8-849a-6a3c7890eeea	Durable primary storage and retrieval	t	p0	4
1c1a7186-5dc8-86dc-8ef1-219777d74ae6	090t0z3e2h6n015s6f	517567ba-4265-8ef8-849a-6a3c7890eeea	Speeding up access to frequently used data	t	p1	5
b6a677e2-f1a4-8846-bec9-1403ed5541bf	3j3l6g5h4v3r4f725v	517567ba-4265-8ef8-849a-6a3c7890eeea	Finding records by keywords or filtered attributes	t	p2	6
3fea6aa8-cd3e-864c-a5ff-7ad27e626b27	552l4m142w025l3s2u	517567ba-4265-8ef8-849a-6a3c7890eeea	Handling events continuously as they occur	t	p3	7
6555cfd8-8e30-8bad-8855-21239ad6233a	6i0a0c2q53286j1p0y	a2a1e4d4-5e56-88a1-a94e-cdcd86aebec6	cap	t	\N	0
fa6c6037-c96b-8ea2-9ddc-b98f294409db	1d2x5w5h382r1k5m5c	efc13df1-fda7-8b42-8fcb-ca888f4545d5	banana	t	\N	0
03a4d6b8-1cd0-8911-aa13-5bc544d9c981	0c2z3a2j5e6y432j08	9b6c4c20-4de2-8a6c-92f6-b4ee3cf5127b	светр	t	\N	0
72a69255-84b6-8575-817c-feb1f888c466	4j2o12424i6f5b3t5h	9b6c4c20-4de2-8a6c-92f6-b4ee3cf5127b	светра	t	\N	1
3a44087e-2c49-8e13-aff2-bfe5b31f8707	3b6d5s6m10442h383f	96f6dc83-8585-87d1-9423-23d96c95ecba	jacket	t	\N	0
e64d2d0d-8649-814e-a1ec-27c2f88e70fe	0q29380w4z3z0e6715	96f6dc83-8585-87d1-9423-23d96c95ecba	coat	t	\N	1
a7ba6e18-0d0d-8f01-87b4-edfb385c4877	0o4a2p0v6a6o4p6439	4c256dee-8118-8976-945c-99e84cacea9b	soup	t	\N	0
eb693964-8e62-84c7-bbf9-ea1760faebf0	2i4c4q6a304g2c3r3f	1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	cp -r prisma ../archive/prisma-snapshot	t	\N	0
f1829fb4-a737-8f7a-bf59-222b3869b1ef	1s4g5y2a0r6r3f235w	1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	cp prisma ../archive/prisma-snapshot	f	\N	1
c00df242-665e-88f5-8f73-00788b95a482	46104h464x251x2t42	1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	mv -r prisma ../archive/prisma-snapshot	f	\N	2
9bb0774a-9095-8141-bf76-f28d78e16cff	300m6y0l0f1i282f72	1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	cat prisma > ../archive/prisma-snapshot	f	\N	3
648e80ee-4d48-8f04-9def-e3e0fe01d75d	360x620z4m2r6r461v	0a91ac19-81f4-83f7-aea2-83f713b46764	-not -path "*/node_modules/*"	t	\N	0
c841faaa-d580-8f5d-bec7-e7d52ea90426	6a3q1k2e59563p4y31	0a91ac19-81f4-83f7-aea2-83f713b46764	-exclude node_modules	f	\N	1
1678ce1c-c27b-8a00-a448-ee9db6c262c0	1t1e4n0l14653l503t	0a91ac19-81f4-83f7-aea2-83f713b46764	-v node_modules	f	\N	2
fa2b1d0b-6b1f-849c-917b-d33a566b85e8	2j1v2p5h0a3r0u1x0s	0a91ac19-81f4-83f7-aea2-83f713b46764	-type !node_modules	f	\N	3
ad0f568d-64ee-81e4-ae21-d0357804c7bd	6z56380j0y284l4525	bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	The regex still matches `node`, but the grep command line does not contain that exact matching text	t	\N	0
46679369-0fd4-83c0-bd83-6f2857a12e3a	4a205n405m1x6u0q3w	bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	It searches only array processes	f	\N	1
d4642501-29b3-855d-a37d-db65b1bb5bd7	1j5e67444010042u43	bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	It makes the search case-insensitive	f	\N	2
859e3d78-7e2a-8233-bf1f-90c76e3dfc3b	5g5j201o036d1c153k	bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	It selects Node.js child processes only	f	\N	3
7972582f-ae71-8057-9aea-26324adbf027	1j5n4q4y4o0w1j6l4i	deeeb039-35df-854d-a816-601d7386c7ce	Identify the most relevant load parameters	t	\N	0
b7eec568-a612-8895-a670-385e4fafefc5	2k6r0h1c2o4s21163q	deeeb039-35df-854d-a816-601d7386c7ce	Measure current behavior using suitable performance metrics	t	\N	1
90020a1d-e0f0-8ec0-892f-b3fec796de2b	0f5e3r733w2k0s4n12	deeeb039-35df-854d-a816-601d7386c7ce	Define the behavior or targets required as load grows	t	\N	2
3bfac761-96bd-8780-bcd7-53bc13247401	2g5m6s580u4s4s235w	deeeb039-35df-854d-a816-601d7386c7ce	Choose and evaluate an architecture that can meet those targets	t	\N	3
f1a306d8-e662-82a9-9b33-cdc19218a9f7	4g3r5p242x3j57503y	01ffa53b-2875-8d4c-95f5-da4c04c89f9e	Different applications have different load parameters, access patterns, and reliability requirements	t	\N	0
8e40004c-4325-8229-9019-c09c33a04b01	0v0b0t133g3n4y732x	01ffa53b-2875-8d4c-95f5-da4c04c89f9e	Scalability depends only on the programming language	f	\N	1
ce0e115b-b873-8dfd-abb5-ab4a7e58e800	4h712m5n3c6s604l2x	9718cbdc-48f6-8e50-a412-a9589360f397	ss -tulpn	t	\N	0
ba616b99-9f61-8537-8daf-b6171c8880e6	2w0s60576o5z5v0v04	01ffa53b-2875-8d4c-95f5-da4c04c89f9e	All distributed databases behave identically	f	\N	2
17b4b4b3-9188-8844-bbc6-0df1555600db	433w143y51276z0b1i	01ffa53b-2875-8d4c-95f5-da4c04c89f9e	Performance requirements never affect architecture	f	\N	3
510ff0ce-b7a8-80e6-ac69-682e1c5c3e35	48245n4t4j041t006o	2834179a-ca26-8275-92a3-b05000ccb4b1	Previously embedded strings need to become references to shared entities	t	\N	0
31ea4e18-9dae-8398-bcdb-9d04e0c6bb76	0o4e2h3a6q1v451u10	2834179a-ca26-8275-92a3-b05000ccb4b1	All profiles should be converted into image files	f	\N	1
509e64d0-0937-8a8c-82cf-28202544f764	236q214e3t3l6x1370	2834179a-ca26-8275-92a3-b05000ccb4b1	The application must stop supporting queries	f	\N	2
16edc9fa-5410-874f-90f1-f392636ba4dd	175o2f5r6s0c4a0l00	2834179a-ca26-8275-92a3-b05000ccb4b1	Every relationship should remain duplicated permanently	f	\N	3
da5270ae-8636-87af-bb27-febf490b3f2a	6q3u5s1b1f4o6b5c4e	725a8b84-0a4d-80d9-9dce-b885f56a676c	кишеня	t	\N	0
929a1849-6f23-8e46-86e1-5391945cb2e2	72623g5y4c4e3c1e6n	725a8b84-0a4d-80d9-9dce-b885f56a676c	кишеню	t	\N	1
a163bc88-561e-8c11-b38e-6c09c32967b1	5n0j01554d5t3p270f	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Hat	t	p0	0
7a6aa6b1-c5ed-8036-9eab-d843c545542c	394k1n1y1b300m1a48	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Gloves	t	p1	1
a470e030-e8ae-879b-8f1f-83abd73580f2	0p5747366y6j6m3c6j	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Socks	t	p2	2
960e8bd2-9ae2-8061-9a94-76b0e6f25265	05173u0n0j054s3z03	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Scarf	t	p3	3
39f563a8-23a5-87cf-a35b-67fc41abd343	600a1l151p5b002q6i	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Head	t	p0	4
b6c806b1-e4aa-8af9-87fe-ea4b6322117e	6g1s2v230z441f3773	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Hands	t	p1	5
411e6973-b46b-8bd2-9dc8-0599c76f4082	6y3t1q672m6666171z	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Feet	t	p2	6
ea45712d-e4b1-83ff-a644-ef978e0f601f	5i49264t3v23184c0k	c20b0f9e-379c-8dce-8596-1ea844d9bd0a	Neck	t	p3	7
b646a45d-88cf-8d4d-92b9-6b06614e2bdf	01386s171k6b393x5w	e0d32edc-4908-83e4-805f-8945c738605c	The shell truncates `log.txt` for `>` before `grep` starts reading it	t	\N	0
e7028d9b-7ae8-83ee-8cb4-32332d38c15e	6u2c364l4o6k3y3q4n	e0d32edc-4908-83e4-805f-8945c738605c	`grep` deletes every nonmatching line in place	f	\N	1
8d974679-70ae-863c-9a24-1db1be5a4414	0c2r106d102f52302l	e0d32edc-4908-83e4-805f-8945c738605c	`grep` cannot read text files	f	\N	2
599fe0e2-96c2-8584-925d-30db9d83d3d8	192y596s0u5j631e55	e0d32edc-4908-83e4-805f-8945c738605c	Stdout and stdin cannot reference the same filesystem	f	\N	3
87e00ce9-9ef0-806c-ae86-940017922bff	5o270p2w4i0d3z010t	cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	`result.txt` is truncated or created	t	\N	0
091d9b26-d5cf-8605-ba14-25e34d82a7da	2v200v5c1w0z5z2n6x	cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	Output is appended	f	\N	1
913a7218-7b2e-80fb-83d7-f259a0284513	4g62485j6o623z3c2b	cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	Only stderr is redirected	f	\N	2
5e8c27db-4423-8da8-be76-19b164361232	5h2j4g6o0c726s2838	cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	The command reads from the file	f	\N	3
7f84ac41-5f52-83b2-bf19-e39770a128a7	6j5b61412g4s1c580c	cf7bb76e-641e-8b56-bccc-9de7922c735e	салат	t	\N	0
54444342-bd56-8e96-965c-d70ccd9eed4f	646o3z4a0l0n345a3w	cf9a6f8d-d091-8c5d-80e3-1db49f31623a	grep	t	\N	0
3c0401d8-1f4e-8b21-b301-b456e0e4213b	1n5j543o6w4j1s5z6f	cf9a6f8d-d091-8c5d-80e3-1db49f31623a	rg	f	\N	1
87df1639-dc55-8502-9277-67874587527e	6e1i311s1c5w285h1w	cf9a6f8d-d091-8c5d-80e3-1db49f31623a	Spotlight	f	\N	2
fbd09cc7-6ea6-899d-b029-45dd9b41330a	6l4r5a5t2c372n1j5u	cf9a6f8d-d091-8c5d-80e3-1db49f31623a	Finder	f	\N	3
3d29b776-2e7d-8d3d-9c33-d79785741ff3	183f0c0c50175r6p4n	cde1048f-b752-8b92-8d91-ba64737e534e	Хибно	t	\N	0
21454ff8-0d13-81b0-8c0b-be0f0e04f478	3t0n0n6c5r5f58516v	cde1048f-b752-8b92-8d91-ba64737e534e	Істинно	f	\N	1
0114e48a-ca96-876a-b39d-a140e5d5e6fb	4p6k6u323o1o315p73	ce78c61c-aa9b-8ae0-9a4f-881a3c1b5f91	boots	t	\N	0
395075ce-a3bd-8bb9-ad9e-6e18bbb1cc80	4g1l1f0t006k222833	7ce6ccec-a9c4-8401-a325-18f4317acbff	pyjamas	t	\N	0
2b69ef6d-7952-8cf4-a75b-5704a8e750a6	3v3y736s3u3y0o266n	8184535d-6c50-812b-975e-f6a5c5a336c2	gloves	t	\N	0
def13fa7-c6a3-804a-8420-599f07e411f9	5n4t3m04382a0f0s12	65789a15-ec78-8505-82ea-f4df69754a07	grep -rniE "(todo|fixme)" .	t	\N	0
d212ba5e-fa30-82ac-af42-ddd60f089da4	3d5e5f612p5e0s2g5m	65789a15-ec78-8505-82ea-f4df69754a07	grep -rniE '(todo|fixme)' .	t	\N	1
b5cd5c52-1799-84d2-b6f3-ece3e1cbdc22	5o27025e6r5p644h1h	d539ffb3-1414-83d4-a888-392bacfe9a04	sweater	t	\N	0
bfaaf0cc-923b-893e-9928-3b2647835a25	724q64231q4s0q1s44	cc0b7b72-e745-887e-907d-b0785c13a508	піжама	t	\N	0
e84495e2-03e4-892f-af4c-7db9609e341a	5e0j2f2m1w0e2i2e06	cc0b7b72-e745-887e-907d-b0785c13a508	піжаму	t	\N	1
260ec3b1-ae1d-8655-bc21-01d998833374	2c5a512i22081a3n1s	c9c7ecfc-de70-8235-be89-074147fc8ee3	blouse	t	\N	0
fef012f4-905c-81e9-b08d-1c5854703ba2	1q4j6r6t0u6u1p0d6c	79220895-4e55-8f69-8ba0-5faad9e97f12	The application may retrieve the complete object with one localized read	t	\N	0
c58014ad-5c09-8e75-a3cc-234d8b4bed28	3e316i2z0m2t724r2i	79220895-4e55-8f69-8ba0-5faad9e97f12	Every field automatically gets a global secondary index	f	\N	1
1e7c39e7-0e32-8125-bf42-0f47c66d49a8	1t443g480r02361v3d	79220895-4e55-8f69-8ba0-5faad9e97f12	Many-to-many joins become unnecessary in all applications	f	\N	2
587cb1fe-4ac2-8bf9-849b-658448be899f	277160060e5f0b4b3d	79220895-4e55-8f69-8ba0-5faad9e97f12	The document can grow without any size or update cost	f	\N	3
94bd92f1-f83e-836b-a57a-fc254444846c	012b0r56421r2x353m	75e38364-4e93-831f-8d1e-73f96601b1e8	nohup node dist/main.js > app.log 2>&1 &	t	\N	0
6d3b398d-407f-865c-9785-777e56042758	3b1q5x4u595e104246	75e38364-4e93-831f-8d1e-73f96601b1e8	nohup node dist/main.js 1> app.log 2>&1 &	t	\N	1
4f176242-c83b-8033-832d-dafec892c173	6g2h3w2v6g6w2n370p	15535a2d-826e-8205-a33b-41f47925d22e	Eliminate single points of failure where practical	t	\N	0
f1f3cb9b-d177-84d9-8746-a9d98e456bbc	3807414h1r5a413c4l	15535a2d-826e-8205-a33b-41f47925d22e	Test recovery and failover mechanisms before an incident	t	\N	1
79551ff7-211c-8b51-b314-67dd4951bd82	274l6u4u68545i5e2g	15535a2d-826e-8205-a33b-41f47925d22e	Monitor whether redundancy is actually healthy	t	\N	2
8d959e28-e86f-8637-8e3d-dd5075a65876	4l5k2204344p6t363m	15535a2d-826e-8205-a33b-41f47925d22e	Treat backups as sufficient without ever testing restoration	f	\N	3
943d1c4a-f1c2-8caa-a28f-5e162e35e797	1k5q5t5k2x0r5r0k0e	877742ee-5068-8db5-af02-6c30eefc4f2d	Do you know	t	\N	0
ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca	4x69251v3e0c6b6b45	877742ee-5068-8db5-af02-6c30eefc4f2d	where	t	\N	1
eefabbdc-a4c6-8523-b585-ddb5e01280e6	422w1n435p0120680a	877742ee-5068-8db5-af02-6c30eefc4f2d	the station	t	\N	2
acb65390-c6f1-849c-b5a0-46de7250b519	0d0p4o1p0y550b5i4v	877742ee-5068-8db5-af02-6c30eefc4f2d	is	t	\N	3
73b41012-47d9-8b80-becc-3ad3fc5d80b3	6x5a5966230u4s4z2o	29149c08-624b-8964-8532-e7bb888eafd3	rm "screen shot.png"	t	\N	0
f77250f5-a9d8-8412-8cef-7d9803760849	1z5y094y5g262x5d5p	29149c08-624b-8964-8532-e7bb888eafd3	rm screen\\ shot.png	t	\N	1
1015bf78-5215-8b30-a4f7-ab03054fccb1	2a3z604t1b3d5o3i3k	29149c08-624b-8964-8532-e7bb888eafd3	rm screen shot.png	f	\N	2
ab83c056-df78-82f2-902d-8e95acfdfa5d	3s285600181p1x0p1m	29149c08-624b-8964-8532-e7bb888eafd3	rm screen* shot.png	f	\N	3
f9775ea0-08ba-842c-9d7b-2d7463a3ad00	1l3x2i35361n330u4l	8b566ae7-fd72-826e-a495-10de8d99e348	сандалі	t	\N	0
9ba7619e-2124-8eb0-9c22-860549e1772f	1q034b5u1m225p0767	02cdf03d-9f2c-8ce4-8662-10289e1887c0	блискавка	t	\N	0
b043eba4-46a2-8910-8bf3-44166503f281	2o4z4g0v4k073t504y	02cdf03d-9f2c-8ce4-8662-10289e1887c0	блискавку	t	\N	1
47d526b7-1604-8378-add5-5b50dc1af505	3f3i5z1c0c6w122n68	5691bb7c-8592-8999-a296-143809294193	grep -rni TODO .	t	\N	0
148df628-c6b0-8cd4-be5a-3a3d4791a05c	6q3c2f4v1y17454z11	5691bb7c-8592-8999-a296-143809294193	grep -lv TODO .	f	\N	1
611fe4e9-f381-825d-94f5-552487c79ce3	56466v0f636d12014x	5691bb7c-8592-8999-a296-143809294193	find -rni TODO .	f	\N	2
4e4cd31b-2cd5-8f2d-af85-ef95e8fabdf8	0j6m2u0r3n1e3a3411	5691bb7c-8592-8999-a296-143809294193	grep -c TODO	f	\N	3
fa30892d-c34b-8393-8598-bc77bbb3fc6c	5t2b2f4i496j2u3f10	5dd4bdfd-e18d-87ff-9f05-9c3447893b49	Queries describe results while the optimizer independently chooses an execution plan	t	\N	0
9a1e78b2-4424-85ec-92e5-192ca88745d0	541h545p3m2e6f0z0e	5dd4bdfd-e18d-87ff-9f05-9c3447893b49	Every query manually specifies the exact index and row traversal	f	\N	1
932f26d5-62a5-886c-9f04-cb1944ca9ef5	6t5r174g0x734b5t1r	5dd4bdfd-e18d-87ff-9f05-9c3447893b49	SQL stores data only in insertion order	f	\N	2
f7b8e284-4a08-853f-ac83-e9f90f22b587	585g6o2i2v182d255m	5dd4bdfd-e18d-87ff-9f05-9c3447893b49	Indexes modify the meaning of the query	f	\N	3
34af1488-2a1e-841c-ad03-7dab3e5eefc6	181u3l6s4p2q6g6r64	13d2b00b-9048-8726-810c-3aadfe70d16a	True	f	\N	0
eafdb2da-07c0-8937-930a-3016872de046	186k073v1i196e691s	13d2b00b-9048-8726-810c-3aadfe70d16a	False	t	\N	1
c70a6961-1929-8b08-ac76-f69b98ba34a8	0t0l250c37352l3f4k	9718cbdc-48f6-8e50-a412-a9589360f397	netstat -an | grep LISTEN	f	\N	1
24791fa3-252a-813d-84ab-f5300033cf9b	5052220d586z416a4h	9718cbdc-48f6-8e50-a412-a9589360f397	ps aux	f	\N	2
e43270eb-df17-866f-99e2-49aabe71f99a	4423044r3l3n276i3b	9718cbdc-48f6-8e50-a412-a9589360f397	df -h	f	\N	3
f697f2ec-2093-860a-94c4-44b3cf0f55b8	4q334a4k5y0e4m1272	7bff993f-8a2e-8c2a-8d1b-e57e392574a5	cake	t	\N	0
373a3422-a803-8257-ade5-e4d1488c619d	3b4000036m501f3c1s	f8b8bc29-6d69-8ba3-b600-42766f969edf	I	t	\N	0
f93f3b2f-d61c-8b73-ba8b-aaabab8639f1	380x4g5a1a4l015346	f8b8bc29-6d69-8ba3-b600-42766f969edf	am	t	\N	1
af369b0b-979a-8d11-96c3-1a3f9712d179	14092t2x4o2v123n68	f8b8bc29-6d69-8ba3-b600-42766f969edf	wearing	t	\N	2
e29bb945-ed9d-8c7e-b828-78d1a4d4e4ef	556173314n1o400w5c	f8b8bc29-6d69-8ba3-b600-42766f969edf	a	t	\N	3
e097889c-505e-8dfb-a505-7999e979aba6	1d094r656z6323035g	f8b8bc29-6d69-8ba3-b600-42766f969edf	blue	t	\N	4
c5c1d95a-dd22-8a4d-be5b-793caf8e6bbb	000w6e14532631512l	f8b8bc29-6d69-8ba3-b600-42766f969edf	shirt	t	\N	5
96df9f2d-2d04-8f16-b8ee-7a8d5f3994aa	0l465j4e3b0g2n2v6o	727a7d0e-a227-852b-9493-e6e5516f5093	-size +100M	t	\N	0
fd304da4-ac63-80c9-9533-4ee7cd5e29ed	1i0e4s3h6i301m6z3c	727a7d0e-a227-852b-9493-e6e5516f5093	-size 100M+	f	\N	1
7d85b27f-fbdd-890e-aa32-c0d64035cb21	4g4e105z5w3r6m155z	727a7d0e-a227-852b-9493-e6e5516f5093	-size -100M	f	\N	2
a19f4bfe-30ae-88b7-a24b-6e7dbdaa47f2	47710v1971394x2o15	727a7d0e-a227-852b-9493-e6e5516f5093	-maxsize 100M	f	\N	3
6daf78f0-9563-80e2-987a-3fbde8fb0f4b	6m3s4g1w272l4j3n22	926f924e-f393-85df-9a9c-d0207306c0c1	milk	t	\N	0
712b9b2f-5a64-8227-9843-cbf8c2a53de2	0w0n386o2m5i3o3d73	eb245695-0058-8d64-8443-0232a7b1a47d	Coat	t	\N	0
86c6739f-f591-8e78-be57-8a9c8be02876	276u38163l0q0k402j	eb245695-0058-8d64-8443-0232a7b1a47d	Gloves	t	\N	1
604d8ceb-3103-81d5-a5f4-9838e17c7d0e	6e5m231f6d5a55335d	eb245695-0058-8d64-8443-0232a7b1a47d	Scarf	t	\N	2
7d50d9a4-0de7-8b28-a46d-1b72c2641936	342i0w2j2p6x602h2a	eb245695-0058-8d64-8443-0232a7b1a47d	Shorts	f	\N	3
a6e607f3-9066-8468-901f-e17133adb070	5g295f1l262t646d2j	eb245695-0058-8d64-8443-0232a7b1a47d	Sandals	f	\N	4
7e9a9462-58f1-87e0-99fc-8d88a28c0113	4t202z320t4g0d346v	ee033d47-a447-8c33-8f22-da9c2c1139ba	stdin	t	p0	0
146609c2-7890-8ecc-947f-e87165a76a71	4o213l01482m6c2t2e	ee033d47-a447-8c33-8f22-da9c2c1139ba	stdout	t	p1	1
e5b58dfa-75a3-831d-99a7-1bf5699ee5c4	0f571r1p0b6i6n1h4x	ee033d47-a447-8c33-8f22-da9c2c1139ba	stderr	t	p2	2
b09571b1-89b4-83e3-ba05-646f876291da	1g316m4l2y3u1w2d4s	ee033d47-a447-8c33-8f22-da9c2c1139ba	0	t	p0	3
cd53b4cc-aca6-8145-9c0f-e79ca8f13c4b	0k4m670c0p6u1g395y	ee033d47-a447-8c33-8f22-da9c2c1139ba	1	t	p1	4
531b8ac3-93f2-8ab3-8e3e-2d53c00dbfc6	723a6g0z523i574j39	ee033d47-a447-8c33-8f22-da9c2c1139ba	2	t	p2	5
006beaa6-92c2-8426-90f8-0fefa5ffad70	2m1w362y6s43232q60	b931cb06-d05e-8ec6-9795-c489217db379	coffee	t	\N	0
f11ec625-ae27-81ae-99bd-960d1382f78e	2r5v5c2f074c6o0217	1870667a-01ad-8bb2-9ff1-243c8b27ae5a	True	t	\N	0
c8565d20-60d7-830a-b983-3f0222ed560c	6x173n4w582o6s5f04	1870667a-01ad-8bb2-9ff1-243c8b27ae5a	False	f	\N	1
684423e4-7d26-8cfb-a3b2-ab9f6cfbe9bc	45452w1t022y2y4b05	13561850-3a37-82af-84ce-454f4caf47fe	суп	t	\N	0
74230355-8fc5-831b-a049-f3d571494af5	346x1e36252s404o1g	9070dbb9-0c94-88bc-9365-025d939eea7f	Gloves	t	\N	0
59bb270e-2dc6-85a9-a98e-2aecf809063a	465t4g1z2v1g523e23	9070dbb9-0c94-88bc-9365-025d939eea7f	Belt	f	\N	1
57eb11b5-150c-8b20-85a7-16ec4a6114b7	6k561a0y054u3v3q3b	9070dbb9-0c94-88bc-9365-025d939eea7f	Cap	f	\N	2
47a0ca40-6ece-8101-933f-eac9e64e7e63	013173162w3v266j2o	9070dbb9-0c94-88bc-9365-025d939eea7f	Socks	f	\N	3
019ad2a7-f272-8b3d-a3c9-4a9e5fb36612	586x583i3j1j2b056e	78f9fdd3-d042-82f6-9f78-72fd962f617b	chicken	t	\N	0
a743b3f4-db67-8bba-9f7b-3b370af140be	6c1d4e1k3a1k023b4f	024c7c63-d5f4-8f29-9470-ca3af756dc51	м’ясо	t	\N	0
fcb2074f-ed15-8b47-868a-44916cc2dc15	3h4v5h6p5l356k1y6d	024c7c63-d5f4-8f29-9470-ca3af756dc51	м'ясо	t	\N	1
4194cff9-df48-8bcd-bc92-0e8d9428e67a	521t2g135o5o4t1h6e	13525375-1855-87f9-a506-ad882d6e9662	Recursive search, line numbers, and respect for `.gitignore`	t	\N	0
5c0d95b3-8c00-8b18-94da-353e88f201be	3b2p3o4q5s726t1s1e	13525375-1855-87f9-a506-ad882d6e9662	Deletion of matching files	f	\N	1
1d8b5971-5570-889a-84d4-bb807a0118ae	5t5f6h2t4z43724z69	13525375-1855-87f9-a506-ad882d6e9662	Only exact whole-word matches	f	\N	2
24b1648f-ec05-8e75-9756-156cea96dd8c	4x6g2b4k606a3w2m64	13525375-1855-87f9-a506-ad882d6e9662	Search only in hidden files	f	\N	3
96650d20-e67d-8708-9555-2955173d54af	61285w0w4a0g2y3w5s	7e92a1d0-a3f6-83fc-a7be-e88f71419f68	яблуко	t	\N	0
0e933d9b-190d-8886-9de7-86d389b01c0a	6g4s210s5m456e4d59	10b59ad5-03cb-86fc-a265-9ceb0a087bd0	The framework controls data distribution and execution, while user functions specify processing logic	t	\N	0
48e79a7c-6ac3-8c32-897e-1d523d5ecf08	540p552d472q3t345p	10b59ad5-03cb-86fc-a265-9ceb0a087bd0	The user must manually route every network packet	f	\N	1
c7d229e0-a58e-8434-99a7-2e2dbc97cbb3	2z035v2d711p5p5i0n	10b59ad5-03cb-86fc-a265-9ceb0a087bd0	It contains no user-defined logic	f	\N	2
95319f61-34da-87a3-b174-3d24a4756e8f	2n5r404j1t2f0o700b	10b59ad5-03cb-86fc-a265-9ceb0a087bd0	It is identical to relational algebra in every respect	f	\N	3
88f23419-bb16-8602-b57f-33d0c48bb5de	6u0713265j1o6k4g0c	3c8437d0-01fe-8296-b103-0d88203c29f4	zip	t	\N	0
525199fd-8445-857d-90e2-2d5b612150a1	4w6c4a2o3d395w4n16	fa190593-0f0f-872c-9dc0-88516b47f762	ls -A	t	\N	0
5dfa44fe-2683-8b4f-bb34-b351dec79eaa	6m2j0x0l0o3y13380v	fa190593-0f0f-872c-9dc0-88516b47f762	ls -a	f	\N	1
bbb85cab-5342-81e9-ad33-0e95d341aa03	5d4d55311l4l472y2v	fa190593-0f0f-872c-9dc0-88516b47f762	ls -h	f	\N	2
98331900-476f-884c-a406-55647b271426	6j4z0n1f2l005v0j22	fa190593-0f0f-872c-9dc0-88516b47f762	ls -l	f	\N	3
632ebc83-dce6-8638-be77-0a26c088fbe1	4p5j3z5l403k3r3l01	0e7e852f-e50b-8952-bc3e-c0c83de81cac	tea	t	\N	0
ad35f7ac-fdf6-882e-9c4d-2773f0c56216	3w5o0v29084h685t50	4050b806-1050-896c-963a-30fbfa3a383b	df -h	t	\N	0
2cd048b9-29a0-8208-a457-3eb7d7e9aa1f	615e4n4o44724h4o2q	4050b806-1050-896c-963a-30fbfa3a383b	du -sh *	f	\N	1
1d6aaa9f-b50a-8bfa-94ed-c7d9ce9a2cb1	4d0h0m151b483m0s3o	4050b806-1050-896c-963a-30fbfa3a383b	free -h	f	\N	2
242b105d-2a61-8ad8-beb1-46037c74284a	490e4g046l492z2x46	4050b806-1050-896c-963a-30fbfa3a383b	ls -h	f	\N	3
12dd2e83-fa28-8bc4-97ae-817f21859a6b	0g4e6p6y2e0n4w663v	be54437f-d5e9-876b-b691-27009848bb48	du -sh * | sort -h | tail -10	t	\N	0
23da1682-c10c-8c10-8f53-1b51fbb30702	011s5j0d612q300e1l	be54437f-d5e9-876b-b691-27009848bb48	du -sh * | sort | head -10	f	\N	1
46a4e634-e631-8526-b0f8-0b9546286b6d	3q5701252t5c0g2818	be54437f-d5e9-876b-b691-27009848bb48	df -h * | tail -10	f	\N	2
3d47d488-8aab-8667-a603-7e0741f78675	4k714y420f572s2a0n	be54437f-d5e9-876b-b691-27009848bb48	find . -size 10 | sort	f	\N	3
731ff63a-b9e5-8216-9199-3eb47720e6a6	6d0w015q2q4q3c3f5o	398e6cd8-2e76-8eaa-a5bb-aaf85c5012fa	pocket	t	\N	0
a27a3deb-9cf7-8135-882c-7fa64fa2568e	1x3i4f1o734o70735b	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	Edgar Codd, 1970	t	\N	0
3ffc6e93-9c03-8d2c-8459-86b0f037b9e3	3i3w33363v30284d4l	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	Edgar Codd, 1985	f	\N	1
856cd096-e6fd-8d5c-99f8-2ad87c3ec919	5056384i4w7331250f	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	Michael Stonebraker, 1970	f	\N	2
1d0cddaf-8c9d-826c-bc0d-48226dc64b05	1b5j0k623l1d5c1o33	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	Jim Gray, 1976	f	\N	3
e2724454-3413-871d-a3de-8f109169be94	5m6g246f391e3f3a47	98d2f28b-b220-8068-9755-1eae8ff052d2	Make readers tolerate the missing field and have new writers include it	t	\N	0
dc893c5d-d7ec-84d8-8ae4-f1ec4966280d	1z5g6z5q3w4u400e3f	98d2f28b-b220-8068-9755-1eae8ff052d2	Assume all historical records already contain the field	f	\N	1
70d21a4e-35de-8395-ab52-0fe51a40dfae	1r0o1y0g3s1q4u6n4k	98d2f28b-b220-8068-9755-1eae8ff052d2	Reject every old record immediately	f	\N	2
2900f4e6-e7e3-81a3-8524-27c67a7a2ac0	5x2v6a402e1g082w1n	98d2f28b-b220-8068-9755-1eae8ff052d2	Duplicate the entire database for each schema version	f	\N	3
e0c84731-0a3c-8b2d-be15-b1dd16e19c8f	5b3x665o4i6b1a2329	c466d667-35e4-85ff-9026-785bc93857dd	Dress	t	p0	0
9f60aff9-f2db-8654-ac70-4759dae0ded2	382s2a0h4m396g2u3b	c466d667-35e4-85ff-9026-785bc93857dd	Shirt	t	p1	1
9be9b46c-af8c-82cb-b186-dd31cfbb4c94	290d712j1n1u203c1h	c466d667-35e4-85ff-9026-785bc93857dd	Belt	t	p2	2
2572315f-49ce-8079-864b-df389d7a02ad	446o5c72704368193v	c466d667-35e4-85ff-9026-785bc93857dd	Shoes	t	p3	3
f5e30838-ec05-80c6-a86e-c73bd6afe6da	4u1r262w0w58313r1m	c466d667-35e4-85ff-9026-785bc93857dd	Сукня	t	p0	4
5e201439-abb3-8a56-8877-e8f4540b2805	02106c6k4j2429665a	c466d667-35e4-85ff-9026-785bc93857dd	Сорочка	t	p1	5
5b00288c-2d0b-8962-819a-c0a51ea90073	1j5g4d426f103a2f2l	c466d667-35e4-85ff-9026-785bc93857dd	Ремінь	t	p2	6
737a6308-9580-8a15-bd53-738dec77b365	5v4z0s6q2s076d071u	c466d667-35e4-85ff-9026-785bc93857dd	Взуття	t	p3	7
cfa64e98-17e9-8767-a9f3-55584542fe7c	465w2r5m3s5b2r4w3g	ddbc9a48-4047-8646-ac6d-6e85ded76f42	помідор	t	\N	0
0a2e45b4-31a9-88f1-ba45-6612ee68320e	4d27703t6r3q476c2a	ddbc9a48-4047-8646-ac6d-6e85ded76f42	томат	t	\N	1
141d0378-bafb-8147-802b-197f7474c6b6	4p1x60640r3v4j1g3w	ba03a02e-7bcf-8475-952a-7c760012c37e	Distribute the load across multiple machines	t	\N	0
b542c891-bde0-8d67-862d-68429531aafc	1l4s73685h4e4w3l48	ba03a02e-7bcf-8475-952a-7c760012c37e	Replace percentile monitoring with averages	f	\N	1
02a12464-9e4d-879f-af30-dffc8c7e250d	256i4h6k102k6f530g	ba03a02e-7bcf-8475-952a-7c760012c37e	Remove fault tolerance to reduce complexity	f	\N	2
9660f5e1-fb5a-8def-9d44-1a86328c93bb	1y29602d5v043z4u6x	ba03a02e-7bcf-8475-952a-7c760012c37e	Keep the same hardware and assume traffic will decline	f	\N	3
6dc5da7f-d286-8c27-981d-8b5ab7c0e343	604w6m1i3b5g4u2l10	762cd5b1-d4fa-833f-9f7a-5d64162d960d	True	f	\N	0
4cb44320-7ea9-8598-b6b1-8394f2fa6099	2t243f171t5f1x2w5r	762cd5b1-d4fa-833f-9f7a-5d64162d960d	False	t	\N	1
c2e71593-3473-875b-b0a0-252bab526ad3	3w131e6k3a6v5c141g	240ed98f-7280-8081-ac83-966292f63e5d	куртка	t	\N	0
b3171e52-a6bf-8b93-a409-b0e44ec0fdda	5e2j5b5i1m1d3q2f6b	240ed98f-7280-8081-ac83-966292f63e5d	куртку	t	\N	1
418edc37-2d3a-8ce1-bab1-0e4c9176b791	422f5p6c0b1n5g2k1t	cd281ab2-0b80-8059-ac87-cca56165b018	Так	t	\N	0
8f5ccff6-6356-851b-8e80-abbcfb223b64	2a196h1c6h6o2j6h5l	cd281ab2-0b80-8059-ac87-cca56165b018	Ні	f	\N	1
c0b0dbb8-f375-8e5d-a4df-cf09a1707b76	6x2k0w2f664d3s6j2w	bf4dd249-d14f-8ef6-b1f1-8bb423fb3cae	блузка	t	\N	0
ad5a3657-434c-84b6-8d69-af4c327ebfc8	6r1n0x391x6o582z73	bf4dd249-d14f-8ef6-b1f1-8bb423fb3cae	блузку	t	\N	1
2bd1847e-c881-8f70-b89a-6f77f9707c0e	402d2j2m686b0j5e3l	f63867aa-4dea-82bd-b5f4-def14df0b116	True	t	\N	0
531ba056-81e9-89f6-bcad-9337b6214828	273h335w0l2v0s2000	f63867aa-4dea-82bd-b5f4-def14df0b116	False	f	\N	1
9e246a4d-ec4a-8b58-bbf0-17eda0e7abb6	4w3a3i490j6t5e1k51	d8148550-5148-8b1e-974b-6ed02a6754c1	salt	t	\N	0
cd5300a4-0861-8ca6-9a5a-4c278bbf4409	20432j233j3i2d4m39	28d48723-0ad1-8ffa-804a-fa45f0bfda83	> app.log	t	\N	0
ad71e18d-2227-8249-99ee-710456b4acc7	3a2v06605a6q2y1u01	28d48723-0ad1-8ffa-804a-fa45f0bfda83	: > app.log	t	\N	1
bfe41a26-fdb9-853c-851d-8d78c56ccb45	6k3x4u2e0k6b0p402y	28d48723-0ad1-8ffa-804a-fa45f0bfda83	truncate -s 0 app.log	t	\N	2
455dbb18-4682-86d7-9534-3ede5c580769	683z4a1i40260s1b0z	28d48723-0ad1-8ffa-804a-fa45f0bfda83	cat /dev/null > app.log	t	\N	3
6011dfad-d53f-87ea-bcd4-f14b0e1af211	1t5m4e650r3t4b4831	b7fa0752-b2b6-8caf-8dfb-fa53806a3a10	краватка	t	\N	0
14df34e5-efe0-8138-99c2-253bdf71277b	3v0f1l061g38460j2q	b7fa0752-b2b6-8caf-8dfb-fa53806a3a10	краватку	t	\N	1
c45e3ecb-cac0-855e-8089-ef15eb69ac18	1b5r0b3z3q3y1v0h00	19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	Implicit logical AND	t	\N	0
9147ae68-c8c5-8760-9859-7385d7161564	1i5k0m0u3y4b0x6b45	19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	Implicit logical OR	f	\N	1
591e4de1-11b1-8cce-97ce-c31161ff7da9	054s6h1h4u3z3o032g	19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	A pipeline	f	\N	2
bc780252-7349-8f7a-b6a8-c798980cd1e6	6t102m0w445j210m3l	19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	Only the last criterion is used	f	\N	3
8c2e0b05-c945-8054-bda2-213efe56bd81	1i2s4o2y472c2g5g3b	86557979-9c3c-8f79-80cb-329e36c5e99e	Evolvability: the system can be modified and adapted without disproportionate risk	t	\N	0
056b8cae-30bf-8a02-a595-85396b14d2b0	4l0r223x0f6j1p0f4y	86557979-9c3c-8f79-80cb-329e36c5e99e	A fixed schema that can never change	f	\N	1
c2a49296-e6d3-8335-9755-6f49917f95de	6y1l2m61706w645644	86557979-9c3c-8f79-80cb-329e36c5e99e	Dependence on undocumented behavior	f	\N	2
ae2247cf-c9b6-8051-a242-7ece627b9cc8	4j341i3b3i311t2637	86557979-9c3c-8f79-80cb-329e36c5e99e	Optimizing solely for today's exact workload	f	\N	3
5f928615-5d13-8e94-ab7b-bfb71f308b82	5672326r2t6u376l2f	89e593ff-4696-8e64-8c9d-5d386aa2b437	A document model that stores the profile and its one-to-many children together	t	\N	0
97b2cb59-bce5-86f4-a2a8-e51c6827f6de	4o3c2s256202622j3h	89e593ff-4696-8e64-8c9d-5d386aa2b437	A graph model solely because the profile contains several fields	f	\N	1
cc4d4c15-a640-876e-8c03-186fd9e38f00	54614o3e351j0e4372	89e593ff-4696-8e64-8c9d-5d386aa2b437	A separate database for every résumé field	f	\N	2
9b0ebff1-5c53-8c7c-b5c4-c132746da8c3	1m6g331v1r5z3i6s6o	89e593ff-4696-8e64-8c9d-5d386aa2b437	A flat table with no way to represent repeated values	f	\N	3
310683ce-ee04-84a4-b058-c35a28eb1dfa	544i365h3r4p4r2e3m	2cfa8251-a04b-8e69-a160-89bf1b78e622	The database can change execution strategies without changing the query	t	\N	0
fe321f12-db1b-8376-b558-d0dbaaa553d8	5w2c531s5l330h1e06	2cfa8251-a04b-8e69-a160-89bf1b78e622	An optimizer can use indexes and statistics to choose an efficient plan	t	\N	1
4649cfe6-132c-88ed-b88a-3acba517a7e2	4e005j5v2y6e1b374t	2cfa8251-a04b-8e69-a160-89bf1b78e622	The query expresses intent more concisely than manual iteration in many cases	t	\N	2
c4f9a749-3a0a-8fa3-b02f-28235edd8613	246l6j460d4g3x6q5d	2cfa8251-a04b-8e69-a160-89bf1b78e622	The query guarantees good performance even with a poor schema and no useful indexes	f	\N	3
e3423a90-6b92-827b-b994-1163456aafaa	5g1l1v4j2l0g0a134o	a53aa7ae-7e47-8eb1-bb3b-5ef27ec5d3aa	salad	t	\N	0
d76903ec-88c6-8a3a-bb71-4f55a8fc43bf	3v3m4j201f0k65673t	cd2591b3-5949-87e4-964e-7191a7d9fbc8	skirt	t	\N	0
13bce3ff-2318-8de0-9f07-8f776e95470d	4i265p1729455g272i	336283db-749b-8cea-b5b5-a670d877a41d	find . -type f -name "*.ts"	t	\N	0
27763563-9127-8779-b59b-53e7cb7da010	134v652j005d0t1u50	336283db-749b-8cea-b5b5-a670d877a41d	find . -type f -name '*.ts'	t	\N	1
1e3895c9-80d3-8ebe-a750-2fa026203a28	4n01663x1c1b6i2834	336283db-749b-8cea-b5b5-a670d877a41d	find . -name "*.ts" -type f	t	\N	2
899dfa96-c903-8a90-9d1c-ae8f23a43ba6	5r0x4j4o49201b4f1f	336283db-749b-8cea-b5b5-a670d877a41d	find . -name '*.ts' -type f	t	\N	3
c87b9fd6-3250-8234-8420-30755e65504a	5l3m1p6b2r0m6v401a	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	У network model запис може мати кілька батьків, тоді як в ієрархічній — рівно одного	t	\N	0
7a201d00-9bde-8a72-8f80-aa9db427ec05	0g3e3g5l321y6q4z0b	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	У network model взагалі немає зв'язків між записами	f	\N	1
13fb0482-239b-827f-af6b-382a7b3a613c	4e0u634n5l57386718	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	Network model використовувала декларативну мову запитів	f	\N	2
3553eee3-dca3-83e2-ab5b-78415eb8abfe	3a226b2j0j6h2g1l2h	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	Network model зберігала дані в таблицях замість дерев	f	\N	3
cafa82fc-ac54-872a-9db4-e180d7cc6a8b	070p33711d2j6r492t	fffb38a6-067b-8733-bc78-3162c40cbf6a	head -n 3 notes.txt	t	\N	0
ba76890d-723d-8a18-89b7-de9841ec2f4d	431v3a4l6f1o3b0r0r	fffb38a6-067b-8733-bc78-3162c40cbf6a	head -3 notes.txt	t	\N	1
728ba37e-193f-87a2-9249-f7e0b9f5e94b	225f511f4a132w4b43	00ca5865-c1a1-88f1-b3b8-dade63883e8d	dinner	t	\N	0
250a3377-e394-8b26-829d-6f0a2771323d	3t0j1s472y2y5x6572	18f2dd47-df78-8767-bce8-d538e95faf7d	Реляційні БД продовжать використовуватися поряд із широким спектром нереляційних сховищ	t	\N	0
23e0fcd1-1a30-8875-a80a-d472c9487f8e	4y36333850322r2f6b	18f2dd47-df78-8767-bce8-d538e95faf7d	Одна база даних, що підтримує кілька мов запитів одночасно	f	\N	1
363183f8-38cf-8c14-b7ed-7cd4b0b58497	4f0a1w5h1a626v1m37	18f2dd47-df78-8767-bce8-d538e95faf7d	Зберігання одних і тих самих даних у кількох реплікаціях різними мовами	f	\N	2
ca9c6c07-c2f0-888a-83c8-959da94cb488	6y2f1c4m575e3s3d4d	18f2dd47-df78-8767-bce8-d538e95faf7d	Міграція всіх даних із SQL у NoSQL	f	\N	3
75e64e27-d35d-85f4-a816-324ccadd9f38	573x1y3z4z0q4b3c44	e36595fa-b28d-8cf0-916e-d8b649288822	cd -	t	\N	0
fe535cab-6e60-8010-b6bb-36e5e39ae9c8	1u3g5u562w1x3u051k	e71a9f81-33d7-851f-81d4-caf732ca0723	belt	t	\N	0
0f5202cb-a97a-81fe-b940-1d443f74ef96	100j4o0r5m1p0p362t	09be3ff3-1403-891d-aea7-d6ae41a62bc8	less -N server.log	t	\N	0
dcdd7377-4060-887a-8e96-9c9eefc9b1bc	6h4658306h0o4b216e	09be3ff3-1403-891d-aea7-d6ae41a62bc8	less -n server.log	f	\N	1
d3620e3e-1450-8787-ab7f-e97a8f9655dc	6t1i285q2h1q59530h	09be3ff3-1403-891d-aea7-d6ae41a62bc8	cat -N server.log	f	\N	2
7bb7864f-b1c9-81aa-ade1-54db655ac7a5	153l4j590b6y460813	09be3ff3-1403-891d-aea7-d6ae41a62bc8	head -N server.log	f	\N	3
c9e2e331-784d-898a-8d19-9ff0c7430757	424l3s07102r4z3j6w	468da566-061c-8d59-9974-55c09e8215bb	Removing accidental complexity and creating understandable abstractions	t	\N	0
96dadca1-b37a-8549-8ebc-3cccfecff69b	14035p1z16242x202j	468da566-061c-8d59-9974-55c09e8215bb	Implementing every requirement in one source file	f	\N	1
1a7e4ec4-bb01-8588-abf5-91fbd3468481	3n2f050c2v5g3v1b0x	468da566-061c-8d59-9974-55c09e8215bb	Avoiding all sophisticated algorithms regardless of need	f	\N	2
c4922acb-6172-8483-81f7-961e96798608	1x700l546g0r382g5d	468da566-061c-8d59-9974-55c09e8215bb	Having the smallest possible number of servers	f	\N	3
774e773f-eda0-86a8-8075-180b83f321bb	3q6m2e3d1y2l67086x	cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	The framework may retry a function after a failure	t	\N	0
2d12aeb6-56d2-82ae-8d1d-da1cd9846c86	1l4l0m71630l0w0y5s	cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	The framework may execute functions in different orders or on different machines	t	\N	1
a666c376-8047-83f0-b77b-35f5a2309c57	651q250v3a674s4c6f	cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	Pure functions make repeated execution produce predictable results	t	\N	2
e76f5c53-2ef1-82a2-9ee1-cbb51124ca7b	3g1y6n4m0f6t080x15	cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	Side effects are required for correct parallel execution	f	\N	3
2e52c64e-7117-80dc-a047-d767d8cd084c	5s2k4r4x0y1v2g5f0s	0fbc89c1-f1de-8cd0-abaf-a6881c401929	ґудзик	t	\N	0
a5616b21-9497-8b3e-bccc-bdfb444aef92	6g2u0o1n2t0e3j710x	0fbc89c1-f1de-8cd0-abaf-a6881c401929	гудзик	t	\N	1
52e64fe4-c054-891a-8063-8a03c514bcf4	4u0n6o6v5n2m4b4f2r	3c8c3c15-79fa-8ee9-918b-ef8495d69cad	Application objects and domain structures	t	\N	0
ad6f16e7-8796-8e15-ab6a-797ac43f31d9	5r433e342m3e0v553j	3c8c3c15-79fa-8ee9-918b-ef8495d69cad	General-purpose data model such as tables or documents	t	\N	1
e389a2ba-eb8b-86ad-b41b-8a2880ecdf5c	3s480i6y5h113c4z4j	3c8c3c15-79fa-8ee9-918b-ef8495d69cad	Database engine's internal representation	t	\N	2
be74cae6-c9b1-8e9d-be7c-1ae822f3ecac	304t0u026o55724q6i	3c8c3c15-79fa-8ee9-918b-ef8495d69cad	Bytes represented through files, pages, and storage blocks	t	\N	3
5f70538c-aa0e-88a9-b5fd-fca4da0fe655	0q1v1w465e0n5j2r3s	55d15681-d4f1-8936-a6cc-10885b7446ae	шкарпетки	t	\N	0
b57e7aa0-1bce-813c-8b04-f1ad097bd03c	3t206j5k4r6o2q6i5f	ac4aa3b3-11c9-8125-aa74-261b5e56310e	It shapes how the application expresses relationships, queries data, and evolves	t	\N	0
c2e734bf-5de0-8a2d-b22e-d423a5945c79	2z6013326043325c2k	ac4aa3b3-11c9-8125-aa74-261b5e56310e	It determines only the formatting of user-interface colors	f	\N	1
9930ab89-65ca-86e3-bf58-289356293c55	2g4e4r1d456z2f3507	ac4aa3b3-11c9-8125-aa74-261b5e56310e	It guarantees scalability regardless of workload	f	\N	2
be18a93e-aaa7-8e1c-926d-742690a6e467	093n676j251g4e2c4g	ac4aa3b3-11c9-8125-aa74-261b5e56310e	It removes the need to understand access patterns	f	\N	3
96a2e408-d881-88b5-97a1-b6d674769f05	0m1u5w14210o5m735x	c1b61b3f-d9ea-87db-a256-3e5ab2686e53	tail -f app.log	t	\N	0
201c9cb2-83cb-8391-8147-2c55611e51dc	0d3e55572y533g0758	e6efc7ff-23ee-8457-8254-8d01416835a2	To keep `$VAR` and `$(...)` literal instead of expanding them	t	\N	0
c0770f89-a71b-8fc5-afdc-6f30d21baffb	2x0b4p256b1r3g701k	e6efc7ff-23ee-8457-8254-8d01416835a2	To append instead of overwrite	f	\N	1
f33e8eef-a0a7-8999-b176-fee432faa3a9	4x661f2m4d504x1q32	e6efc7ff-23ee-8457-8254-8d01416835a2	To strip leading spaces	f	\N	2
b65bdecd-d2d7-8238-97df-28c9f8518ab7	3v4z6z2t5v2l056o46	e6efc7ff-23ee-8457-8254-8d01416835a2	To send the block to stderr	f	\N	3
ee854976-36d7-83f8-b480-7b1c4eb7970d	1d3h0o25626l4y064d	485bea2b-95ad-8185-b0ea-48befaef18ad	футболка	t	\N	0
169bd899-cf8a-8729-8c38-c296b3a6e854	3d1c3q296j3u5r455g	485bea2b-95ad-8185-b0ea-48befaef18ad	футболку	t	\N	1
ee057cbb-066e-82d0-a4bc-b6dd28b974fa	4n2y472e551y0o2t1v	aac13011-f59d-84da-9dad-ea7fb7eebefb	худі	t	\N	0
ced6f923-9db8-8d16-9303-05aec4ee07b3	4m312d5v11420l2y2n	548ef5e9-2406-8ac4-98d8-99e497438a8a	trousers	t	\N	0
41e65bf1-4a79-8b46-b991-83f4a2991421	6a06261r1v541w2k1l	4f0f05b6-6bcc-8201-9b2b-4a5b5975b505	Run the `find` command without `-delete`	t	\N	0
dff08d28-17cc-8a44-a708-310a0af77a37	4b3q3p203r0q6m2548	4f0f05b6-6bcc-8201-9b2b-4a5b5975b505	Inspect the complete list of matches	t	\N	1
325d5b36-cac8-8b57-8149-297b759cb4eb	6o3e6o0p4h2s2l3456	4f0f05b6-6bcc-8201-9b2b-4a5b5975b505	Run the same command with `-delete` only if the list is correct	t	\N	2
8c4393b6-597e-8794-9eac-4b23f11d4d6f	41211w141b4w5z0v6w	94cec9f1-4846-84b1-9dc8-8d93efd417ad	вода	t	\N	0
08882b3f-a0f9-871a-9517-b9ace0d23d04	4m372e0b1y0u6s6u70	daa7f706-e343-8d89-969f-a2ef67eb4ac9	find	t	\N	0
bbfc167c-b4ee-8c5f-952e-9c26bbaa4baf	5y466o705s22576c1n	daa7f706-e343-8d89-969f-a2ef67eb4ac9	grep	f	\N	1
ad59babf-b135-8684-b7e4-4d33578f0bed	5t290f0n6e4q5w3d5l	daa7f706-e343-8d89-969f-a2ef67eb4ac9	wc	f	\N	2
3e01cbfe-1429-8aeb-a7d4-140bac0a63a1	2n44252f0p4h1o4q3n	daa7f706-e343-8d89-969f-a2ef67eb4ac9	tail	f	\N	3
79b6f783-de6a-8da5-b294-9bb2b43e6520	2s3v5z1y333w0i5w1r	c73ca850-0c62-8370-bb20-ff10b9ef8ed1	rm -rf old-folder	t	\N	0
d934f05a-2928-862c-8f28-473c1b3e24e1	2o1g01342q4x1w510a	c73ca850-0c62-8370-bb20-ff10b9ef8ed1	rm old-folder	f	\N	1
8005af4f-061f-8b7a-948d-39a25e63f876	1m1n052q113f2a4g63	c73ca850-0c62-8370-bb20-ff10b9ef8ed1	rmdir -f old-folder	f	\N	2
b9c753ba-54ff-8e5a-9af2-2305d7907301	25664j534u6q4k6r0y	c73ca850-0c62-8370-bb20-ff10b9ef8ed1	touch -rf old-folder	f	\N	3
518cff09-f1ad-8446-b387-c9fee03679a3	31281y4s4x4h425z1t	feadd348-a8d7-84f7-9e20-d9849b3d4157	Clear monitoring and visibility into runtime behavior	t	\N	0
cef0bc79-346c-8cca-9835-db1ffb326a99	23540467311w08681c	feadd348-a8d7-84f7-9e20-d9849b3d4157	Predictable automation for routine tasks	t	\N	1
c1796b33-ae66-8aea-a51a-7cfcb02dbb17	2p3t705y5x5c500o3b	feadd348-a8d7-84f7-9e20-d9849b3d4157	Good documentation and understandable operational behavior	t	\N	2
832ebeb3-1f12-8bc1-bf44-4674ebb4ecf6	0j3j586r2e2q1y0f4s	feadd348-a8d7-84f7-9e20-d9849b3d4157	Requiring manual inspection of every machine for basic diagnosis	f	\N	3
ede92eb7-f1d9-85af-87c1-e102b353476d	1n3z4i4g5y7001323q	d787de3a-98bd-8d5b-be33-fa8c801a8e46	It describes which elements should have which visual properties without scripting the traversal procedure	t	\N	0
9a9addc3-c2f6-8321-b65f-069c93976681	4l4m266j2o0v3y2g5z	d787de3a-98bd-8d5b-be33-fa8c801a8e46	It requires code to loop over every DOM node manually	f	\N	1
dd909ca1-afb0-8cff-a982-3e24e03c688a	3l4i4b3r0f1d5v5p44	d787de3a-98bd-8d5b-be33-fa8c801a8e46	It controls how database pages are stored on disk	f	\N	2
5cfa1a3a-3b64-8159-968f-6831b09b4240	0b0q5o140y440z290h	d787de3a-98bd-8d5b-be33-fa8c801a8e46	It cannot react when matching elements change	f	\N	3
e8e8ecc4-8fea-8754-9da2-8af23ef3d4c5	2q5f0e6o1o5u4n685o	9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	lsof -ti :3000	t	\N	0
b9854d81-3538-8016-9563-56ceafaad6b0	3s6y410p3c5h096a3l	9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	lsof -Pn :3000	f	\N	1
2f16f89e-8e01-85a9-8332-24a24f6884f1	4g630u5p0m5b1k044n	9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	ss -t :3000	f	\N	2
a6726538-0428-86d6-a194-89362983a178	0l5v580q4s0y232j1i	9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	pgrep -i :3000	f	\N	3
93423719-6cc9-8f16-99f4-ededdb480b6c	3o3o2p4k0a2e6k1l6p	b1c92baf-3029-894e-bfd3-332d5d4c79df	socks	t	\N	0
17ab3c58-84b7-8db1-bed4-54b9296c5b9b	353e2a6k5a5y5i2j12	8b7978e3-2ade-893a-ba36-e7497326659c	lsof -i :3000	t	\N	0
d333c5c7-cf5f-8d61-aca4-19211ffa4bd1	45502b5j3z4f1m566v	8b7978e3-2ade-893a-ba36-e7497326659c	lsof -i:3000	t	\N	1
e55afe07-121d-8f2b-a7be-502d8c1a453e	0r58290g1c21330068	eb365fc9-8ea7-8f18-b591-43a21df9fa29	штани	t	\N	0
77cbd3a0-af1c-876c-8266-078397991108	2y581m645j0g24264i	bd1b441b-be06-815e-a8ef-438fa70764ad	VACUUM INTO	t	\N	0
e5c7b203-f6b4-8924-9d03-b88c6274c523	0r4j700z0k342w2p5r	bd1b441b-be06-815e-a8ef-438fa70764ad	SQLite backup API	t	\N	1
f3369271-1fb2-8938-a776-d9dc72a7e97c	4m494f3i1c340e2220	bd1b441b-be06-815e-a8ef-438fa70764ad	cp quiz.sqlite backup.sqlite	f	\N	2
a96a6fea-1d78-8f02-be0b-66fda527b4a5	5q6d0t4u582e6r5a00	1789be8f-08a0-8c7d-ad5a-ca56c5070b12	>>	t	\N	0
a443ff23-b065-8106-b477-daa65181a57f	3t3e2d1t2y2t3j2v38	1789be8f-08a0-8c7d-ad5a-ca56c5070b12	>	f	\N	1
32d79272-38fa-89d7-8ac3-6e2f6c758ee5	2m6t6g2y4a0c1y3r61	1789be8f-08a0-8c7d-ad5a-ca56c5070b12	<	f	\N	2
a4bf3e39-a41f-891c-a4a7-793f6fa42371	713k3z0l3a4716543r	1789be8f-08a0-8c7d-ad5a-ca56c5070b12	|	f	\N	3
90a44d42-76fe-8b08-8332-e461c33a322b	1q27523m2c3m5n125z	545a6838-e7bb-8e79-892a-8fb95d0a2ae1	капелюх	t	\N	0
a84dabc6-70b2-8adc-8163-ddcf67527efa	564b02554b5j0a5t2z	545a6838-e7bb-8e79-892a-8fb95d0a2ae1	капелюха	t	\N	1
da7d92f5-27c8-8d13-a77e-10f9f7f20b8c	704o583n0y03252h1g	2f3a6ad2-3e01-8532-aadd-18e0cffece86	-type f	t	p0	0
a0740336-348e-89c3-806e-73bd38a00bd1	4a026z3x5t3b344d1h	2f3a6ad2-3e01-8532-aadd-18e0cffece86	-type d	t	p1	1
6879722d-97c8-8ebc-b2c5-a7ad22a5fb95	5f3k4s4g0q172q4c10	2f3a6ad2-3e01-8532-aadd-18e0cffece86	-iname "*.md"	t	p2	2
adab0533-31e3-83bb-932d-702fdc42f92e	57296w4o5a2s3s050b	2f3a6ad2-3e01-8532-aadd-18e0cffece86	-path "pattern"	t	p3	3
412ed08d-f045-8575-8053-8c2916dc7049	46042l2t4j3o0r3z1z	2f3a6ad2-3e01-8532-aadd-18e0cffece86	Regular files only	t	p0	4
08c28188-7e1d-835f-9ea6-35df65747258	6f6o2y30020p691a0w	2f3a6ad2-3e01-8532-aadd-18e0cffece86	Directories only	t	p1	5
3dffdef8-6721-8dba-af87-c3e3228594cc	2d511f706210714u1d	2f3a6ad2-3e01-8532-aadd-18e0cffece86	Case-insensitive name match	t	p2	6
17f22a33-68d6-8ef5-8a2d-72c0a865c4b8	5h5t2y03365x5l1e6d	2f3a6ad2-3e01-8532-aadd-18e0cffece86	Match the complete path pattern	t	p3	7
bc3a9084-4fe6-810b-bf49-e5f0364a5a8b	1q513s585j1c1l6c16	95871f4e-3c26-8d26-88e6-572d96da602f	Operability	t	p0	0
71376969-3149-8208-936f-3d0fd6c1641c	2c4x6k4w5537253o6q	95871f4e-3c26-8d26-88e6-572d96da602f	Simplicity	t	p1	1
a889f60b-1dc6-885f-8c4a-350d4edaff8c	0x5d0c200i664o4s1d	95871f4e-3c26-8d26-88e6-572d96da602f	Evolvability	t	p2	2
a883cc35-bf01-8595-8b74-1a5b0ee26ad5	0y6r0w463y4h5q5x33	95871f4e-3c26-8d26-88e6-572d96da602f	Make it easy for operations teams to keep the system running	t	p0	3
fd1133ad-9c74-8584-b1c4-ec480f739fdc	0y180i103d5t2y343i	95871f4e-3c26-8d26-88e6-572d96da602f	Reduce accidental complexity so engineers can understand the system	t	p1	4
07ba13ab-4dab-8e75-940e-c91f4a20bd70	6l0x6u1w3e0g39191r	95871f4e-3c26-8d26-88e6-572d96da602f	Make future changes and adaptation easier	t	p2	5
88b10e26-8a94-83d2-9429-9e161fc73b8f	36216e4272412l6w2e	c2c200f0-4559-8d23-8883-8b5577a99c9e	t	t	p0	0
c737d8f8-68d2-89d9-8f4a-9392f81b5fdc	4c2e6z5g6b5f1z5x0q	c2c200f0-4559-8d23-8883-8b5577a99c9e	u	t	p1	1
0e6a0d17-b1fd-8a8e-bcfe-ded2fe494abb	1z216s2i5b5m6q3q0w	c2c200f0-4559-8d23-8883-8b5577a99c9e	l	t	p2	2
5a60add8-0849-8420-8f16-e4422f9a4f09	0w1x1x6d5y2h2j6t1r	c2c200f0-4559-8d23-8883-8b5577a99c9e	p	t	p3	3
65138bab-b976-8bc1-9f3c-96abb8a1fe38	3158414r5i3g6s2357	c2c200f0-4559-8d23-8883-8b5577a99c9e	n	t	p4	4
f13ff81d-5593-8d62-9318-2e3c2e72846f	5v4p6t3y124r2q5d5r	c2c200f0-4559-8d23-8883-8b5577a99c9e	TCP	t	p0	5
c081051c-b7aa-8e5c-8aac-c5f649f6ae4b	1s1a312f73183l0b5a	c2c200f0-4559-8d23-8883-8b5577a99c9e	UDP	t	p1	6
71282569-2e7b-8787-bc96-95ad130d65aa	4x6w655m3c4l1x4t23	c2c200f0-4559-8d23-8883-8b5577a99c9e	Listening sockets only	t	p2	7
f98951db-4bfe-8739-8f91-d535a7d5e227	4y63723d4524350b1y	c2c200f0-4559-8d23-8883-8b5577a99c9e	Show process	t	p3	8
18602d06-695a-8081-a6c4-4f20d0cb68ef	436d4g3b271v0s6i23	c2c200f0-4559-8d23-8883-8b5577a99c9e	Numeric addresses and ports	t	p4	9
4e201567-94c4-83b4-b419-c8d957ebc3b3	07121r42520i2p3264	9df3aa48-316d-8826-a0a4-9cd0cbad3bff	нижня білизна	t	\N	0
4ae56bec-68f4-8beb-be05-118fe36e3a3e	673e556m4a25153q0x	9df3aa48-316d-8826-a0a4-9cd0cbad3bff	нижню білизну	t	\N	1
b840fa2d-f04e-8498-95e1-5296e42a4ddf	210h3l5q432o1y6350	1a963fd5-5a70-890d-8500-a4076dddd161	Starts it as a background job	t	\N	0
b4f62c22-943b-867d-80ed-675610fd9ca8	4r6p3f1y2r6j59503u	1a963fd5-5a70-890d-8500-a4076dddd161	Redirects both output streams	f	\N	1
1de2e2d9-7dc1-8a63-9644-01ba0f9709d4	4s5663213i0s0t5m56	1a963fd5-5a70-890d-8500-a4076dddd161	Runs it as root	f	\N	2
96e8860a-b348-87a1-9466-31ecbe961ce1	2y384w0m1c1016370u	1a963fd5-5a70-890d-8500-a4076dddd161	Makes it survive logout automatically	f	\N	3
0c5704a6-3ecd-8dd9-a859-846445047e6d	344c4n225h566t3u2q	98200032-2db8-8e2d-b646-f885d9ca4259	find / -name "*.conf" 2> /dev/null	t	\N	0
4ee08e85-1ba8-896b-bef5-7a108a2eaa92	3d5s5b6w0m6q344f47	98200032-2db8-8e2d-b646-f885d9ca4259	find / -name "*.conf" > /dev/null	f	\N	1
bfcd2b48-0dc1-8bb0-83dd-6c4d6720a3c2	5t6j320w5t4b2e370r	98200032-2db8-8e2d-b646-f885d9ca4259	find / -name "*.conf" < /dev/null	f	\N	2
b13cddfc-3395-82ee-a8c1-1d4784901515	2x4p3m406g6j3y2d2s	98200032-2db8-8e2d-b646-f885d9ca4259	find / -name "*.conf" | /dev/null	f	\N	3
3f670f9f-a336-8fd9-ba21-b8b78aeea9c0	083b6i5o3z6e32065x	67493a3e-9e27-831e-b630-1b721eca7d41	sugar	t	\N	0
9dbc962a-5ee4-8c80-a8ea-b52db1abffa2	6c1s0e6h0y330s044x	9f22978d-d803-8181-a4d6-8e7ee9a5fc8a	шорти	t	\N	0
13060b39-4614-8a89-88b5-d5bd2578757f	1a5421022f6x0j1o1h	67abaf8f-f2e9-8b68-be07-f38808a09aa6	coat	t	\N	0
4c21f283-feef-8856-9eb0-32b8f1dd53cb	0w4s5p6m2c696m0i2u	54936afa-d480-8098-9fb1-bdd4b2595a41	Оптимізатор потрібно побудувати лише один раз — і всі застосунки, що використовують цю БД, отримають вигоду	t	\N	0
a3656173-991f-8f1b-8617-ff1991fa63f3	583y144z6m2p2p184d	54936afa-d480-8098-9fb1-bdd4b2595a41	Оптимізатор завжди знаходить абсолютно оптимальний план виконання	f	\N	1
e2df1453-b5e6-8119-84bd-deba3019aa18	1g005l5q5n5g0t0c0h	54936afa-d480-8098-9fb1-bdd4b2595a41	Оптимізатор дозволяє повністю відмовитися від індексів	f	\N	2
a38682a7-3a95-8f17-8425-dc54b14e158e	570n4q0z175v07286c	54936afa-d480-8098-9fb1-bdd4b2595a41	Оптимізатор швидше писати, ніж hand-coded access paths для конкретного запиту	f	\N	3
d5bd9ab1-14e3-8187-9648-c93ec0e6cd4c	31671g6h5v3v3h1e3h	01a2cbe4-f74d-88c9-a8a3-514b3ecf4f97	яйце	t	\N	0
22561f16-3ded-809b-abb5-b0b917ae11cb	2q131i565r6h3g3848	d9cf128e-ecea-8533-b85c-eab045522b9a	-n	t	p0	0
7129116b-56f1-8890-ad85-b182ab168a55	0h26263n4w2r4n1i0u	d9cf128e-ecea-8533-b85c-eab045522b9a	-i	t	p1	1
91a2da49-4fb9-86a5-a8c6-a9361db926a9	1h2m19494h3s3o2932	d9cf128e-ecea-8533-b85c-eab045522b9a	-r	t	p2	2
c34aa127-28e6-8f59-b401-5927390ecad7	1l5q2v4g3v6g3a555b	d9cf128e-ecea-8533-b85c-eab045522b9a	Do not overwrite an existing destination	t	p0	3
0ac86dc3-aed6-8e47-88ca-d151288fc6a0	2m4o0d0q560a6a2s0k	d9cf128e-ecea-8533-b85c-eab045522b9a	Prompt before overwriting	t	p1	4
731114b6-333c-8619-b0d0-abf5f3ad92a9	4d63685z0p434r3f0w	d9cf128e-ecea-8533-b85c-eab045522b9a	Copy directories recursively	t	p2	5
e8298490-630d-88d4-8e5f-edf4a8c0e959	540p324q6c0f3w5k1c	032e4bbc-d5df-83f7-af06-3636fe65a0a9	jacket	t	\N	0
dcb5448c-0d97-8e28-ba1f-9996c4903ba3	3c1r34333b4y2n181k	a6ad60b9-0b48-82bb-98ea-edc36fbf1756	SIGTERM	t	\N	0
a76f0279-2c1d-8526-8c1b-db06badcbf15	1b1s452a5a3c703h2y	a6ad60b9-0b48-82bb-98ea-edc36fbf1756	SIGKILL	f	\N	1
40bf4a17-ee0e-822d-acd5-0523a6fe978c	3i5d6w45056f1h1431	a6ad60b9-0b48-82bb-98ea-edc36fbf1756	SIGSTOP	f	\N	2
c559411a-3ee2-85ba-920b-455a391f3942	4z2u5n5l446t0j5m2g	a6ad60b9-0b48-82bb-98ea-edc36fbf1756	SIGHUP only	f	\N	3
14751318-f309-82a6-8d98-f0e8ed5f1882	0f1v4m6d2b471a0z4t	f31739e3-4257-8ee6-8fcc-377f3f275fa4	A need for very high write throughput or unusual scalability	t	\N	0
31b26924-ec8f-8fca-9aad-d4c4a39bca01	2w6e66023w6q5l4a0i	f31739e3-4257-8ee6-8fcc-377f3f275fa4	A data model better supported than by the relational model	t	\N	1
131c330f-bf6b-8383-bba7-35c115594023	0h6e3l0d430d6s275h	f31739e3-4257-8ee6-8fcc-377f3f275fa4	A desire for schema flexibility in a changing application	t	\N	2
01de88f3-a76f-8ccc-821f-cd6417539059	2y3m3o2d0t206p5731	f31739e3-4257-8ee6-8fcc-377f3f275fa4	The belief that relational databases are never useful	f	\N	3
e5baa4ab-2e9f-8d9a-96d3-a7317553d086	2n4d172r5d6f2b5j5n	b08dcd53-dc0a-8705-a742-6e4c50302aa5	ls exists.txt missing.txt > out.txt 2> err.txt	t	\N	0
2c220b23-90b7-8f03-931c-5d2fa1290a91	2g3m6e014s4g5z6x2z	b08dcd53-dc0a-8705-a742-6e4c50302aa5	ls exists.txt missing.txt 1> out.txt 2> err.txt	t	\N	1
8db006ac-826d-812c-8611-a79cadbe2238	61460r564k3i3j1e5i	9a68cdf4-4762-85b8-b981-b95361a814e3	Applications had to follow predefined paths, making new access patterns difficult	t	\N	0
807f7cba-0571-8c60-b429-40ae7d379643	5e2m300b1a431t465p	9a68cdf4-4762-85b8-b981-b95361a814e3	It could not store any relationships	f	\N	1
6824a2bf-f9c8-8e62-adf4-7a1b86c3e3fa	1t232p6s3541142v2f	9a68cdf4-4762-85b8-b981-b95361a814e3	It always returned every record in the database	f	\N	2
ab781074-4969-83bb-a789-dd3b7ab8447f	1l20022i3z6u0b0k1n	9a68cdf4-4762-85b8-b981-b95361a814e3	It supported only declarative SQL queries	f	\N	3
ef87bd79-3d98-8b05-b565-7019731c2c37	6k6b4h4g6s3i40375s	fef1cb06-7f6a-8698-a69a-6d9895bf82bf	cat -n notes.txt	t	\N	0
483311a4-2d26-88df-9ebc-d0d428c44fca	5n2t3d3z1u5k694y3i	fef1cb06-7f6a-8698-a69a-6d9895bf82bf	cat --number notes.txt	t	\N	1
2146c86d-bda5-8a71-baab-707992fddf26	6s4b2m085s3x1i0y43	f021f898-d2cc-887e-84be-dc02c320abd2	сніданок	t	\N	0
0b423f44-c612-85ad-95f5-b41fff1656e6	6j7023150f4352413y	f9c7d64f-a85d-85f7-b0b3-e73367bfad01	sandals	t	\N	0
0cc969db-9b26-8549-90df-f0354a087a95	2i5b3e1s3z0n5x0q3i	200dd31c-b6ea-8d44-a350-1c2daf328f30	вечеря	t	\N	0
a59c6938-0ebe-8d62-a982-a8d16f056c64	5a412d6s4a0n1w275y	a24b40d9-727d-81ed-98f1-b989e072a0a0	apple	t	\N	0
2ddfb9db-c62c-854f-abf1-48ef34cd9a58	523b2s47415y5x252v	4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	A declarative query language that lets the optimizer choose execution plans	t	\N	0
c1fbeab3-1a66-8d08-9b92-fa543323e9cf	3o6s30011r401x6420	4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	Hard-coded traversal paths embedded throughout application code	f	\N	1
e08a7092-7af0-8fa3-a98b-350cd8d15b5f	156z4r2w616t5g4z10	4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	Duplicating the entire dataset for every possible future query	f	\N	2
2fd59133-949a-800f-952a-7a132cc62ee0	1z1n6i1c19292z1x59	4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	Disabling the query optimizer	f	\N	3
a8ffb10d-d717-8844-88a8-3851f68785fe	0r4737095n5v6b4u3j	c8e05d70-730c-88b0-b577-84e9649571c5	MySQL — вона копіює всю таблицю при ALTER TABLE	t	\N	0
12abefcf-d83f-817e-8317-4c1f0d2dc50b	636x6b003x435u2o0h	c8e05d70-730c-88b0-b577-84e9649571c5	PostgreSQL — вона перебудовує всі індекси	f	\N	1
4b3ebf2f-e2ef-831f-8404-a403ab43773c	55134b2g5s0d0d484o	c8e05d70-730c-88b0-b577-84e9649571c5	Oracle — вона блокує таблицю на час транзакції	f	\N	2
df983449-c8fd-819c-ac6e-33aa8c6b1bf1	2s3b4e5j5i0r2u2u01	c8e05d70-730c-88b0-b577-84e9649571c5	SQL Server — він перевіряє всі foreign key constraints	f	\N	3
bda6c179-8c1c-8874-937d-808be46806fc	6e2o5930094306241u	34c6010a-6ae8-8633-9cf8-54e3d309e611	pocket	t	\N	0
c1ce353d-d22c-879f-9f02-f1364a0486bb	36314f630g3l6c3v1f	1c19d9ac-239b-8cc5-8059-d54271d9ba38	It has a defined way to cope as relevant load parameters increase	t	\N	0
bbf83978-5dd4-8519-99a8-ce9064aa64c5	0y390o0e1h38624x71	1c19d9ac-239b-8cc5-8059-d54271d9ba38	It is currently fast for one user	f	\N	1
291afe7d-cf27-8165-9e41-ffbc05a7bc08	3w1d625r0h5m22403y	1c19d9ac-239b-8cc5-8059-d54271d9ba38	It uses microservices	f	\N	2
9d83564b-1ba6-8361-86fa-edbd916cad35	322s3s115g663w0j10	1c19d9ac-239b-8cc5-8059-d54271d9ba38	It runs only on large servers	f	\N	3
14ea8200-1928-8821-96e3-c41ec9bf64e0	3t3e05490x0t144l6r	c4ccdb06-8158-8298-a9fe-33d186ee146e	True	t	\N	0
516bec1f-c870-8cc7-b845-36953535409e	3f0m5n115a2z1q0144	c4ccdb06-8158-8298-a9fe-33d186ee146e	False	f	\N	1
bbf36c80-f03c-83d2-8481-6c02b187dd47	0g1g6r0t4i17306f57	7612de5e-59eb-84a2-be24-cb050467375f	джинси	t	\N	0
49399125-02d4-823b-a3ab-9185979d827b	0a6v6r310702631e3i	68444d79-c6c7-80ad-b5d4-0daf97754e11	-P	t	p0	0
281df6d0-2d34-8aae-8e14-4bb2448c5979	1q01406w634n171k5e	68444d79-c6c7-80ad-b5d4-0daf97754e11	-n	t	p1	1
a9663eb2-871f-8e29-a3cd-4fd212153c2c	6x696e1n6l28374s2j	68444d79-c6c7-80ad-b5d4-0daf97754e11	-t	t	p2	2
95ad92d0-17bd-8bdc-a40c-049bc6c26474	025e634j6x255o5m16	68444d79-c6c7-80ad-b5d4-0daf97754e11	Keep port numbers numeric instead of service names	t	p0	3
ec76d121-c177-845d-8ff7-97dbcee61b6f	3z3e0b5q656g3w672w	68444d79-c6c7-80ad-b5d4-0daf97754e11	Do not resolve IP addresses to hostnames	t	p1	4
c8418673-b588-890c-9d45-2bda302707dc	3p4w0a5n442w1d3x4j	68444d79-c6c7-80ad-b5d4-0daf97754e11	Print PIDs only without headers	t	p2	5
c9cbd366-3568-8066-9af5-826ac250286b	1p6q3a2b2l2n3b1q4l	4e9568c2-787a-8d19-ba7c-5b0dc71a2c4f	du -sh * | sort -h	t	\N	0
b3593292-1e96-8dd5-a61d-82f5fc2e62d2	5u0b6b381k2b5p1q54	02c3c4b9-5132-8b3e-9114-c9f146ad4f63	potato	t	\N	0
048c9c82-4db2-8594-af46-9f90a2737ffa	0b485z0b5x595x1n3d	395daae3-c9e9-83a5-a290-fefc4ce1d0ba	shorts	t	\N	0
1ac3d6e5-715f-8631-a1a8-af350723e7cf	16356b1g193f555g0v	f4c17d81-0f88-8f70-86bf-f48e5ec04854	-l	t	p0	0
c2efda5d-6fbf-8a38-bb33-9c69724cd800	165j1o6z3n0f3r6j2k	f4c17d81-0f88-8f70-86bf-f48e5ec04854	-a	t	p1	1
db90dd14-d1c1-8418-807c-c29aa31f9192	2i3p1p6x0l19013662	f4c17d81-0f88-8f70-86bf-f48e5ec04854	-f	t	p2	2
9979d9c0-e5ae-806a-b4f6-de7b67b4b7ce	3c6g7124252d5a471a	f4c17d81-0f88-8f70-86bf-f48e5ec04854	PID plus process name	t	p0	3
a58eea9c-e6fd-83e6-bd80-2898667deeb5	260w350t55733p6x1s	f4c17d81-0f88-8f70-86bf-f48e5ec04854	PID plus full command line	t	p1	4
65474646-0e19-8cac-9626-9e11b50c2b16	3n2s4y5j6u6e5m2e44	f4c17d81-0f88-8f70-86bf-f48e5ec04854	Match against the full command line	t	p2	5
e725f029-5a0f-8af3-8a2e-080af5b2d1c9	282w514i3h0e6d1b6n	0d89095f-c9e2-8c78-b4a6-3c05a9e00d21	What	t	\N	0
63b5cb29-0d72-814b-bab4-a3df821f8a83	62105e3e3v1g514z6f	0d89095f-c9e2-8c78-b4a6-3c05a9e00d21	size	t	\N	1
ac70d976-cd10-86ba-b0df-8e11d2898c88	113h363j374w280f62	0d89095f-c9e2-8c78-b4a6-3c05a9e00d21	do	t	\N	2
e6f25478-611b-8639-a98e-345c1f60a001	0c5v0e6q416l056o2r	0d89095f-c9e2-8c78-b4a6-3c05a9e00d21	you	t	\N	3
1a9b3d3c-5c37-871e-9b08-805ba9df154c	5j4d6r0i016u2m5b68	0d89095f-c9e2-8c78-b4a6-3c05a9e00d21	need	t	\N	4
deaff2ca-4f05-8f86-a26b-ccea1e91f8a3	5b3x2u710z4t176t5l	a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	The ID provides a stable reference while the canonical name and other facts can be updated once	t	\N	0
a294af48-e146-859e-9461-6e26cdf91724	6t2i3t6b18651w2a2b	a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	IDs make all joins free	f	\N	1
0cf67a8e-d424-8af9-9ad7-1cfed3676e20	56596w64425i4l0t1d	a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	Text values cannot be stored in documents	f	\N	2
45fb1f4c-53c4-8d1b-840e-2be0236d7efc	1s0y0e003c2o686n3j	a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	IDs eliminate every form of duplication	f	\N	3
77b7f2eb-01b6-8d7c-a2e6-48e6e8bf1e49	4q1648163g4f1p0n16	e7678d2e-ded4-8dbc-ac4e-7a1c3bf4acb7	egg	t	\N	0
8418727b-4987-85ac-9899-70dab78cc60f	3f2319534d2l3a3w3g	79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	99% of requests finish in 800 ms or less, while about 1% take longer	t	\N	0
9d69dcb0-c8ab-84ac-8151-0a15b80221cb	102c4s3b021d0k474v	79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	Every request takes exactly 800 ms	f	\N	1
b7ac077a-561d-8c28-878a-98b7b106d0ff	5e5k1l4m3k3e5q626i	79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	The average request takes 800 ms	f	\N	2
514b4fa2-ca10-85b1-ac1c-61004d7eeda5	413c245v221f503r5z	79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	99% of requests take longer than 800 ms	f	\N	3
753ac514-9bdf-8e67-8b24-ea92ed8cf3d4	6c054o2k52245p2u6h	bf9f079f-f9ed-8ad0-86bf-d1c0e2aefc02	обід	t	\N	0
459b5b38-3da7-81ca-b5df-ded5e82b9521	2j1c701v6u084h4r2m	80e95d2a-436a-82b9-b270-a3336b065c3f	The process spent substantial time waiting for network, disk, or another external resource	t	\N	0
db0870ff-99fa-8c08-817c-345acf84e7aa	2a580k12254g3c1r2u	80e95d2a-436a-82b9-b270-a3336b065c3f	The process used only kernel CPU	f	\N	1
d6e25e00-7890-8a5d-9aed-05476ca69ba1	425j4u704j610t0n0i	80e95d2a-436a-82b9-b270-a3336b065c3f	The timer is necessarily broken	f	\N	2
c2bddd0b-ac96-8fb9-9ac1-e5c34f06898f	000o7304445l6t0o03	80e95d2a-436a-82b9-b270-a3336b065c3f	The process was killed immediately	f	\N	3
b98c2729-2cde-8cef-a534-1ed4f35e8a19	0j4q574l1d0v2v0s4h	658715ed-295b-84ab-9144-c532e6b4ee79	To prevent the shell from expanding the glob before `find` processes it	t	\N	0
b442ec64-6804-8d16-be4f-368e809171ea	5x6z5b292t3v1l3815	658715ed-295b-84ab-9144-c532e6b4ee79	To make matching case-insensitive	f	\N	1
2750adf5-ccf5-8ff0-b6a2-5258916b56da	0l6m5f2z4e1i102v5h	658715ed-295b-84ab-9144-c532e6b4ee79	To search hidden files	f	\N	2
eea1fd8e-5689-844f-a18e-92c0aba6a90a	67484y221g2c580x1v	658715ed-295b-84ab-9144-c532e6b4ee79	To turn the pattern into a regular expression	f	\N	3
5392814c-11da-8d66-9f56-20d3c08759fb	335r3f0i1c6v0d6u34	1c2f9159-83e6-89f6-9d03-67b85daf5d5b	кепка	t	\N	0
39aeb47b-1eb8-8ae1-a392-27fae45e1db6	0e6j6s001o6g5w0e5j	1c2f9159-83e6-89f6-9d03-67b85daf5d5b	кепку	t	\N	1
9cc47b19-0533-8e16-a5ef-99f189b384c6	3s5b5t302i0y6s456j	055d6b8a-b534-80c0-9e32-77a218ba2780	hoodie	t	\N	0
4b3f0bc0-faa6-839c-a157-5df7b8bfb0a5	1g0t076j0c3y6z211s	5bc6a038-78b1-8992-9015-010b5a096faf	сукня	t	\N	0
5abdefa0-6b26-8d30-b4c7-240e36f99240	2j321m4j4l21082z0v	5bc6a038-78b1-8992-9015-010b5a096faf	сукню	t	\N	1
29550e4e-d2a7-87f6-ba06-7630a54bb557	27440e2o1d6o6a3y49	ca01857e-ebd2-8cad-af43-7c9d5f2e1849	-E	t	\N	0
afa72213-6a0e-8d23-bc14-8506b691420e	2t3v2i32716z5b1o1n	ca01857e-ebd2-8cad-af43-7c9d5f2e1849	-e	f	\N	1
3bd50815-be9e-8c95-b993-a787ad872b93	0h3p0r6l6h623h0x38	ca01857e-ebd2-8cad-af43-7c9d5f2e1849	-r	f	\N	2
5d627d57-94e2-8669-97c8-bdfe7de37f9a	2l090v40576a171c6c	ca01857e-ebd2-8cad-af43-7c9d5f2e1849	-x	f	\N	3
d949a6a4-b08d-855a-9f1a-bdb902391251	41224v6z4u3v073e3b	34f29309-50df-8290-b944-03e027d0c59d	Define which load parameters will grow and what performance and reliability targets must still hold	t	\N	0
44bfeaa6-ca9b-829f-a2ec-83056a30ae84	6e5c412o1p516d1l28	34f29309-50df-8290-b944-03e027d0c59d	Immediately rewrite the application as microservices	f	\N	1
29f47ae6-1e08-85d1-86ea-5c2dde1c7ce6	4k182p6r2c2q6l1s06	34f29309-50df-8290-b944-03e027d0c59d	Buy the largest available server without measuring current behavior	f	\N	2
1cdd504e-2dbc-8638-9c65-c57257404944	4g64530i2x4l605h4s	34f29309-50df-8290-b944-03e027d0c59d	Remove monitoring to reduce runtime overhead	f	\N	3
5782b3d9-2d0a-8a7f-9199-8cab95e0644d	2q2f194n5b0h1b520c	52ba481c-097d-8cea-bb3f-9f43ed2b2be1	It is alone on its line	t	\N	0
8b7a0b4b-927d-8d16-b244-beea7f2eb254	6z25601y041p663m2p	52ba481c-097d-8cea-bb3f-9f43ed2b2be1	It starts at column zero	t	\N	1
964e7f45-c5ee-879c-917d-8629559a8d99	1630220h06200s4r4g	52ba481c-097d-8cea-bb3f-9f43ed2b2be1	It has no trailing spaces	t	\N	2
53012b9a-fb68-8cde-8093-8f28c2d2432e	61292x20703h4l296v	52ba481c-097d-8cea-bb3f-9f43ed2b2be1	It must always be the word EOF	f	\N	3
2627f3b5-3c9e-811e-8ae2-54b9190e6108	2z1e705q4o6c550a2q	d23670eb-5087-8357-9940-175b65829981	морква	t	\N	0
849c3da1-145d-841b-a0db-4c2e013f4492	211361540k1w1v6321	2bd04385-e605-8bf3-b2f1-e0a7c36cd766	When workload changes unpredictably and rapid capacity adjustment matters	t	\N	0
9014e1e7-fac3-8422-96ec-c28da0afdfcb	4u535r5a3g412v4n0s	2bd04385-e605-8bf3-b2f1-e0a7c36cd766	When load is stable and the system never needs additional capacity	f	\N	1
7dbb8749-27ea-8b3a-9644-c520a8e9f247	633y5a5d524q1i0b1d	2bd04385-e605-8bf3-b2f1-e0a7c36cd766	When operators do not measure resource usage	f	\N	2
da43073f-6e94-8486-94c7-379781574f03	713a4g5b4z00653l0z	2bd04385-e605-8bf3-b2f1-e0a7c36cd766	When correctness depends on using exactly one machine	f	\N	3
a01588f2-b1c8-8677-ac6b-62fc65bc95d8	0e1y0h0c2b3e0t0r2v	bf69aa1e-d263-882f-93ca-94634446955b	Suspended/frozen until resumed	t	\N	0
d6e08ccf-8942-88f7-8afc-43f008994c39	573d6m4v1m2u2r1h3e	bf69aa1e-d263-882f-93ca-94634446955b	Running normally in the background	f	\N	1
5f3274b1-d016-8325-8d0b-b2a385ddf46d	2m3r2s2o39112j6m0p	bf69aa1e-d263-882f-93ca-94634446955b	Terminated with SIGKILL	f	\N	2
945192ed-2a39-8e59-8bfa-dec7bd5c789d	0u5n6t1b0n12592p18	bf69aa1e-d263-882f-93ca-94634446955b	Detached and safe from logout	f	\N	3
03ee766f-13da-8648-831f-25957df21867	6k6i4n184t082i5070	27b0780a-72a9-898b-95b6-593afbb151f5	mkdir -p apps/api/src/new-module	t	\N	0
7574f30a-603d-835c-9b22-3c5e5919cc41	0m5v0i4j0w491f4t41	f769fe1c-d743-88a2-9add-f1cc3f94fe03	PID	t	\N	0
f75c110a-85b0-8f09-b8c8-2e55e1165513	4b285n435h0r4q426c	f769fe1c-d743-88a2-9add-f1cc3f94fe03	COMMAND	t	\N	1
9890fcce-79af-8c4d-96eb-1e5e385d34e0	0j0t06003u2j5y2926	f769fe1c-d743-88a2-9add-f1cc3f94fe03	Terminal color	f	\N	2
e6168fda-cd13-84e7-b442-fdbcdda425a2	0y4o3959364m4j1j4y	f769fe1c-d743-88a2-9add-f1cc3f94fe03	Filename extension	f	\N	3
6a43b12e-453d-8c71-acf3-3a946499be22	290w010670444g3i5h	43cb3fe3-b62c-8baf-b77c-28f9c1ad529e	рис	t	\N	0
8e8b6f02-d0c5-808b-89eb-319aa16a876d	1w2x2g5j386m226z67	d70b28a9-3b88-816a-b648-f7b6f382d310	Це був просто вдалий хештег у Twitter для мітапу про open source distributed non-relational бази даних у 2009 році	t	\N	0
a2354f6d-11fc-80db-bc86-5ef4618293e0	2r436s520o0p4j6a6d	d70b28a9-3b88-816a-b648-f7b6f382d310	Це офіційна назва стандарту, ухваленого консорціумом виробників БД	f	\N	1
042af93d-4d0b-8156-89a6-ac36a5fe6999	4n4p71160u592n4z38	d70b28a9-3b88-816a-b648-f7b6f382d310	Це абревіатура від «Non-Object Structured Query Language»	f	\N	2
22f7b32e-10e2-8bb6-b96b-699a8529d6b7	3r0d072w5f5k6x3251	d70b28a9-3b88-816a-b648-f7b6f382d310	Термін ввів Edgar Codd, критикуючи реалізації SQL	f	\N	3
83eacd4f-7042-8ec2-b72b-7b6752a848b7	310i4f2t1p646t4g0q	fd427a6d-34dc-88b4-b938-f00097aabda9	The rule continues to describe the desired state for all matching elements, including new ones	t	\N	0
a7e13163-be8b-8869-bc4f-f0c8e3c45dd5	4n633t5l2l686v1u4k	fd427a6d-34dc-88b4-b938-f00097aabda9	Imperative code cannot access the DOM	f	\N	1
b9e19702-f97a-8fd0-b39c-6cb42851d0b6	1i5g3m4p1i4c4z186x	fd427a6d-34dc-88b4-b938-f00097aabda9	Declarative rules run only once at application startup	f	\N	2
92d6828a-660b-8c55-a143-3bdacb6a1809	2r3m116d384i734z67	fd427a6d-34dc-88b4-b938-f00097aabda9	CSS permanently copies every element	f	\N	3
0f116e77-8659-85bb-912a-55ae51baf1b6	4o2o5f393m6c421644	40a40575-be0e-8573-af1a-ddd4b1862ce5	The request is increasingly likely to encounter at least one slow tail response	t	\N	0
49a82f50-4fa1-8bf3-9bc7-b33ced2c0a86	101g0e45390j5b3x5o	40a40575-be0e-8573-af1a-ddd4b1862ce5	Parallel calls force every backend to execute sequentially	f	\N	1
0102f4f8-0f57-82a5-92cf-9bc908242a5d	4p3n3s6g25433y304c	40a40575-be0e-8573-af1a-ddd4b1862ce5	Percentiles cannot be measured for parallel operations	f	\N	2
96aa7917-6ffa-8341-9ce1-b516e0631b3a	3q6x60522l3y4n430l	40a40575-be0e-8573-af1a-ddd4b1862ce5	Network latency disappears when calls are parallel	f	\N	3
991f41b4-878b-8654-8a8f-d9d6d31cadd1	6x131q5t712x3b6y6q	753283f9-0464-80a8-aaa4-cc70c15284ac	size	t	\N	0
a117b275-19f8-81c3-a9f9-99ebaaab00e7	3d3e5t17224n6q1n6n	be6554d4-f65c-811c-a2d7-0a66b186bc2c	orange	t	\N	0
5e3c0e49-766f-8511-858b-bce0ceaf6bde	221r2v164c41063k60	51fda0f9-705b-8cd9-8582-879256383a87	Trainers	t	\N	0
b10337f0-e7d6-8482-925c-dc382cc4be80	2b2u29171i190i3k2n	51fda0f9-705b-8cd9-8582-879256383a87	Scarf	f	\N	1
31135a0b-6306-8e6c-b0a7-6e4f50e8fdb0	6a4e485e723i3s154m	51fda0f9-705b-8cd9-8582-879256383a87	Tie	f	\N	2
8e7d22c4-1397-8373-8e89-91506788fd33	5w0h273y1c3y2h4l00	51fda0f9-705b-8cd9-8582-879256383a87	Skirt	f	\N	3
94b9104c-a524-87ec-bb71-749a09a13435	04114j09144c0i6z24	3d9c4cc6-2e85-886e-91c9-a135a8467c45	grep -w id file	t	\N	0
b0b01946-e7b0-8923-9450-7b5bbf6c8982	6n2n6h571a1s0w5k61	3d9c4cc6-2e85-886e-91c9-a135a8467c45	grep -i id file	f	\N	1
d578efa8-f6a8-8dc4-b0eb-4c06c2b6d23c	5c701e1u5c0o73610q	3d9c4cc6-2e85-886e-91c9-a135a8467c45	grep -v id file	f	\N	2
cd20ba9c-4cf1-8716-b1ff-b9f3ae6078c5	6s4x3b0i5v17641648	3d9c4cc6-2e85-886e-91c9-a135a8467c45	grep -l id file	f	\N	3
443f340d-12d1-8bd6-9b07-d54c2fc55219	0x4c4f6b6m2r512621	0ba44dfc-8221-8888-ba76-ac30a34ca3a1	The destination directory	t	\N	0
3f8f3bae-0aef-87ff-a123-83fcd8495238	0w2t2y4y2b500y0o6v	0ba44dfc-8221-8888-ba76-ac30a34ca3a1	The first source	f	\N	1
78a111f4-932d-8cc1-89b0-93c57a9b1a61	0o5p4q125b3e2r144l	0ba44dfc-8221-8888-ba76-ac30a34ca3a1	An overwrite flag	f	\N	2
0cdd0771-8670-8f7d-86ef-02d14ef716fa	5y6r6i463o2c6c4x25	0ba44dfc-8221-8888-ba76-ac30a34ca3a1	A filename pattern	f	\N	3
b1d2008f-edcc-8e12-9aa9-2f64eb0059f1	6i3e3u4d0q676v2340	60b4995a-c666-8a54-bae4-ea04723842b7	tomato	t	\N	0
bafc5a16-f3bd-8a4c-b977-0f3a9fd0c972	266q626f1b38044538	f756a3a4-7e7c-819b-9012-d56c63291d97	форма	t	\N	0
8d378301-83bf-86d8-89d2-44f3f4e353d3	0k3r1b516c62153h3i	f756a3a4-7e7c-819b-9012-d56c63291d97	форму	t	\N	1
8e4cd432-62ce-8599-81d6-6f23daa915a5	4j1l0f396a565h0s4t	833020c1-5468-88f3-a31c-f81a99229fe4	сіль	t	\N	0
49f19436-17d9-8e40-ab17-1be12fb0831b	40694z0i0b0s6l0d51	d815296e-fc38-82e9-afe6-cdb07814ca9d	Boots	t	\N	0
1a65934a-2e89-8278-8dbf-47af893fcf4f	1o0q1s1h6e1a5p0d5s	d815296e-fc38-82e9-afe6-cdb07814ca9d	Sandals	t	\N	1
918ff82e-e2ba-8128-8752-4e70827a9437	4k241y1n3n4a0a006h	d815296e-fc38-82e9-afe6-cdb07814ca9d	Trainers	t	\N	2
e65e61a4-6c1b-8013-9c52-81342627a862	24705m0g4k3s0c7303	d815296e-fc38-82e9-afe6-cdb07814ca9d	Blouse	f	\N	3
d4186e74-b9d3-8aec-923e-1fa636f960a8	2o31562m0d0d581811	d815296e-fc38-82e9-afe6-cdb07814ca9d	Scarf	f	\N	4
f0f49a49-caf7-8b9d-baec-eb2f6e1174c3	34300t6c5f305s1o5i	a8efb48a-b05e-8768-b3fd-bcfbdb9ed074	картопля	t	\N	0
50fef9bf-586e-8bc5-958d-cef1755e26ab	362v0z0o3e6p3p633v	b1c50d75-21db-84cd-beea-8cd9c9b679f4	tie	t	\N	0
76449d89-748e-8839-aaea-89900d826561	27061g2t2w126j1q0k	226ce076-a057-8ef8-a48e-0669ad379701	man ls	t	\N	0
5826f572-3e86-807e-8b74-1d79f7efc2cf	1z0a1z642p3e1o4257	226ce076-a057-8ef8-a48e-0669ad379701	help --ls	f	\N	1
2f14faf5-f948-83f5-b0ce-aba72b7bb3e4	585u530x2q0z182251	226ce076-a057-8ef8-a48e-0669ad379701	docs ls	f	\N	2
878ab4c7-2da3-8ced-874d-b1569e0bbc0f	646v5u6o102s364a3p	226ce076-a057-8ef8-a48e-0669ad379701	ls -manual	f	\N	3
dc83ac4b-db9f-8d5a-99a0-afb852a2c385	2i3u04071x5f0k0d45	c7e7d4d9-1faa-888a-8614-f4e329ef6f16	macOS: `sed -i '' 's/a/b/'`; Linux: `sed -i 's/a/b/'`	t	\N	0
72450c81-0c3a-823c-bfb8-79f17eca2bec	016q0m0z5m3i064w3f	c7e7d4d9-1faa-888a-8614-f4e329ef6f16	macOS: `sed -i 's/a/b/'`; Linux: `sed -i '' 's/a/b/'`	f	\N	1
51abfd83-0efe-892c-9fba-a3abefbc95c0	0s4a005o4j5x241c0z	c7e7d4d9-1faa-888a-8614-f4e329ef6f16	Both always require `sed -i ''`	f	\N	2
a7b0e939-69ae-810c-a321-002466333f62	0d5t343v004w450f5m	c7e7d4d9-1faa-888a-8614-f4e329ef6f16	Neither supports in-place editing	f	\N	3
ee20d960-e15a-8d6c-971d-9d9a6cf2f4b5	4j122e2c022e2g1d6o	290c3db5-299b-8d89-8151-1d9abc8584d7	-t ts	t	p0	0
835c6813-3d96-8c56-9be3-7b202190f7e8	6x176y1c5r3h3s6r5l	290c3db5-299b-8d89-8151-1d9abc8584d7	-T ts	t	p1	1
73c4e82f-e2ee-8bd0-a234-a386e78c8046	4t3d434h4l6o400e1g	290c3db5-299b-8d89-8151-1d9abc8584d7	--hidden	t	p2	2
57d013f9-255c-86d2-9f05-31855724fe12	402r1g1u066302356h	290c3db5-299b-8d89-8151-1d9abc8584d7	-u	t	p3	3
a42c5973-87f2-8a8a-8b9e-809f9199882f	282v1s2n633n4x4i45	290c3db5-299b-8d89-8151-1d9abc8584d7	Search only TypeScript files	t	p0	4
dd5c5f68-1e1c-8012-bdd2-4b9fd915d823	3j3q366j6h3g3s6i70	290c3db5-299b-8d89-8151-1d9abc8584d7	Exclude TypeScript files	t	p1	5
557f8d8c-1211-826c-af26-6bd6fa23309b	3n5e625u2p2a6w2x56	290c3db5-299b-8d89-8151-1d9abc8584d7	Include hidden files	t	p2	6
0934bf28-c1aa-8caa-97d8-a28af09dd471	1058491b3u5t373y63	290c3db5-299b-8d89-8151-1d9abc8584d7	Do not respect ignore rules	t	p3	7
3b26a331-81f1-8086-852c-8d9dfa33d83d	0r1q6614304x0a5p1x	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	real	t	p0	0
28c03011-b2aa-8627-9ba3-26516ad3f6b9	1i1s1c2b4n381w6o2e	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	user	t	p1	1
06115b26-0c93-87b6-93cf-831e8cbc4a5b	2v161f663p5u6x0u2d	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	sys	t	p2	2
e08ef516-6ba1-8475-b24c-daf49ba3641d	3a2y0x0b1501436h0i	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	Elapsed wall-clock time	t	p0	3
c6914eff-21fc-86ea-9eaa-b0707b47508f	24155k302g4o4u2z20	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	CPU time spent in user space	t	p1	4
bf487a12-5d9c-8d27-acd2-e0f2fc5d3a7b	0r4p1p533u1r4z233w	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	CPU time spent in the kernel	t	p2	5
9cb10af6-a10a-8085-a1c8-34ee7b2b9e3e	6l6l1p2s4b3e0r5a4z	d753cdd4-4d6e-8b96-b924-b979f66ec8c6	Photos uploaded per day and average photo size	t	\N	0
d92aa4a4-1611-87fa-ae62-ee7d6bd47985	1l173c5z6n0w6z0r4m	d753cdd4-4d6e-8b96-b924-b979f66ec8c6	Number of classes in the backend codebase	f	\N	1
20e2537f-4a98-816c-97ec-beda807abca8	0b6w2g3q373q6c0r31	d753cdd4-4d6e-8b96-b924-b979f66ec8c6	Number of colors in the user interface	f	\N	2
84be1dbb-e7c3-828d-8aa7-d2e047501a9a	3x6x533i0u4u6b3j1w	d753cdd4-4d6e-8b96-b924-b979f66ec8c6	Programming language used by the API	f	\N	3
8a117bfe-94fa-8c92-900f-aa887c851a98	6s4o3e6g24576b6g3n	f14b8c4d-1afc-8adc-9006-308318e0e258	риба	t	\N	0
6169c4b7-c2b7-889f-b2c2-feb4a9f25523	002t5h526k6j513i2m	868f6f7d-37cc-88f0-8d60-3c3651525291	It continues to perform its intended function correctly despite expected faults	t	\N	0
d1416144-1969-8604-82cd-b92d87513ec4	422e320y2f5s0g6s6m	868f6f7d-37cc-88f0-8d60-3c3651525291	It never experiences any fault	f	\N	1
3938257c-f25c-8521-a210-87baf1c77a86	6j1u462p4q3a3i2i1g	868f6f7d-37cc-88f0-8d60-3c3651525291	It always returns a response within one millisecond	f	\N	2
4d7ddc8a-f1f2-836c-bd26-f74260ad5b6e	2z4i6k2i3r0c1r3m2q	868f6f7d-37cc-88f0-8d60-3c3651525291	It stores all data on one highly reliable machine	f	\N	3
43f59a63-e3f0-844f-a8b5-fe82fa47d650	6z0q572c5c3a3z0l4g	6732320d-e771-86b1-8afb-292069131611	breakfast	t	\N	0
b20ed70b-5940-8173-9527-5587ffafb438	4m6e6u45482g4n055e	ade4481c-3395-88fe-8c4b-63449a28a2e2	чоботи	t	\N	0
7a090580-facc-8659-afd5-ed0ea7e577c0	3a062y2g01436z2c50	d65cfb4c-062a-8450-bba8-ccb846fe76a1	Design interfaces and abstractions that make incorrect actions difficult	t	\N	0
21cb788a-e4d5-8cc7-b71b-29e057829b42	246666371915615y0e	d65cfb4c-062a-8450-bba8-ccb846fe76a1	Provide safe testing, staging, rollback, and recovery mechanisms	t	\N	1
7c215a90-c71d-8228-ab22-ecfeae1327ba	4e5c730x5c2w3g3r5p	d65cfb4c-062a-8450-bba8-ccb846fe76a1	Add monitoring that exposes unexpected behavior	t	\N	2
3d631109-dd6e-8df0-ac20-bcaac494e964	2w41490o510d2x2a2i	d65cfb4c-062a-8450-bba8-ccb846fe76a1	Depend entirely on operators never making mistakes	f	\N	3
fd7f8e0a-edb6-878c-8b85-eb836e971e7e	5g4860434c580g5z22	9f1784c8-79a9-8412-ac89-aa73c30edb4b	rice	t	\N	0
8816c2b9-7f55-8ad3-b5fc-d7485d14b919	016v6e4m2b5z0i4k6y	20010d78-12a6-8783-bc7f-386366215af6	The query optimizer can choose access paths without application code specifying them	t	\N	0
d6b91fb6-d49f-8739-9f14-65b953d6f746	6q48126f571b5h1g45	20010d78-12a6-8783-bc7f-386366215af6	All related data must be physically adjacent	f	\N	1
d1fe1bb3-de0b-8161-ba79-c777a0bda07b	6m726l4g29666y4u0v	20010d78-12a6-8783-bc7f-386366215af6	Relationships cannot change after insertion	f	\N	2
fffd32e8-8ccc-81dc-a6f6-fe84ed43e2e6	2y4k2n6r6v3w223r60	20010d78-12a6-8783-bc7f-386366215af6	Every query must scan every row	f	\N	3
d9bcb016-4173-8fbb-9297-dc6818f0c9ba	4z261u03515p6g042y	81e06311-a749-8c85-b477-4c2c213c0db5	cat -A file.txt	t	\N	0
e2b0f341-5893-82f0-a8b3-ec3255579276	4b1f21101j0v2b4m4a	81e06311-a749-8c85-b477-4c2c213c0db5	cat -n file.txt	f	\N	1
886f3aec-ff92-8a56-9cae-9497dc090e97	6i6p0y1g1m2d2b1o3b	81e06311-a749-8c85-b477-4c2c213c0db5	less -N file.txt	f	\N	2
1a66f642-0459-887f-89ee-97cf14397947	325o4q052o596l6v6w	81e06311-a749-8c85-b477-4c2c213c0db5	touch file.txt	f	\N	3
61890825-3570-8daa-9ab7-76fb7c329fe6	5x4j3642416q1x1h0b	70200632-c1de-8d49-babd-170d2b896826	mkdir -p packages/nodes/src/{http,webhook}	t	\N	0
ae3a353b-1015-87cb-85b0-a213b5b5a1c9	4c4m2e0u5u593s4i6m	70200632-c1de-8d49-babd-170d2b896826	mkdir -p 'packages/nodes/src/'{http,webhook}	t	\N	1
70a8795b-5f5b-8ccb-82ea-64dc9f201775	323g1d2l3m015c5a1c	cfecff05-f00f-8178-97d7-27b450543d93	-mtime -1	t	p0	0
f847657d-4e63-854a-994e-150743612f67	3t2s5q65365m2c574l	cfecff05-f00f-8178-97d7-27b450543d93	-mtime 7	t	p1	1
63ab5027-deb4-86dd-a117-c303341d8d02	111o2v6b5s4s1g0923	cfecff05-f00f-8178-97d7-27b450543d93	-mtime +30	t	p2	2
3da46c85-5720-83e7-a2b0-42fc7f447975	556c23035j23006a71	cfecff05-f00f-8178-97d7-27b450543d93	Modified within the last day	t	p0	3
2aa96cc4-7186-8b0c-8da9-f91452988b49	0l3n3q4m4y113v343e	cfecff05-f00f-8178-97d7-27b450543d93	Modified in the seven-day age bucket	t	p1	4
16d1870a-05dd-8553-9f60-5c3ed674220c	0y6q3f2l1c1s3z1s57	cfecff05-f00f-8178-97d7-27b450543d93	Not modified for more than 30 days	t	p2	5
fe7290ee-5578-80e0-aa80-6fb8bedd7842	4q2224685k230u0y07	ee897593-a4d0-8de2-af3b-3ca065d53e26	pgrep -af "dist/main"	t	\N	0
2045a492-e368-83a9-a892-b6e12404638b	0m0m0e2x3z262f670o	ee897593-a4d0-8de2-af3b-3ca065d53e26	pgrep -af 'dist/main'	t	\N	1
5fc96068-b08b-8284-b5da-e3ce001a46fd	1e6a3b3g562g1n434k	ee897593-a4d0-8de2-af3b-3ca065d53e26	pgrep -af dist/main	t	\N	2
128b84b2-4639-86de-9dc5-d6c0d49e6f81	3f1s6b4f6s3i0x4l59	ee897593-a4d0-8de2-af3b-3ca065d53e26	pgrep -fa "dist/main"	t	\N	3
90c269e3-90ba-8fb6-8b91-ed49eee5cdbb	69393s6d090z6v5u38	ee897593-a4d0-8de2-af3b-3ca065d53e26	pgrep -fa dist/main	t	\N	4
237b79b7-54d6-8766-9744-ee923d69fb73	635q6y0p26654h4q1y	cbfaadb9-096a-85ab-be35-18eda4a5a71b	dress	t	\N	0
\.


--
-- Data for Name: question_sources; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.question_sources (question_id, term_pair_id, direction) FROM stdin;
485bea2b-95ad-8185-b0ea-48befaef18ad	c170a1a5-8ca3-86e8-870f-ad1097ef45b1	term_to_translation
b04204c8-0b9a-88c9-be26-dfd354d6356c	c170a1a5-8ca3-86e8-870f-ad1097ef45b1	translation_to_term
66f82326-e5d0-8cc5-82c2-90718f8bb2e9	6666c300-07d7-8616-ad29-9bdf7069b144	term_to_translation
6327f423-a733-83c6-85a9-ab12704b7dac	6666c300-07d7-8616-ad29-9bdf7069b144	translation_to_term
bf4dd249-d14f-8ef6-b1f1-8bb423fb3cae	ae789aff-e7f8-846f-8f43-d27cec8588e9	term_to_translation
c9c7ecfc-de70-8235-be89-074147fc8ee3	ae789aff-e7f8-846f-8f43-d27cec8588e9	translation_to_term
9b6c4c20-4de2-8a6c-92f6-b4ee3cf5127b	8bf19ea5-f65f-873d-89f1-5fc8a006b9db	term_to_translation
d539ffb3-1414-83d4-a888-392bacfe9a04	8bf19ea5-f65f-873d-89f1-5fc8a006b9db	translation_to_term
aac13011-f59d-84da-9dad-ea7fb7eebefb	2368188f-d472-8ee2-ae22-3a58351522fe	term_to_translation
055d6b8a-b534-80c0-9e32-77a218ba2780	2368188f-d472-8ee2-ae22-3a58351522fe	translation_to_term
240ed98f-7280-8081-ac83-966292f63e5d	305a393f-6885-8cea-a68c-7c5185c1a386	term_to_translation
032e4bbc-d5df-83f7-af06-3636fe65a0a9	305a393f-6885-8cea-a68c-7c5185c1a386	translation_to_term
59c2e542-6697-808a-a453-7f1676149810	7df0e550-4ad4-8077-8082-87ecf8dab967	term_to_translation
67abaf8f-f2e9-8b68-be07-f38808a09aa6	7df0e550-4ad4-8077-8082-87ecf8dab967	translation_to_term
5bc6a038-78b1-8992-9015-010b5a096faf	1a1f1b17-eb8e-8ebf-91ba-08bec0ccf5b7	term_to_translation
cbfaadb9-096a-85ab-be35-18eda4a5a71b	1a1f1b17-eb8e-8ebf-91ba-08bec0ccf5b7	translation_to_term
2668d303-4413-86de-beee-702a7d54082c	7045cd00-0195-8600-afd1-1829d4d49278	term_to_translation
cd2591b3-5949-87e4-964e-7191a7d9fbc8	7045cd00-0195-8600-afd1-1829d4d49278	translation_to_term
7612de5e-59eb-84a2-be24-cb050467375f	c15907c7-24e5-8718-910a-448b36255345	term_to_translation
d20f81f7-9fe1-88dd-b241-ba1cacfe14b1	c15907c7-24e5-8718-910a-448b36255345	translation_to_term
eb365fc9-8ea7-8f18-b591-43a21df9fa29	d9a4ac37-609f-8123-9594-5a6d94155a05	term_to_translation
548ef5e9-2406-8ac4-98d8-99e497438a8a	d9a4ac37-609f-8123-9594-5a6d94155a05	translation_to_term
9f22978d-d803-8181-a4d6-8e7ee9a5fc8a	c86112a4-b92b-8ba2-8faf-293352cc3d50	term_to_translation
395daae3-c9e9-83a5-a290-fefc4ce1d0ba	c86112a4-b92b-8ba2-8faf-293352cc3d50	translation_to_term
03048403-511c-85ec-86e4-378e9117b5db	6a37787e-0731-8261-9e81-ca280aaec738	term_to_translation
02beb82d-dc1a-8e99-b768-07f887ce32f4	6a37787e-0731-8261-9e81-ca280aaec738	translation_to_term
f756a3a4-7e7c-819b-9012-d56c63291d97	247597eb-e779-857a-bc43-d7bd1d47a9ad	term_to_translation
df7a1652-262f-8e8e-9ca7-2df2829c7a28	247597eb-e779-857a-bc43-d7bd1d47a9ad	translation_to_term
cc0b7b72-e745-887e-907d-b0785c13a508	188ca045-083f-8a31-84a4-d16736885160	term_to_translation
7ce6ccec-a9c4-8401-a325-18f4317acbff	188ca045-083f-8a31-84a4-d16736885160	translation_to_term
9df3aa48-316d-8826-a0a4-9cd0cbad3bff	132edc7b-0e31-8675-a15c-d8b6e53c9cd0	term_to_translation
8112f2b1-c5b7-8cdd-aa6f-a2b4d48358b7	132edc7b-0e31-8675-a15c-d8b6e53c9cd0	translation_to_term
55d15681-d4f1-8936-a6cc-10885b7446ae	94455320-b001-8b2e-9d70-8b7d003b9eb9	term_to_translation
b1c92baf-3029-894e-bfd3-332d5d4c79df	94455320-b001-8b2e-9d70-8b7d003b9eb9	translation_to_term
9a18a4db-0dbb-8e43-b47f-f5560016dedb	2647184a-5388-8f3a-9a38-68a1c8f0a466	term_to_translation
3881cb10-a5a8-8552-bb99-342a39c5ee75	2647184a-5388-8f3a-9a38-68a1c8f0a466	translation_to_term
c2fa4fd5-de53-8ade-87e8-781b4ddb67c2	3aaf2743-6236-85a5-8bf6-29f9321e2ad3	term_to_translation
efd58ea6-1580-8545-b4a4-17ff92fbdf46	3aaf2743-6236-85a5-8bf6-29f9321e2ad3	translation_to_term
ade4481c-3395-88fe-8c4b-63449a28a2e2	329e7ae0-0101-8bd1-a6b2-825e3c1b7f24	term_to_translation
ce78c61c-aa9b-8ae0-9a4f-881a3c1b5f91	329e7ae0-0101-8bd1-a6b2-825e3c1b7f24	translation_to_term
8b566ae7-fd72-826e-a495-10de8d99e348	25783aa9-16ee-8089-ae9a-ec640e62461c	term_to_translation
f9c7d64f-a85d-85f7-b0b3-e73367bfad01	25783aa9-16ee-8089-ae9a-ec640e62461c	translation_to_term
545a6838-e7bb-8e79-892a-8fb95d0a2ae1	e18951e8-ece8-8bbb-9f7f-6a8ea3f28bda	term_to_translation
dd00a0fa-d4cf-81e3-8405-0bb23cb61d67	e18951e8-ece8-8bbb-9f7f-6a8ea3f28bda	translation_to_term
1c2f9159-83e6-89f6-9d03-67b85daf5d5b	0477edc4-d6a1-89ae-9794-bcda7ba73ff4	term_to_translation
a2a1e4d4-5e56-88a1-a94e-cdcd86aebec6	0477edc4-d6a1-89ae-9794-bcda7ba73ff4	translation_to_term
ab87fbf3-6331-8bef-a903-f673df12aa0b	26c7b3f6-e5d2-8161-85e4-34d0729351e3	term_to_translation
d22aa0a3-1baf-842d-8db8-4a2bfbb86bc1	26c7b3f6-e5d2-8161-85e4-34d0729351e3	translation_to_term
f1ea73ab-6036-8a5c-8eee-b2d75e91b74b	23e18b8e-0650-84b8-97c0-3bf5e5ef9b56	term_to_translation
8184535d-6c50-812b-975e-f6a5c5a336c2	23e18b8e-0650-84b8-97c0-3bf5e5ef9b56	translation_to_term
4620b24e-e9c3-8ab1-a2e0-83dd222381fb	626e069b-6d07-8076-b765-8a354cb37ae0	term_to_translation
e71a9f81-33d7-851f-81d4-caf732ca0723	626e069b-6d07-8076-b765-8a354cb37ae0	translation_to_term
b7fa0752-b2b6-8caf-8dfb-fa53806a3a10	6f048ec5-d0fa-822e-9dd8-667756eb35b6	term_to_translation
b1c50d75-21db-84cd-beea-8cd9c9b679f4	6f048ec5-d0fa-822e-9dd8-667756eb35b6	translation_to_term
5df93fa2-3d18-82ef-a24e-f6b780945d6a	49ca713d-3f25-89c4-bd63-e57767d7e207	term_to_translation
9bf90618-9cff-8bf9-a04a-d7069086ec32	49ca713d-3f25-89c4-bd63-e57767d7e207	translation_to_term
725a8b84-0a4d-80d9-9dce-b885f56a676c	77fda670-b5e3-8928-95ad-c0d809cd3d32	term_to_translation
34c6010a-6ae8-8633-9cf8-54e3d309e611	77fda670-b5e3-8928-95ad-c0d809cd3d32	translation_to_term
02cdf03d-9f2c-8ce4-8662-10289e1887c0	97c83bea-a6b5-882d-9647-34ce1dad622f	term_to_translation
3c8437d0-01fe-8296-b103-0d88203c29f4	97c83bea-a6b5-882d-9647-34ce1dad622f	translation_to_term
0fbc89c1-f1de-8cd0-abaf-a6881c401929	2b06d5cf-ee62-85a1-a1da-5891318d4c64	term_to_translation
0776f85d-da36-88ba-86ba-d7a1aeb9229b	2b06d5cf-ee62-85a1-a1da-5891318d4c64	translation_to_term
f4fccf84-7594-8ab7-ad24-959184667926	aff388ff-259f-8033-bc1a-33f8a199b68c	term_to_translation
753283f9-0464-80a8-aaa4-cc70c15284ac	aff388ff-259f-8033-bc1a-33f8a199b68c	translation_to_term
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.questions (id, legacy_id, quiz_id, type, prompt, explanation, source_reference, topic, difficulty, hint, "position", fingerprint, created_at, updated_at, deleted_at) FROM stdin;
818c6acd-d71c-884f-b789-200afa196196	2e2q5l3v3m2m4z1x4p	b1177332-3109-8cdb-ab5e-942bf9c85ef7	single_choice	Що означає WAL у SQLite?	Write-ahead log: зміни спершу пишуться в окремий журнал, а вже потім переносяться у файл бази.	\N	SQLite	easy	\N	0	61q7x4b25jlz	2026-08-24 10:43:06.008505+00	2026-08-24 10:43:06.008505+00	\N
cd281ab2-0b80-8059-ac87-cca56165b018	4d2b5x6j6b3o204d0e	b1177332-3109-8cdb-ab5e-942bf9c85ef7	true_false	У WAL-режимі кілька читачів можуть працювати одночасно з писачем.	Так — саме тому WAL і вмикають: читачі бачать останній консистентний знімок і не блокують писача.	\N	SQLite	medium	\N	1	1y21yzx2mi2d0	2026-08-24 10:43:06.009952+00	2026-08-24 10:43:06.009952+00	\N
bd1b441b-be06-815e-a8ef-438fa70764ad	594v526k0f1m1b3l3i	b1177332-3109-8cdb-ab5e-942bf9c85ef7	multiple_choice	Які з цих кроків роблять backup SQLite консистентним?	VACUUM INTO і backup API читають у транзакції. Проста копія файлу може лишити останні записи у -wal.	\N	Операції	hard	\N	2	1n0ekq3rng8ox	2026-08-24 10:43:06.011038+00	2026-08-24 10:43:06.011038+00	\N
3c8c3c15-79fa-8ee9-918b-ef8495d69cad	4x541x68581c3g2p5l	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	ordering	Order these representations from the application's highest-level objects down to physical storage.	Applications are built in layers: each data model hides lower-level complexity while providing concepts useful to the layer above.	Chapter 2 — Data Models and Query Languages	Layers of data models	easy	\N	0	3al5ej5avl3cg	2026-08-24 10:43:06.012214+00	2026-08-24 10:43:06.012214+00	\N
ac4aa3b3-11c9-8125-aa74-261b5e56310e	4x6d4o5n4o5u5f3h6w	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	Why is choosing a data model an important architectural decision?	Data models strongly affect how developers think about the problem and what operations are easy or difficult.	Chapter 2 — Data Models and Query Languages	Choosing a data model	medium	\N	1	2wl4345affvct	2026-08-24 10:43:06.013254+00	2026-08-24 10:43:06.013254+00	\N
89e593ff-4696-8e64-8c9d-5d386aa2b437	4h6q0u2f6y2x6m3m0f	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A résumé profile is normally loaded and updated as one self-contained object with nested positions and education entries. Which model is a natural fit?	Tree-shaped, self-contained data that is usually accessed together maps naturally to a document, reducing object-relational impedance mismatch.	Chapter 2 — Relational Model Versus Document Model	Document model	medium	\N	2	25leuo15xil7o	2026-08-24 10:43:06.014236+00	2026-08-24 10:43:06.014236+00	\N
eeb52fd5-522c-80dc-a4f7-c2a83b44421c	110b2j6t3g44230q5f	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	What is the object-relational mismatch?	Application objects and relational tables structure data differently, often requiring mapping code or an ORM.	Chapter 2 — The Object-Relational Mismatch	Object-relational mismatch	easy	\N	3	16hsmewa8z5g1	2026-08-24 10:43:06.015133+00	2026-08-24 10:43:06.015133+00	\N
f31739e3-4257-8ee6-8fcc-377f3f275fa4	5m0s175f455f2y3n0n	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	multiple_choice	Which are meaningful reasons teams may choose a non-relational database? Select all that apply.	NoSQL systems arose from varied needs, including scalability, specialized data models, and flexibility—not because relational databases are universally obsolete.	Chapter 2 — The Birth of NoSQL	NoSQL motivations	medium	\N	4	uxpyeq13qu1p	2026-08-24 10:43:06.016113+00	2026-08-24 10:43:06.016113+00	\N
79220895-4e55-8f69-8ba0-5faad9e97f12	3b1s1s6h223e626c31	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	What is a key performance advantage of storing related one-to-many data in one document?	When data is usually accessed together, document locality can avoid multiple lookups. The advantage depends on access patterns and document size.	Chapter 2 — Relational Versus Document Databases Today	Document locality	medium	\N	5	3gakz6r4uvng1	2026-08-24 10:43:06.017023+00	2026-08-24 10:43:06.017023+00	\N
9a211a19-8d92-825c-819d-f45f08b1dbb0	1l0c2l6j3f2j1o432i	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	An application stores an author's name inside thousands of article documents. The author changes their name. What problem does this design create?	Duplicating shared data improves locality in some reads but creates consistency and update work when the shared value changes.	Chapter 2 — Many-to-One and Many-to-Many Relationships	Document limitations	hard	\N	6	22vixsziczgnl	2026-08-24 10:43:06.017986+00	2026-08-24 10:43:06.017986+00	\N
a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	605s733m3u0332671y	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	Why might an application store a region ID rather than the text “Greater Seattle Area” directly in every user profile?	Using stable identifiers avoids repeated, inconsistent meanings and supports standardized names, localization, hierarchy, and later changes.	Chapter 2 — Many-to-One and Many-to-Many Relationships	Normalization	medium	\N	7	1iam2haid2d6b	2026-08-24 10:43:06.01895+00	2026-08-24 10:43:06.01895+00	\N
5f318fff-368e-85d2-9fc5-59f8efa0d6dd	092o6y4m1i344n1v35	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	multiple_choice	A recruiting platform must connect people to many companies, schools, and skills, while each company, school, or skill connects to many people. What does this imply? Select all that apply.	Many-to-many relationships form a web of references rather than one self-contained tree, increasing the value of joins or explicit relationship handling.	Chapter 2 — Many-to-One and Many-to-Many Relationships	Many-to-many relationships	hard	\N	8	8ti9q9nliwfc	2026-08-24 10:43:06.02021+00	2026-08-24 10:43:06.02021+00	\N
2834179a-ca26-8275-92a3-b05000ccb4b1	2u5z2b0a2f2g4c4z1f	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A profile system begins with free-text organization names but later needs organization pages, shared attributes, and links between employees. What architectural pressure appears?	As requirements become more interconnected, data often moves from denormalized values toward references and relationships.	Chapter 2 — Many-to-One and Many-to-Many Relationships	Data model evolution	hard	\N	9	2y77q77f4g55t	2026-08-24 10:43:06.021171+00	2026-08-24 10:43:06.021171+00	\N
9a68cdf4-4762-85b8-b981-b95361a814e3	5n4v0j5h1n0o4j6s4i	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	What was a major limitation of the historical network model's access paths?	The network model exposed explicit access paths. Queries not anticipated by the schema designer could require difficult traversal and application changes.	Chapter 2 — Are Document Databases Repeating History?	Network model	medium	\N	10	a7ouksy3559a	2026-08-24 10:43:06.022289+00	2026-08-24 10:43:06.022289+00	\N
20010d78-12a6-8783-bc7f-386366215af6	6x1w191b2d3g6d0407	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	What key advantage did the relational model provide over path-oriented navigation?	Relational queries describe desired results, allowing the optimizer to decide how to execute them and adapt as indexes and statistics change.	Chapter 2 — The Relational Model	Relational model	medium	\N	11	1kdz63f2zbbwn	2026-08-24 10:43:06.023273+00	2026-08-24 10:43:06.023273+00	\N
e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	1n1d6p411g102k1q53	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	Which statement best describes schema-on-read in document databases?	Schema-on-read provides flexibility, but application code still assumes structures and may need to handle multiple versions.	Chapter 2 — Schema Flexibility in the Document Model	Schema flexibility	medium	\N	12	32s3ia4795qou	2026-08-24 10:43:06.024268+00	2026-08-24 10:43:06.024268+00	\N
98d2f28b-b220-8068-9755-1eae8ff052d2	464g1r70090y240q3w	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A new optional field is added to user profiles, and old records do not contain it. Which approach best reflects safe schema evolution?	Backward-compatible readers can interpret old and new records while data is gradually rewritten or left in mixed versions.	Chapter 2 — Schema Flexibility in the Document Model	Schema evolution	hard	\N	13	2wjv7oo9zs6hx	2026-08-24 10:43:06.02524+00	2026-08-24 10:43:06.02524+00	\N
d65cfb4c-062a-8450-bba8-ccb846fe76a1	6w5t056m6u1a1l153b	399d7d59-7f36-8c81-b878-ffd73a0c830b	multiple_choice	Which practices reduce the impact of human error in production? Select all that apply.	Reliable systems assume people will sometimes make mistakes and reduce both the probability and the consequences of those mistakes.	Chapter 1 — Human Errors	Human errors	medium	\N	6	wft6t5xheigz	2026-08-24 10:43:06.044312+00	2026-08-24 10:43:06.044312+00	\N
3c637446-91c1-8984-9563-80c1bcd8f0b3	1a4i2y5y5e246p633g	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A very large customer document is read in full whenever only one small field is needed, and every update rewrites much of it. What conclusion follows?	Locality helps when the application needs most of a document at once. Large documents with independent access and update patterns can make locality expensive.	Chapter 2 — Data Locality for Queries	Document locality	hard	\N	14	w6uiocndvrw2	2026-08-24 10:43:06.026197+00	2026-08-24 10:43:06.026197+00	\N
22cd375b-1acf-8360-ba2a-26e3b4f1c529	1x1e2c4g0x246l6x1p	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A billing system has highly interconnected customers, invoices, payments, adjustments, and audit queries that combine them in many ways. Which model is generally the stronger starting point?	Highly interconnected data and varied query patterns favor references and joins. A document model is strongest when data is mostly self-contained.	Chapter 2 — Relational Versus Document Databases Today	Choosing a data model	hard	\N	15	1adq9iwdm91yz	2026-08-24 10:43:06.027326+00	2026-08-24 10:43:06.027326+00	\N
a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	0q5y560w560s5y6w6v	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	Why is the choice between relational and document databases not always absolute?	The models have been converging, so the important question is which system best supports the application's particular relationships, queries, and guarantees.	Chapter 2 — Relational Versus Document Databases Today	Model convergence	medium	\N	16	9dbo71t9c9vw	2026-08-24 10:43:06.028301+00	2026-08-24 10:43:06.028301+00	\N
ee939949-2555-851e-9674-f27bebab1af0	1f4h334q515a3l1x3g	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	What is the main distinction between declarative and imperative queries?	Declarative languages hide execution details, while imperative code specifies the algorithm or traversal explicitly.	Chapter 2 — Query Languages for Data	Query languages	easy	\N	17	ntlfnbfw60uc	2026-08-24 10:43:06.029224+00	2026-08-24 10:43:06.029224+00	\N
2cfa8251-a04b-8e69-a160-89bf1b78e622	4i1d5l0732161y0w40	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	multiple_choice	What practical advantages can a declarative query language provide? Select all that apply.	Declarative queries separate intent from execution, enabling optimization and implementation changes, but they cannot guarantee efficiency without suitable data design.	Chapter 2 — Query Languages for Data	Declarative queries	medium	\N	18	1ul4eoa95buat	2026-08-24 10:43:06.030254+00	2026-08-24 10:43:06.030254+00	\N
5dd4bdfd-e18d-87ff-9f05-9c3447893b49	3h4s5a6r2q290z6a1o	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A database administrator adds a new index. Existing SQL queries become faster without application changes. Which property made this possible?	Because the query does not mandate a fixed access path, the optimizer can take advantage of a new index transparently.	Chapter 2 — Query Languages for Data	Declarative queries	hard	\N	19	1p1130hbyq32d	2026-08-24 10:43:06.031192+00	2026-08-24 10:43:06.031192+00	\N
d787de3a-98bd-8d5b-be33-fa8c801a8e46	57021q2b3i020q1m10	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	Why is CSS a useful example of a declarative language?	A CSS rule declares the desired result for matching elements; the browser determines how to find and update them.	Chapter 2 — Declarative Queries on the Web	Declarative queries on the web	medium	\N	20	4iy33grpl08p	2026-08-24 10:43:06.032338+00	2026-08-24 10:43:06.032338+00	\N
fd427a6d-34dc-88b4-b938-f00097aabda9	6g606n0p4462260f1e	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A page continuously receives new matching elements. Why can a declarative style rule be easier to maintain than a one-time imperative DOM update?	Declarative rules remain true descriptions of the desired result, whereas imperative code may need to detect and update each change explicitly.	Chapter 2 — Declarative Queries on the Web	Declarative systems	hard	\N	21	6rictrr1dny9	2026-08-24 10:43:06.033399+00	2026-08-24 10:43:06.033399+00	\N
10b59ad5-03cb-86fc-a265-9ceb0a087bd0	3w0a5k4t52193t320j	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	How is MapReduce querying positioned between fully declarative queries and general imperative code?	MapReduce exposes map and reduce functions but retains framework control over partitioning, scheduling, retries, and aggregation.	Chapter 2 — MapReduce Querying	MapReduce querying	medium	\N	22	3qei6mqcae9ys	2026-08-24 10:43:06.034433+00	2026-08-24 10:43:06.034433+00	\N
cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	4v2a4i13533h074i3u	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	multiple_choice	Why should map and reduce functions used for database querying avoid side effects? Select all that apply.	Distributed execution may retry, reorder, or move tasks. Pure functions make such execution safer and deterministic.	Chapter 2 — MapReduce Querying	MapReduce functions	hard	\N	23	3nyja94dplbvf	2026-08-24 10:43:06.035537+00	2026-08-24 10:43:06.035537+00	\N
4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	5q2z6g3q475g280w18	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	single_choice	A team needs frequent ad hoc queries whose access paths will change as new indexes are added. Which approach is generally preferable?	Declarative queries preserve flexibility because execution strategies can change independently of application code.	Chapter 2 — Query Languages for Data	Choosing query approaches	hard	\N	24	2eiryk71f0uc	2026-08-24 10:43:06.036501+00	2026-08-24 10:43:06.036501+00	\N
e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	2m4g0j3150220r1v1b	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	ordering	Put these steps for selecting a data model in a sensible order.	A database model should follow the application's relationships and access patterns, then be validated against real workloads and change requirements.	Chapter 2 — Relational Versus Document Databases Today	Data model selection	hard	\N	25	28ostc0of3b8w	2026-08-24 10:43:06.037578+00	2026-08-24 10:43:06.037578+00	\N
6f9b6517-a5d3-8721-bef9-ff23a3809351	0b5x0o60294h1r472r	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	What primarily makes an application data-intensive rather than compute-intensive?	A data-intensive application is mainly constrained by handling data—its volume, complexity, or change rate—rather than by raw CPU work.	Chapter 1 — Thinking About Data Systems	Data-intensive systems	easy	\N	0	2trx77o3d8ue1	2026-08-24 10:43:06.038627+00	2026-08-24 10:43:06.038627+00	\N
517567ba-4265-8ef8-849a-6a3c7890eeea	2n5b163f2o6x2v6t4p	399d7d59-7f36-8c81-b878-ffd73a0c830b	matching	Match each component to the job it is primarily used for.	Modern applications combine specialized components; understanding their roles is more useful than treating one database as the entire data system.	Chapter 1 — Thinking About Data Systems	Data system components	easy	\N	1	7vk4rzza90ra	2026-08-24 10:43:06.039613+00	2026-08-24 10:43:06.039613+00	\N
868f6f7d-37cc-88f0-8d60-3c3651525291	6w0s4g4e2l1a24145q	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	Which statement best defines a reliable system?	Reliability is fault tolerance within a defined set of expected faults, not the impossible promise that nothing will ever go wrong.	Chapter 1 — Reliability	Reliability	easy	\N	2	11x3xn2fdafk2	2026-08-24 10:43:06.040511+00	2026-08-24 10:43:06.040511+00	\N
800e98ae-c6b5-824b-826c-c8cffe76ff57	0w3y6e381y1u475k3w	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	A disk fails, but replication allows the service to continue correctly. Which interpretation is accurate?	A fault is a component deviating from its specification; a failure is the system as a whole failing to provide the required service.	Chapter 1 — Hardware Faults	Reliability	medium	\N	3	2utg16uzoyyg2	2026-08-24 10:43:06.041425+00	2026-08-24 10:43:06.041425+00	\N
788c11ea-b800-8c85-ab83-0df2e4f3923c	141a4x65685t4v0254	399d7d59-7f36-8c81-b878-ffd73a0c830b	multiple_choice	Which measures help a service tolerate hardware faults? Select all that apply.	Redundancy and failover allow service to continue when individual components fail. Reliability cannot depend on hardware being infallible.	Chapter 1 — Hardware Faults	Hardware faults	medium	\N	4	1gqd9pnhdrivh	2026-08-24 10:43:06.042287+00	2026-08-24 10:43:06.042287+00	\N
8b76ee55-c231-8734-8e63-384a82f24116	0p2w1n03462g1k1o5g	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	Why can software faults be more dangerous than a single hardware failure?	Replicas often run the same software, so a shared bug or bad assumption can cause correlated failures across the system.	Chapter 1 — Software Errors	Software faults	medium	\N	5	22uvsf8n23cc9	2026-08-24 10:43:06.043324+00	2026-08-24 10:43:06.043324+00	\N
1c19d9ac-239b-8cc5-8059-d54271d9ba38	5s3927084s6b6t0u60	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	What does it mean to say that a system is scalable?	Scalability is not a binary label; it describes how a system responds when specific dimensions of load grow.	Chapter 1 — Scalability	Scalability	easy	\N	7	3cxbxpmggkres	2026-08-24 10:43:06.045277+00	2026-08-24 10:43:06.045277+00	\N
d753cdd4-4d6e-8b96-b924-b979f66ec8c6	6v4e675w6c14132w01	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	You are designing a photo-sharing service. Which is the most useful load parameter for evaluating storage growth?	Useful load parameters describe the work imposed on the system, such as request rate, read/write ratio, data size, or concurrent users.	Chapter 1 — Describing Load	Load parameters	medium	\N	8	3542ktp6vzvon	2026-08-24 10:43:06.046336+00	2026-08-24 10:43:06.046336+00	\N
bd2c9751-98b0-88f7-9223-f29721376a9e	0r6k4c2p6u6j2d3a4m	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	A social feed has many ordinary users and a few accounts with millions of followers. Which design best addresses this highly skewed workload?	Extreme outliers can dominate system cost. A hybrid approach can handle common cases efficiently while treating high-fan-out accounts specially.	Chapter 1 — Describing Load	Scalability	hard	\N	9	2vdzdchpjby5e	2026-08-24 10:43:06.047361+00	2026-08-24 10:43:06.047361+00	\N
1714869f-9ff5-8137-a14b-a99a945cf514	0b0q60664y1o1y6q1v	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	What is the difference between service time and response time?	Users observe response time, which includes the time actually processing the request and additional delays such as queueing.	Chapter 1 — Describing Performance	Performance	easy	\N	10	2qh2vnp1n9am1	2026-08-24 10:43:06.048336+00	2026-08-24 10:43:06.048336+00	\N
77866774-fb69-8499-8aa7-f8530ca764dc	1d2o4e2y5b5r535r58	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	Why is the arithmetic mean often insufficient for reporting request latency?	Latency distributions are commonly skewed. Percentiles reveal how slow the service is for a specified fraction of requests.	Chapter 1 — Describing Performance	Performance percentiles	medium	\N	11	28bvydjs2t6g1	2026-08-24 10:43:06.049233+00	2026-08-24 10:43:06.049233+00	\N
79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	613o421g6y12343i2u	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	A service has a p99 response time of 800 ms. What does that mean?	The p99 is the latency threshold at or below which 99% of observed requests complete.	Chapter 1 — Describing Performance	Performance percentiles	medium	\N	12	cqurijuls14e	2026-08-24 10:43:06.050109+00	2026-08-24 10:43:06.050109+00	\N
40a40575-be0e-8573-af1a-ddd4b1862ce5	6h3h1w6m66485z0u5k	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	One user request calls ten backend services in parallel and cannot finish until all return. Why can overall latency be poor even when each service is usually fast?	Fan-out amplifies tail latency: the more dependencies a request waits for, the more likely one of them is unusually slow.	Chapter 1 — Describing Performance	Tail latency	hard	\N	13	32jxhhbwilc4o	2026-08-24 10:43:06.051079+00	2026-08-24 10:43:06.051079+00	\N
680c9336-42f1-84fe-b056-2611e0450aa5	0q13413s2x0h0l6w2e	399d7d59-7f36-8c81-b878-ffd73a0c830b	multiple_choice	An API meets its median latency target but violates p99 during peak traffic. Which conclusions are justified? Select all that apply.	High percentiles expose overload, queueing, expensive requests, and other problems that a median can conceal.	Chapter 1 — Describing Performance	Performance testing	hard	\N	14	3j1oyf4zw6e5s	2026-08-24 10:43:06.051976+00	2026-08-24 10:43:06.051976+00	\N
ba03a02e-7bcf-8475-952a-7c760012c37e	4750024x456z4g3m1n	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	A database workload has outgrown one machine, and no affordable larger machine can meet the requirement. What general change is necessary?	When vertical scaling reaches practical or economic limits, load must be distributed horizontally, accepting additional distributed-system complexity.	Chapter 1 — Approaches for Coping with Load	Scaling approaches	medium	\N	15	2s146ww61j96r	2026-08-24 10:43:06.052876+00	2026-08-24 10:43:06.052876+00	\N
2bd04385-e605-8bf3-b2f1-e0a7c36cd766	6a046w17250l216k4x	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	When is automatic elastic scaling most valuable?	Elastic systems can add or remove resources as load changes, which is especially useful for unpredictable workloads, though operational simplicity may favor manual scaling in stable cases.	Chapter 1 — Approaches for Coping with Load	Elasticity	medium	\N	16	t3kbd4h9dhpj	2026-08-24 10:43:06.053887+00	2026-08-24 10:43:06.053887+00	\N
95871f4e-3c26-8d26-88e6-572d96da602f	5b3q57254s196v6m38	399d7d59-7f36-8c81-b878-ffd73a0c830b	matching	Match each maintainability goal to its practical meaning.	Maintainability is framed through operability, simplicity, and evolvability.	Chapter 1 — Maintainability	Maintainability	easy	\N	17	1hq7yh20xgovm	2026-08-24 10:43:06.054785+00	2026-08-24 10:43:06.054785+00	\N
feadd348-a8d7-84f7-9e20-d9849b3d4157	553d4d0o4k3348311q	399d7d59-7f36-8c81-b878-ffd73a0c830b	multiple_choice	Which capabilities improve a system's operability? Select all that apply.	Operable systems expose useful information, support automation, behave predictably, and give operators appropriate control.	Chapter 1 — Operability	Operability	medium	\N	18	33nosnlm36y4l	2026-08-24 10:43:06.055702+00	2026-08-24 10:43:06.055702+00	\N
468da566-061c-8d59-9974-55c09e8215bb	4u713y3f0j705s0l61	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	In maintainable software, what does simplicity primarily mean?	Simplicity is about managing complexity, not merely minimizing code or infrastructure counts. Good abstractions hide unnecessary detail.	Chapter 1 — Simplicity	Simplicity	medium	\N	19	1qwksjjfz9vum	2026-08-24 10:43:06.056707+00	2026-08-24 10:43:06.056707+00	\N
86557979-9c3c-8f79-80cb-329e36c5e99e	4h2i3t1i313g6p453m	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	A team expects business rules and traffic patterns to change repeatedly. Which architectural property is most directly valuable?	Evolvability allows systems to accommodate changing requirements, technologies, and circumstances over time.	Chapter 1 — Evolvability	Evolvability	hard	\N	20	cfaget0wqs1	2026-08-24 10:43:06.05762+00	2026-08-24 10:43:06.05762+00	\N
deeeb039-35df-854d-a816-601d7386c7ce	2t2m3f2v4p1m2d2q1q	399d7d59-7f36-8c81-b878-ffd73a0c830b	ordering	Put these steps for reasoning about scalability in a sensible order.	Scalability decisions should begin with a precise description of load and performance goals before selecting an architecture.	Chapter 1 — Scalability	Scalability analysis	medium	\N	21	64ic4uldifva	2026-08-24 10:43:06.05874+00	2026-08-24 10:43:06.05874+00	\N
34f29309-50df-8290-b944-03e027d0c59d	64035z5n3i25722x6l	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	Traffic is predicted to grow tenfold. What is the best first step before redesigning the architecture?	A sound scalability discussion requires quantified load parameters and required outcomes. Architecture follows from those constraints.	Chapter 1 — Scalability	System design	hard	\N	22	3ecuuiypjryu	2026-08-24 10:43:06.059914+00	2026-08-24 10:43:06.059914+00	\N
15535a2d-826e-8205-a33b-41f47925d22e	3c686d5w720w235q1y	399d7d59-7f36-8c81-b878-ffd73a0c830b	multiple_choice	A service must remain available during routine machine failures. Which design choices are appropriate? Select all that apply.	Redundancy only improves reliability when failures are detected and recovery mechanisms are tested and operational.	Chapter 1 — Reliability	Reliability trade-offs	hard	\N	23	dmvncbr342rr	2026-08-24 10:43:06.060873+00	2026-08-24 10:43:06.060873+00	\N
01ffa53b-2875-8d4c-95f5-da4c04c89f9e	2t3j4r5o3r356y3s63	399d7d59-7f36-8c81-b878-ffd73a0c830b	single_choice	Why is there no single architecture that is automatically scalable for every application?	A design optimized for one workload may perform poorly for another. Scalable architecture is specific to the workload and required service guarantees.	Chapter 1 — Approaches for Coping with Load	Design trade-offs	hard	\N	24	2mqu179zzgbw5	2026-08-24 10:43:06.06183+00	2026-08-24 10:43:06.06183+00	\N
5691bb7c-8592-8999-a296-143809294193	3g28504871211q3f4w	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which command recursively searches the current directory for `TODO`, ignoring case and showing line numbers?	`-r` recurses, `-n` shows line numbers, and `-i` ignores case.	\N	grep	easy	\N	0	12nfdgiw2b5xk	2026-08-24 10:43:06.062782+00	2026-08-24 10:43:06.062782+00	\N
c37c9ae4-666f-801c-892d-16efaf60a66d	126402063j6f6y0l09	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match each `grep` option to its effect.	\N	\N	grep	easy	\N	1	38cqi5bnz2g9i	2026-08-24 10:43:06.063672+00	2026-08-24 10:43:06.063672+00	\N
3d9c4cc6-2e85-886e-91c9-a135a8467c45	6k294d2w6n136k0b35	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	You need `id` as a complete word and must not match `uuid` or `valid`. Which option helps?	`-w` restricts matches to whole words.	\N	grep	medium	\N	2	14h7iqs0fdev	2026-08-24 10:43:06.064559+00	2026-08-24 10:43:06.064559+00	\N
ca01857e-ebd2-8cad-af43-7c9d5f2e1849	635w0o721g3m0u460y	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which option enables extended regular-expression operators such as `|`, `+`, and `?` without basic-regex escaping?	\N	\N	grep	medium	\N	3	9uzbqyy61a3k	2026-08-24 10:43:06.065547+00	2026-08-24 10:43:06.065547+00	\N
e43bbddf-419b-8165-bf19-3e8654f82eaf	262s391o1o03316r2k	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match the context option to the lines it includes around a match.	\N	\N	grep	medium	\N	4	3m9p58515bepq	2026-08-24 10:43:06.066455+00	2026-08-24 10:43:06.066455+00	\N
7f738a26-77d8-802c-a087-d96d3083c5d3	2b0c2l442r3v6e0547	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	In a monorepo, which command recursively searches only `.tsx` files while excluding `node_modules`?	\N	\N	grep	hard	\N	5	13lzapmeosnmh	2026-08-24 10:43:06.067572+00	2026-08-24 10:43:06.067572+00	\N
65789a15-ec78-8505-82ea-f4df69754a07	37425r0644721u0y3q	8d50a017-1da9-8de5-bf68-ffcbebad128f	typed_answer	Write the compact command that recursively finds `todo` or `fixme`, case-insensitively, with line numbers in the current directory.	The flags provide recursion, line numbers, case-insensitivity, and extended regex.	\N	grep	medium	\N	6	tjlijuysm07s	2026-08-24 10:43:06.068598+00	2026-08-24 10:43:06.068598+00	\N
13525375-1855-87f9-a506-ad882d6e9662	3u725n2v696p14582r	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What useful behavior does `rg` provide by default compared with basic `grep` usage?	\N	\N	rg	easy	\N	7	k0bvttta5fh7	2026-08-24 10:43:06.069602+00	2026-08-24 10:43:06.069602+00	\N
691f4b64-6f30-889c-836a-d09001606728	164s0w682k4b574p2s	8d50a017-1da9-8de5-bf68-ffcbebad128f	typed_answer	Write the `rg` command that searches for `useState` only in TypeScript React (`tsx`) files.	`-t tsx` limits the search to that recognized file type.	\N	rg	easy	\N	8	3dnzosojjoryr	2026-08-24 10:43:06.070544+00	2026-08-24 10:43:06.070544+00	\N
290c3db5-299b-8d89-8151-1d9abc8584d7	6t0r4a0v2a544m1j3z	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match each `rg` option to its behavior.	\N	\N	rg	medium	\N	9	13qxkoa0h05jf	2026-08-24 10:43:06.071635+00	2026-08-24 10:43:06.071635+00	\N
cf9a6f8d-d091-8c5d-80e3-1db49f31623a	31571j35350801622x	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	You are debugging inside a minimal server container where ripgrep may not be installed. Which search command should remain your fallback?	`grep` is broadly available on servers and in containers.	\N	Tool choice	medium	\N	10	jzgpwpfnlaeu	2026-08-24 10:43:06.072856+00	2026-08-24 10:43:06.072856+00	\N
daa7f706-e343-8d89-969f-a2ef67eb4ac9	546x524b4o343k6y4f	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	You need to find files named `package.json`, not text inside them. Which tool fits the task?	\N	\N	Tool choice	easy	\N	11	fp3qg8jwo23o	2026-08-24 10:43:06.074075+00	2026-08-24 10:43:06.074075+00	\N
336283db-749b-8cea-b5b5-a670d877a41d	4l206b2h6c2m0c0t56	8d50a017-1da9-8de5-bf68-ffcbebad128f	typed_answer	Write a command that finds all regular `.ts` files below the current directory.	Quote the pattern so the shell does not expand it before `find` sees it.	\N	find	easy	\N	12	kbjt6r8jw27z	2026-08-24 10:43:06.075203+00	2026-08-24 10:43:06.075203+00	\N
658715ed-295b-84ab-9144-c532e6b4ee79	62626x6h0w616i1q40	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Why should the pattern in `find . -name "*.ts"` be quoted?	\N	\N	find	medium	\N	13	32rnrfm6tvthb	2026-08-24 10:43:06.076166+00	2026-08-24 10:43:06.076166+00	\N
2f3a6ad2-3e01-8532-aadd-18e0cffece86	5b3n431f5i5z51234i	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match the `find` criterion to its meaning.	\N	\N	find	easy	\N	14	2orvzplkgs09	2026-08-24 10:43:06.077077+00	2026-08-24 10:43:06.077077+00	\N
0a91ac19-81f4-83f7-aea2-83f713b46764	2s403g5p241t5u0z0h	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which criterion excludes paths under `node_modules`?	\N	\N	find	medium	\N	15	14uuitjkrgntr	2026-08-24 10:43:06.078324+00	2026-08-24 10:43:06.078324+00	\N
cfecff05-f00f-8178-97d7-27b450543d93	70293s0q68406p1s54	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match each modification-time test to its meaning.	Minus means newer than the threshold; plus means older than it.	\N	find	hard	\N	16	1d23fqndpvlfl	2026-08-24 10:43:06.079535+00	2026-08-24 10:43:06.079535+00	\N
727a7d0e-a227-852b-9493-e6e5516f5093	3m5h5k3n623p6l4v2h	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which criterion selects files larger than 100 MiB?	\N	\N	find	medium	\N	17	280if69xqtoz2	2026-08-24 10:43:06.080417+00	2026-08-24 10:43:06.080417+00	\N
54e7ac12-7800-846c-833f-6e8bdf55ea7d	0l0i0z5f0o0g6q6y4a	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What does `-maxdepth 2` do?	\N	\N	find	easy	\N	18	3dy3f9vn95mep	2026-08-24 10:43:06.08124+00	2026-08-24 10:43:06.08124+00	\N
4f0f05b6-6bcc-8201-9b2b-4a5b5975b505	5260002f2e1r331p3i	8d50a017-1da9-8de5-bf68-ffcbebad128f	ordering	Put the safe steps for deleting files selected by `find` in order.	Preview destructive selections before applying deletion.	\N	find safety	medium	\N	19	3k9t6rkeyrfk4	2026-08-24 10:43:06.082076+00	2026-08-24 10:43:06.082076+00	\N
19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	4g6e1u4o1t445d6267	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	In `find . -type f -name "*.log" -mtime -1 -size +1M`, how are the adjacent criteria combined?	\N	\N	find	hard	\N	20	2m4r5fpdrh11b	2026-08-24 10:43:06.082843+00	2026-08-24 10:43:06.082843+00	\N
7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	1r234d1b1o4n1z0a5a	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	In `find . -type f -exec wc -l {} \\;`, what do `{}` and `\\;` mean?	\N	\N	find	hard	\N	21	10t58f6u9imfs	2026-08-24 10:43:06.083682+00	2026-08-24 10:43:06.083682+00	\N
8c7e731b-b835-8095-9b01-56763a4209d9	052t2o0f0i14655553	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What does `ps aux` include?	\N	\N	ps	easy	\N	22	1k1rizfki28j9	2026-08-24 10:43:06.084456+00	2026-08-24 10:43:06.084456+00	\N
f769fe1c-d743-88a2-9add-f1cc3f94fe03	6c6z1b074q033p0b2z	8d50a017-1da9-8de5-bf68-ffcbebad128f	multiple_choice	Which `ps aux` columns are most important before terminating a process?	Use PID to target it and COMMAND to verify it is the intended process.	\N	ps	easy	\N	23	1seojudckfuev	2026-08-24 10:43:06.085364+00	2026-08-24 10:43:06.085364+00	\N
bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	2t1k155f5h4x0r1l2h	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Why does `ps aux | grep [n]ode` use brackets?	\N	\N	ps	medium	\N	24	3rx1k4jdzgcv1	2026-08-24 10:43:06.086149+00	2026-08-24 10:43:06.086149+00	\N
f4c17d81-0f88-8f70-86bf-f48e5ec04854	5z2q4t1b3g0p5y0p4w	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match each `pgrep` option to its output or matching behavior.	\N	\N	pgrep	easy	\N	25	12g6c837u4bw	2026-08-24 10:43:06.087002+00	2026-08-24 10:43:06.087002+00	\N
ee897593-a4d0-8de2-af3b-3ca065d53e26	703e3k5q5i2s0x0d52	8d50a017-1da9-8de5-bf68-ffcbebad128f	typed_answer	Write the preview command that shows PIDs and full command lines matching `dist/main`.	`-f` matches the full command line and `-a` displays it.	\N	pgrep	medium	\N	26	3920mi97ak5gj	2026-08-24 10:43:06.087784+00	2026-08-24 10:43:06.087784+00	\N
a6ad60b9-0b48-82bb-98ea-edc36fbf1756	5k57032k0t1q4a2l6h	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What signal does plain `kill PID` normally send?	SIGTERM allows a process to perform cleanup.	\N	Signals	easy	\N	27	17a63dw4n1qze	2026-08-24 10:43:06.088563+00	2026-08-24 10:43:06.088563+00	\N
fd26ad66-1a47-8ba0-bf6c-2111da50584c	1p525u4o0t6o6c3212	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What is the best first response to a process that should stop?	SIGKILL prevents cleanup, so it should be an escalation.	\N	Signals	medium	\N	28	32sdp74ja1qjr	2026-08-24 10:43:06.089407+00	2026-08-24 10:43:06.089407+00	\N
6cf248b3-ef20-81c0-8ffd-25cb9020ada0	083y1o26703x6p5n55	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which command lists available signal names and numbers?	\N	\N	Signals	easy	\N	29	2szc2v3deqnea	2026-08-24 10:43:06.090244+00	2026-08-24 10:43:06.090244+00	\N
1ad09b97-f93c-8a17-b194-dc1cf2067597	1c4k3r5e1y4t1r3n3g	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Several Node processes are running, but only the one whose command includes `dist/main.js` should stop. Which workflow is safest?	Preview the full-command match before killing; `pkill node` could terminate every Node process.	\N	pkill	hard	\N	30	2ps4ako37b4o	2026-08-24 10:43:06.091088+00	2026-08-24 10:43:06.091088+00	\N
8b7978e3-2ade-893a-ba36-e7497326659c	583b57442t72103c3e	8d50a017-1da9-8de5-bf68-ffcbebad128f	typed_answer	Write the common command that identifies what is using port 3000.	`lsof -i :PORT` is the common port-owner lookup.	\N	Ports	easy	\N	31	2hdn97ijsfw65	2026-08-24 10:43:06.091923+00	2026-08-24 10:43:06.091923+00	\N
68444d79-c6c7-80ad-b5d4-0daf97754e11	5t611n6q320p6d086q	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match each `lsof` option to its effect.	\N	\N	lsof	medium	\N	32	9nsrbibuc62f	2026-08-24 10:43:06.092746+00	2026-08-24 10:43:06.092746+00	\N
9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	572w01714v6w231o55	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which command returns only the PID(s) using port 3000?	\N	\N	Ports	medium	\N	33	y0lvizpdgho8	2026-08-24 10:43:06.093579+00	2026-08-24 10:43:06.093579+00	\N
c2c200f0-4559-8d23-8883-8b5577a99c9e	5c3m2z196v5d0r4d0e	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match the letters in `ss -tulpn` to their meanings.	\N	\N	ss	medium	\N	34	3vpjg5ldep5n7	2026-08-24 10:43:06.094366+00	2026-08-24 10:43:06.094366+00	\N
9718cbdc-48f6-8e50-a412-a9589360f397	3j2y5g0x202n5b245u	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	On Linux or in a container without `lsof`, which command lists listening TCP/UDP ports with processes and numeric values?	\N	\N	Ports	easy	\N	35	35ilaqcm7zg3u	2026-08-24 10:43:06.095173+00	2026-08-24 10:43:06.095173+00	\N
f8a2fe7c-7da1-8a6b-bd07-af42744f554b	2f4r0365371t1r5r36	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What macOS command is given as an alternative for listing listening connections?	\N	\N	Ports	easy	\N	36	1p9ljq82mg85v	2026-08-24 10:43:06.095963+00	2026-08-24 10:43:06.095963+00	\N
1a963fd5-5a70-890d-8500-a4076dddd161	5e5k3n225h325t3f0j	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What does appending `&` to a command do?	\N	\N	Jobs	easy	\N	37	unpg7m125k02	2026-08-24 10:43:06.096787+00	2026-08-24 10:43:06.096787+00	\N
bf69aa1e-d263-882f-93ca-94634446955b	6a3r3r0h1j5u732w3x	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	After pressing `Ctrl+Z`, what is the process state?	Use `bg` to resume it in the background or `fg` in the foreground.	\N	Jobs	medium	\N	38	188el66i1qleh	2026-08-24 10:43:06.09755+00	2026-08-24 10:43:06.09755+00	\N
c2af6150-ffac-8294-8e92-fd0281ffce05	0f373v5s0t13675149	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match the job-control command to its action.	\N	\N	Jobs	easy	\N	39	7u4lmyhdfkbh	2026-08-24 10:43:06.098338+00	2026-08-24 10:43:06.098338+00	\N
75e38364-4e93-831f-8d1e-73f96601b1e8	3c3d6d3u370e18244w	8d50a017-1da9-8de5-bf68-ffcbebad128f	typed_answer	Write the command that runs `node dist/main.js` in the background, survives disconnect, and stores both stdout and stderr in `app.log`.	`nohup` handles disconnect, redirections capture both streams, and `&` backgrounds the process.	\N	nohup	medium	\N	40	3h1cewqw6dd7y	2026-08-24 10:43:06.099171+00	2026-08-24 10:43:06.099171+00	\N
4050b806-1050-896c-963a-30fbfa3a383b	405e466l441g0b091f	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which command reports free space per mounted filesystem in human-readable units?	\N	\N	Disk	easy	\N	41	2qsxpc0qd1n88	2026-08-24 10:43:06.100015+00	2026-08-24 10:43:06.100015+00	\N
f8101924-53a1-8a05-98fe-0f7543eba194	2i384b5c6t2g2q5f4p	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which command shows a one-line human-readable size for each non-hidden entry in the current directory?	`du` measures usage, `-s` summarizes, and `-h` formats sizes.	\N	Disk	medium	\N	42	nlpr2sjtpa6c	2026-08-24 10:43:06.100926+00	2026-08-24 10:43:06.100926+00	\N
4e9568c2-787a-8d19-ba7c-5b0dc71a2c4f	5u6b4462662n0i2s23	8d50a017-1da9-8de5-bf68-ffcbebad128f	typed_answer	Write the pipeline that sorts current-directory entry sizes in human-readable numeric order.	`sort -h` understands suffixes such as K, M, and G.	\N	Disk	medium	\N	43	3bz0dswtzqwhr	2026-08-24 10:43:06.101697+00	2026-08-24 10:43:06.101697+00	\N
be54437f-d5e9-876b-b691-27009848bb48	406v5p1d1a2r543422	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which pipeline shows the ten largest entries after sorting by size?	\N	\N	Disk	hard	\N	44	alykm5wasqr1	2026-08-24 10:43:06.10255+00	2026-08-24 10:43:06.10255+00	\N
db2f66db-5d99-823d-a2ec-3f29d907b28f	1j2p5r3k6y1c0a2n0m	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	What does `watch -n 2 'docker ps'` do?	\N	\N	Monitoring	easy	\N	45	2h9bpgk78zsyq	2026-08-24 10:43:06.103386+00	2026-08-24 10:43:06.103386+00	\N
f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	6u0a3h1k3z3b1n2q0f	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match the `time` measurement to its meaning.	\N	\N	time	medium	\N	46	2ravrrqr7gkoz	2026-08-24 10:43:06.104218+00	2026-08-24 10:43:06.104218+00	\N
80e95d2a-436a-82b9-b270-a3336b065c3f	624d164i2v1d0v6l1n	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	If `real` time is much larger than `user + sys`, what is the likely interpretation?	\N	\N	time	hard	\N	47	1h5i54ci0ln10	2026-08-24 10:43:06.10503+00	2026-08-24 10:43:06.10503+00	\N
2bf82f23-7734-8f97-9e42-97abb45eefa6	1c211x4s0j2b4h050l	8d50a017-1da9-8de5-bf68-ffcbebad128f	matching	Match the task to the platform-specific command.	\N	\N	macOS vs Linux	medium	\N	48	3jkratr4n1332	2026-08-24 10:43:06.105806+00	2026-08-24 10:43:06.105806+00	\N
c7e7d4d9-1faa-888a-8614-f4e329ef6f16	6t032i55146h034909	8d50a017-1da9-8de5-bf68-ffcbebad128f	single_choice	Which pair correctly shows in-place `sed` syntax?	\N	\N	macOS vs Linux	hard	\N	49	2uaakbvjn8hjq	2026-08-24 10:43:06.106633+00	2026-08-24 10:43:06.106633+00	\N
f1037adb-1988-8b66-bad2-ffa44ed0825e	235u515s5v326n6419	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: bread	bread = хліб	A1 Food Vocabulary	Food: English → Ukrainian	easy	A basic baked food.	0	2mw31jw88pfl5	2026-08-24 10:43:06.107409+00	2026-08-24 10:43:06.107409+00	\N
1924c112-1179-8e2f-ad89-68063c0fb4ba	00493v5t4j0u461c4b	bcd84e48-222b-887e-9937-ee30570c01ba	matching	Match each English food word with its Ukrainian translation.	These are common A1 food and drink words.	A1 Food Vocabulary	Food: English → Ukrainian	easy	\N	1	aucisstn7rl0	2026-08-24 10:43:06.108209+00	2026-08-24 10:43:06.108209+00	\N
6b378dee-6b57-89e1-9353-e8523409b93e	1v306u2v2a28092g68	bcd84e48-222b-887e-9937-ee30570c01ba	matching	Match each Ukrainian food word with its English translation.	The same vocabulary is practised in the opposite direction.	A1 Food Vocabulary	Food: Ukrainian → English	easy	\N	2	28g8ugon1j314	2026-08-24 10:43:06.108967+00	2026-08-24 10:43:06.108967+00	\N
8ab7e970-c7c3-831d-897c-a3909736a573	096h5b0c2i6k1s6k31	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: хліб	хліб = bread	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	3	33vhq0uz996rl	2026-08-24 10:43:06.109782+00	2026-08-24 10:43:06.109782+00	\N
926f924e-f393-85df-9a9c-d0207306c0c1	3o5z1b214s073q6h03	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: молоко	молоко = milk	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	4	1hllpqxcdwcpg	2026-08-24 10:43:06.110568+00	2026-08-24 10:43:06.110568+00	\N
af729aba-bb95-8766-b73c-6b81997dd7b7	2c1p50311x0209552i	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: вода	вода = water	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	5	34am1empsumby	2026-08-24 10:43:06.111365+00	2026-08-24 10:43:06.111365+00	\N
0e7e852f-e50b-8952-bc3e-c0c83de81cac	401b701o3t28241p5v	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: чай	чай = tea	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	6	3lu6vc9niploj	2026-08-24 10:43:06.112101+00	2026-08-24 10:43:06.112101+00	\N
b931cb06-d05e-8ec6-9795-c489217db379	3s1b205y502f5a3f64	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: кава	кава = coffee	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	7	13abrhqhhmtl7	2026-08-24 10:43:06.112889+00	2026-08-24 10:43:06.112889+00	\N
a24b40d9-727d-81ed-98f1-b989e072a0a0	5q1x1y1w2z4z4z454o	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: яблуко	яблуко = apple	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	8	b03orlfga2mw	2026-08-24 10:43:06.113671+00	2026-08-24 10:43:06.113671+00	\N
efc13df1-fda7-8b42-8fcb-ca888f4545d5	2o6362352g321g3l1t	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: банан	банан = banana	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	9	1w6oyy9vkluwj	2026-08-24 10:43:06.114538+00	2026-08-24 10:43:06.114538+00	\N
be6554d4-f65c-811c-a2d7-0a66b186bc2c	6i0n2d1b4c6u3f3g3d	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: апельсин	апельсин = orange	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	10	1hr3esblq7wgh	2026-08-24 10:43:06.115336+00	2026-08-24 10:43:06.115336+00	\N
02c3c4b9-5132-8b3e-9114-c9f146ad4f63	5u703m3x2v12075c4w	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: картопля	картопля = potato	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	11	1e5z909ypd01g	2026-08-24 10:43:06.116156+00	2026-08-24 10:43:06.116156+00	\N
60b4995a-c666-8a54-bae4-ea04723842b7	6l3y000d2z6p5x3x0c	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: помідор	помідор = tomato	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	12	1unb91bfr5otf	2026-08-24 10:43:06.117006+00	2026-08-24 10:43:06.117006+00	\N
ea37c658-195d-840c-a522-1955c7c6f53f	1s44273x12305p4w4c	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: морква	морква = carrot	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	13	1z6u9tn05r59l	2026-08-24 10:43:06.117785+00	2026-08-24 10:43:06.117785+00	\N
e7678d2e-ded4-8dbc-ac4e-7a1c3bf4acb7	61062w5z3344556860	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: яйце	яйце = egg	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	14	kjga5a4wbr7c	2026-08-24 10:43:06.118572+00	2026-08-24 10:43:06.118572+00	\N
fe874b23-e369-8879-a5cb-e44f41453788	2e5h651j4g734q0s4t	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: сир	сир = cheese	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	15	2lmdwg4ihnx2s	2026-08-24 10:43:06.119365+00	2026-08-24 10:43:06.119365+00	\N
9f1784c8-79a9-8412-ac89-aa73c30edb4b	6w6d5r73224w104262	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: рис	рис = rice	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	16	15tsfuiqur8tp	2026-08-24 10:43:06.120163+00	2026-08-24 10:43:06.120163+00	\N
78f9fdd3-d042-82f6-9f78-72fd962f617b	3u3x553u5x065e0s1o	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: курка	курка = chicken	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	17	2iyp1ltqiv5tj	2026-08-24 10:43:06.120939+00	2026-08-24 10:43:06.120939+00	\N
8dfd3a56-a49e-8031-afaa-39c372f61ec9	1k1u2s1n536y3v385c	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: риба	риба = fish	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	18	2y823v7dynlau	2026-08-24 10:43:06.12177+00	2026-08-24 10:43:06.12177+00	\N
0f529282-d38c-8783-8b0b-f65e31c4abc0	183x15621438566q4x	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: м’ясо	м’ясо = meat	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	19	bmhoc172k59t	2026-08-24 10:43:06.122638+00	2026-08-24 10:43:06.122638+00	\N
4c256dee-8118-8976-945c-99e84cacea9b	2q1b1835000o6q472x	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: суп	суп = soup	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	20	27kpmwl9ua1w2	2026-08-24 10:43:06.123722+00	2026-08-24 10:43:06.123722+00	\N
a53aa7ae-7e47-8eb1-bb3b-5ef27ec5d3aa	4i6w3k5r5l3065193k	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: салат	салат = salad	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	21	1rasxpsjgnh4i	2026-08-24 10:43:06.124609+00	2026-08-24 10:43:06.124609+00	\N
7bff993f-8a2e-8c2a-8d1b-e57e392574a5	3l021t6a3720030x3s	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: торт	торт = cake	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	22	351z7hmc4cp0p	2026-08-24 10:43:06.125482+00	2026-08-24 10:43:06.125482+00	\N
67493a3e-9e27-831e-b630-1b721eca7d41	5g5c2n2q2t5q1o1s6w	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: цукор	цукор = sugar	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	23	3tv4wjqth3vfd	2026-08-24 10:43:06.126324+00	2026-08-24 10:43:06.126324+00	\N
d8148550-5148-8b1e-974b-6ed02a6754c1	4f43645s3s0x1h3l2m	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: сіль	сіль = salt	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	24	gdbb3zs9vh7f	2026-08-24 10:43:06.127186+00	2026-08-24 10:43:06.127186+00	\N
6732320d-e771-86b1-8afb-292069131611	6w5k0u506w5i0i201n	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: сніданок	сніданок = breakfast	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	25	26tyokreyj6nr	2026-08-24 10:43:06.12793+00	2026-08-24 10:43:06.12793+00	\N
4bda6e56-3c08-82fb-b6d9-87e8e37fd461	166v4g6r3a2g6g703h	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: обід	обід = lunch	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	26	3t22ssytqptij	2026-08-24 10:43:06.12873+00	2026-08-24 10:43:06.12873+00	\N
00ca5865-c1a1-88f1-b3b8-dade63883e8d	4m2r3e6v293e366v0s	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into English: вечеря	вечеря = dinner	A1 Food Vocabulary	Food: Ukrainian → English	easy	Write one English food word.	27	3rqh1mbnmdyua	2026-08-24 10:43:06.129532+00	2026-08-24 10:43:06.129532+00	\N
77ab2f42-4ae7-8b10-8fea-15e43c590a57	083h5g4e106z2z0b0z	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: milk	milk = молоко	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	28	17nalxfacbs1	2026-08-24 10:43:06.130369+00	2026-08-24 10:43:06.130369+00	\N
94cec9f1-4846-84b1-9dc8-8d93efd417ad	534n6z6u612y3x4k56	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: water	water = вода	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	29	1twlu849mc81t	2026-08-24 10:43:06.131246+00	2026-08-24 10:43:06.131246+00	\N
0354deb1-6fb6-88a3-a2ac-4bb19afb7224	1p28455b4c4m3o6q3s	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: tea	tea = чай	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	30	3afvjkai1ktpg	2026-08-24 10:43:06.132075+00	2026-08-24 10:43:06.132075+00	\N
0b73f77e-db3d-8899-a73d-c60fb6c29683	214c2l454p3g4a3s2i	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: coffee	coffee = кава	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	31	2872nsdmy5x17	2026-08-24 10:43:06.132947+00	2026-08-24 10:43:06.132947+00	\N
7e92a1d0-a3f6-83fc-a7be-e88f71419f68	3v1k3k1y6s1q5u5t4s	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: apple	apple = яблуко	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	32	qgousrm55rme	2026-08-24 10:43:06.133832+00	2026-08-24 10:43:06.133832+00	\N
0f08d9e8-0b97-82e5-9bfa-d7931ba7c404	2h6d096q1o612v5244	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: banana	banana = банан	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	33	3sp7xubw5lp4f	2026-08-24 10:43:06.134757+00	2026-08-24 10:43:06.134757+00	\N
e53929bf-d21f-8806-82ff-7530cdcf641a	0g086z6f27144s4220	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: orange	orange = апельсин	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	34	1iim6rsezymfx	2026-08-24 10:43:06.135576+00	2026-08-24 10:43:06.135576+00	\N
a8efb48a-b05e-8768-b3fd-bcfbdb9ed074	6o2f2m3n4h6e1n1t5n	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: potato	potato = картопля	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	35	1v464e2d87d0z	2026-08-24 10:43:06.136403+00	2026-08-24 10:43:06.136403+00	\N
ddbc9a48-4047-8646-ac6d-6e85ded76f42	47390m0w5g2k3b570f	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: tomato	tomato = помідор	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	36	1o06et72zfmn6	2026-08-24 10:43:06.137241+00	2026-08-24 10:43:06.137241+00	\N
d23670eb-5087-8357-9940-175b65829981	684u1t54452k1p3e1r	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: carrot	carrot = морква	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	37	111dephce6ajg	2026-08-24 10:43:06.138138+00	2026-08-24 10:43:06.138138+00	\N
01a2cbe4-f74d-88c9-a8a3-514b3ecf4f97	5h4z5z6w075j5x1e73	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: egg	egg = яйце	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	38	13dpozywo10ls	2026-08-24 10:43:06.13897+00	2026-08-24 10:43:06.13897+00	\N
bdecf5a6-62bd-8b62-bdc6-6a9f54c2831c	1d0j6o4v1v5w6e4k1w	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: cheese	cheese = сир	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	39	3q8unjuomn9y	2026-08-24 10:43:06.139786+00	2026-08-24 10:43:06.139786+00	\N
43cb3fe3-b62c-8baf-b77c-28f9c1ad529e	6e375f4c4t2h3u496g	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: rice	rice = рис	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	40	2nq928p6ne3u8	2026-08-24 10:43:06.140518+00	2026-08-24 10:43:06.140518+00	\N
c5555818-485c-8f68-985f-bfd5fddc5eba	2i21370s5g4d4o176n	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: chicken	chicken = курка	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	41	1j95nkods15uq	2026-08-24 10:43:06.141364+00	2026-08-24 10:43:06.141364+00	\N
f14b8c4d-1afc-8adc-9006-308318e0e258	6v5g47381z591e3l5s	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: fish	fish = риба	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	42	320g1hhxrqw69	2026-08-24 10:43:06.142279+00	2026-08-24 10:43:06.142279+00	\N
024c7c63-d5f4-8f29-9470-ca3af756dc51	3u663y1h1h393o7246	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: meat	meat = м’ясо	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	43	wumd88vfyojw	2026-08-24 10:43:06.14306+00	2026-08-24 10:43:06.14306+00	\N
13561850-3a37-82af-84ce-454f4caf47fe	3t4s0w3z616i624l2r	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: soup	soup = суп	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	44	ga4tb64h6s5t	2026-08-24 10:43:06.143883+00	2026-08-24 10:43:06.143883+00	\N
cf7bb76e-641e-8b56-bccc-9de7922c735e	2y110p705w1g1m4c25	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: salad	salad = салат	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	45	3d5jj85jb4gv4	2026-08-24 10:43:06.144691+00	2026-08-24 10:43:06.144691+00	\N
5affe485-36d6-8a5e-8992-eb9f9d093cbf	235l365x0u455z5a0e	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: cake	cake = торт	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	46	fen9z2zmv90	2026-08-24 10:43:06.145463+00	2026-08-24 10:43:06.145463+00	\N
fc1c519c-dee8-8641-9d33-182724f0e452	0f4d112553142a5y4x	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: sugar	sugar = цукор	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	47	1k14rr2u6wwx7	2026-08-24 10:43:06.146276+00	2026-08-24 10:43:06.146276+00	\N
833020c1-5468-88f3-a31c-f81a99229fe4	6n5z4w3k0p1h2n532u	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: salt	salt = сіль	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	48	21vseaj0dwayb	2026-08-24 10:43:06.147044+00	2026-08-24 10:43:06.147044+00	\N
f021f898-d2cc-887e-84be-dc02c320abd2	5o3t2r566w15296i31	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: breakfast	breakfast = сніданок	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	49	1adzkhxcb91on	2026-08-24 10:43:06.147855+00	2026-08-24 10:43:06.147855+00	\N
bf9f079f-f9ed-8ad0-86bf-d1c0e2aefc02	613w2d6l07626a0f2n	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: lunch	lunch = обід	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	50	29bqojpknxxf5	2026-08-24 10:43:06.148727+00	2026-08-24 10:43:06.148727+00	\N
200dd31c-b6ea-8d44-a350-1c2daf328f30	5p29382l4f3e5l2641	bcd84e48-222b-887e-9937-ee30570c01ba	typed_answer	Translate into Ukrainian: dinner	dinner = вечеря	A1 Food Vocabulary	Food: English → Ukrainian	easy	Напишіть одне слово українською.	51	1vhzil7741ygc	2026-08-24 10:43:06.14954+00	2026-08-24 10:43:06.14954+00	\N
485bea2b-95ad-8185-b0ea-48befaef18ad	505a1g4e065j730v54	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	T-shirt	I am wearing a white T-shirt.	\N	Clothes	easy	\N	0	2pqtv0eu687h0	2026-08-24 10:43:06.150414+00	2026-08-24 10:43:06.150414+00	\N
b04204c8-0b9a-88c9-be26-dfd354d6356c	2f47280d721c3u3o58	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	футболка	I am wearing a white T-shirt.	\N	Clothes	easy	\N	1	1g17y7s4si1rn	2026-08-24 10:43:06.152323+00	2026-08-24 10:43:06.152323+00	\N
66f82326-e5d0-8cc5-82c2-90718f8bb2e9	2i166z071w5q4w0a5p	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	shirt	He wears a blue shirt.	\N	Clothes	easy	\N	2	2p93pcmurefjz	2026-08-24 10:43:06.154102+00	2026-08-24 10:43:06.154102+00	\N
6327f423-a733-83c6-85a9-ab12704b7dac	0k5p3y2w1i3s3z0j47	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	сорочка	He wears a blue shirt.	\N	Clothes	easy	\N	3	3t35rpasoy0yw	2026-08-24 10:43:06.155862+00	2026-08-24 10:43:06.155862+00	\N
bf4dd249-d14f-8ef6-b1f1-8bb423fb3cae	4d356z4c4w521k0k35	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	blouse	Her blouse is white.	\N	Clothes	easy	\N	4	2eht5hfbt14ub	2026-08-24 10:43:06.157442+00	2026-08-24 10:43:06.157442+00	\N
c9c7ecfc-de70-8235-be89-074147fc8ee3	3a6q1p576b6o3s131j	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	блузка	Her blouse is white.	\N	Clothes	easy	\N	5	435utw8thtsa	2026-08-24 10:43:06.159261+00	2026-08-24 10:43:06.159261+00	\N
9b6c4c20-4de2-8a6c-92f6-b4ee3cf5127b	2p2q2t186h3k4j6w2i	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	sweater	This sweater is warm.	\N	Clothes	easy	\N	6	28dan48odzyw7	2026-08-24 10:43:06.160943+00	2026-08-24 10:43:06.160943+00	\N
d539ffb3-1414-83d4-a888-392bacfe9a04	39234i2s470d342n59	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	светр	This sweater is warm.	\N	Clothes	easy	\N	7	uudbkhv7z3q2	2026-08-24 10:43:06.162553+00	2026-08-24 10:43:06.162553+00	\N
aac13011-f59d-84da-9dad-ea7fb7eebefb	513j4v0x2s2k6y722x	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	hoodie	My hoodie is grey.	\N	Clothes	easy	\N	8	24ybbzgvdli30	2026-08-24 10:43:06.164137+00	2026-08-24 10:43:06.164137+00	\N
055d6b8a-b534-80c0-9e32-77a218ba2780	633r205h0g270g4p35	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	худі	My hoodie is grey.	\N	Clothes	easy	\N	9	3kbztgqvgtxlu	2026-08-24 10:43:06.1659+00	2026-08-24 10:43:06.1659+00	\N
240ed98f-7280-8081-ac83-966292f63e5d	48520f080u601w3x0i	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	jacket	Put on your jacket.	\N	Clothes	easy	\N	10	1fgantwsrksgz	2026-08-24 10:43:06.167651+00	2026-08-24 10:43:06.167651+00	\N
032e4bbc-d5df-83f7-af06-3636fe65a0a9	5k5166710a474g0604	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	куртка	Put on your jacket.	\N	Clothes	easy	\N	11	350quybn6bwsu	2026-08-24 10:43:06.169334+00	2026-08-24 10:43:06.169334+00	\N
59c2e542-6697-808a-a453-7f1676149810	2b0x205r6k4l3w2g5i	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	coat	She has a long coat.	\N	Clothes	easy	\N	12	2sr7b8oqkb2sj	2026-08-24 10:43:06.170979+00	2026-08-24 10:43:06.170979+00	\N
67abaf8f-f2e9-8b68-be07-f38808a09aa6	5h0n452u0g0j0k603t	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	пальто	She has a long coat.	\N	Clothes	easy	\N	13	1j6hs8ka7wac1	2026-08-24 10:43:06.172642+00	2026-08-24 10:43:06.172642+00	\N
5bc6a038-78b1-8992-9015-010b5a096faf	634m424z3t3f506g4u	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	dress	The dress is red.	\N	Clothes	easy	\N	14	2vxbtphmpws16	2026-08-24 10:43:06.174408+00	2026-08-24 10:43:06.174408+00	\N
cbfaadb9-096a-85ab-be35-18eda4a5a71b	705f1n2e4c3z0h6b3i	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	сукня	The dress is red.	\N	Clothes	easy	\N	15	2sds0rols3uxw	2026-08-24 10:43:06.176862+00	2026-08-24 10:43:06.176862+00	\N
2668d303-4413-86de-beee-702a7d54082c	231r1l2u2x020d0w3s	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	skirt	Her skirt is black.	\N	Clothes	easy	\N	16	2pyag5smji3lc	2026-08-24 10:43:06.17863+00	2026-08-24 10:43:06.17863+00	\N
cd2591b3-5949-87e4-964e-7191a7d9fbc8	4k1r1h5u5h0m3v5c5v	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	спідниця	Her skirt is black.	\N	Clothes	easy	\N	17	2cb2egvcsfzty	2026-08-24 10:43:06.180265+00	2026-08-24 10:43:06.180265+00	\N
7612de5e-59eb-84a2-be24-cb050467375f	5t3o324n084q591c4e	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	jeans	These jeans are blue.	\N	Clothes	easy	\N	18	275k26qxpn2rf	2026-08-24 10:43:06.181999+00	2026-08-24 10:43:06.181999+00	\N
d20f81f7-9fe1-88dd-b241-ba1cacfe14b1	1v3d0p7227194w3z3x	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	джинси	These jeans are blue.	\N	Clothes	easy	\N	19	1lax37xmtk390	2026-08-24 10:43:06.18383+00	2026-08-24 10:43:06.18383+00	\N
eb365fc9-8ea7-8f18-b591-43a21df9fa29	590j4c2k3h032z3r0m	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	trousers	His trousers are brown.	\N	Clothes	easy	\N	20	165d2r4dmyp6w	2026-08-24 10:43:06.185546+00	2026-08-24 10:43:06.185546+00	\N
548ef5e9-2406-8ac4-98d8-99e497438a8a	52150k19423s6i2z30	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	штани	His trousers are brown.	\N	Clothes	easy	\N	21	20quht1c6gl8u	2026-08-24 10:43:06.18719+00	2026-08-24 10:43:06.18719+00	\N
9f22978d-d803-8181-a4d6-8e7ee9a5fc8a	5h0m1j1k4x061a6z6w	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	shorts	I wear shorts in summer.	\N	Clothes	easy	\N	22	3tiz1nl4duxbe	2026-08-24 10:43:06.188922+00	2026-08-24 10:43:06.188922+00	\N
395daae3-c9e9-83a5-a290-fefc4ce1d0ba	5w155v5h1d62565367	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	шорти	I wear shorts in summer.	\N	Clothes	easy	\N	23	1stzhzj0fgxqq	2026-08-24 10:43:06.190651+00	2026-08-24 10:43:06.190651+00	\N
03048403-511c-85ec-86e4-378e9117b5db	133e4o1j1a620v642m	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	suit	He wears a suit to work.	\N	Clothes	easy	\N	24	3nonfvmg5ynsc	2026-08-24 10:43:06.192299+00	2026-08-24 10:43:06.192299+00	\N
02beb82d-dc1a-8e99-b768-07f887ce32f4	1a6i624h2k094s0r46	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	костюм	He wears a suit to work.	\N	Clothes	easy	\N	25	1904uphbbkt62	2026-08-24 10:43:06.193921+00	2026-08-24 10:43:06.193921+00	\N
f756a3a4-7e7c-819b-9012-d56c63291d97	6m6t6o5j3y441i5p4b	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	uniform	We wear a school uniform.	\N	Clothes	easy	\N	26	182b5ykrx76qs	2026-08-24 10:43:06.195568+00	2026-08-24 10:43:06.195568+00	\N
df7a1652-262f-8e8e-9ca7-2df2829c7a28	0l643p0n2e5e6m4335	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	форма	We wear a school uniform.	\N	Clothes	easy	\N	27	1bxouymxiyqrc	2026-08-24 10:43:06.197219+00	2026-08-24 10:43:06.197219+00	\N
cc0b7b72-e745-887e-907d-b0785c13a508	3a3p6f2q4v5i5b4a45	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	pyjamas	My pyjamas are comfortable.	\N	Clothes	easy	\N	28	x3pkq626q7bk	2026-08-24 10:43:06.198963+00	2026-08-24 10:43:06.198963+00	\N
7ce6ccec-a9c4-8401-a325-18f4317acbff	354j090v562b3s3d3v	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	піжама	My pyjamas are comfortable.	\N	Clothes	easy	\N	29	mayaye20kc9c	2026-08-24 10:43:06.20073+00	2026-08-24 10:43:06.20073+00	\N
9df3aa48-316d-8826-a0a4-9cd0cbad3bff	5e2g6o0d2b3q3l3a31	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	underwear	Pack clean underwear.	\N	Clothes	easy	\N	30	2u7hc90gfuehw	2026-08-24 10:43:06.20346+00	2026-08-24 10:43:06.20346+00	\N
8112f2b1-c5b7-8cdd-aa6f-a2b4d48358b7	296i683l1f3d6t703i	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	нижня білизна	Pack clean underwear.	\N	Clothes	easy	\N	31	2o0unwco85z17	2026-08-24 10:43:06.205128+00	2026-08-24 10:43:06.205128+00	\N
55d15681-d4f1-8936-a6cc-10885b7446ae	4x5j3i4b5q0x664m1s	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	socks	These socks are warm.	\N	Clothes	easy	\N	32	3lkjga3agt9p1	2026-08-24 10:43:06.206829+00	2026-08-24 10:43:06.206829+00	\N
b1c92baf-3029-894e-bfd3-332d5d4c79df	575y5d1g5z4f456z54	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	шкарпетки	These socks are warm.	\N	Clothes	easy	\N	33	m6dcgd0x56ji	2026-08-24 10:43:06.208434+00	2026-08-24 10:43:06.208434+00	\N
9a18a4db-0dbb-8e43-b47f-f5560016dedb	2k5a14713l1o610o0d	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	shoes	Her shoes are new.	\N	Clothes	easy	\N	34	1cfp4q5z7zwb0	2026-08-24 10:43:06.21001+00	2026-08-24 10:43:06.21001+00	\N
3881cb10-a5a8-8552-bb99-342a39c5ee75	122s254f562m4z3o6g	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	туфлі	Her shoes are new.	\N	Clothes	easy	\N	35	318wv1pqnvtli	2026-08-24 10:43:06.211689+00	2026-08-24 10:43:06.211689+00	\N
c2fa4fd5-de53-8ade-87e8-781b4ddb67c2	0d0s5x2166130x0v2o	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	trainers	I run in trainers.	\N	Clothes	easy	\N	36	1kz7xip1x0rnk	2026-08-24 10:43:06.213342+00	2026-08-24 10:43:06.213342+00	\N
efd58ea6-1580-8545-b4a4-17ff92fbdf46	1d082q375b0h2l6x2b	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	кросівки	I run in trainers.	\N	Clothes	easy	\N	37	14r3vv8fomvsv	2026-08-24 10:43:06.215042+00	2026-08-24 10:43:06.215042+00	\N
ade4481c-3395-88fe-8c4b-63449a28a2e2	6w5q4v0s5b576u520p	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	boots	Wear boots in the snow.	\N	Clothes	easy	\N	38	7faik88oouep	2026-08-24 10:43:06.216673+00	2026-08-24 10:43:06.216673+00	\N
ce78c61c-aa9b-8ae0-9a4f-881a3c1b5f91	330h3o2m265i4j5t6r	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	чоботи	Wear boots in the snow.	\N	Clothes	easy	\N	39	34qk8433o44lg	2026-08-24 10:43:06.218332+00	2026-08-24 10:43:06.218332+00	\N
8b566ae7-fd72-826e-a495-10de8d99e348	3f02425v48053z355z	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	sandals	Sandals are good for summer.	\N	Clothes	easy	\N	40	abj9czn5awqq	2026-08-24 10:43:06.220056+00	2026-08-24 10:43:06.220056+00	\N
f9c7d64f-a85d-85f7-b0b3-e73367bfad01	5o71361a3p2p6e3644	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	сандалі	Sandals are good for summer.	\N	Clothes	easy	\N	41	3hj94hjt4az3k	2026-08-24 10:43:06.221814+00	2026-08-24 10:43:06.221814+00	\N
545a6838-e7bb-8e79-892a-8fb95d0a2ae1	5b181i5d20156u5u6n	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	hat	He is wearing a hat.	\N	Clothes	easy	\N	42	3igd0dwcotrqq	2026-08-24 10:43:06.223469+00	2026-08-24 10:43:06.223469+00	\N
dd00a0fa-d4cf-81e3-8405-0bb23cb61d67	28703q011v0s1k1n6b	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	капелюх	He is wearing a hat.	\N	Clothes	easy	\N	43	1rm3sly62s560	2026-08-24 10:43:06.225115+00	2026-08-24 10:43:06.225115+00	\N
1c2f9159-83e6-89f6-9d03-67b85daf5d5b	626u582i5f2w2n072t	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	cap	My cap is green.	\N	Clothes	easy	\N	44	1aq8bpylva3ld	2026-08-24 10:43:06.226899+00	2026-08-24 10:43:06.226899+00	\N
a2a1e4d4-5e56-88a1-a94e-cdcd86aebec6	2o5c312g1v214t301e	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	кепка	My cap is green.	\N	Clothes	easy	\N	45	2to8ssypo7xsk	2026-08-24 10:43:06.228597+00	2026-08-24 10:43:06.228597+00	\N
ab87fbf3-6331-8bef-a903-f673df12aa0b	023m6t34465u1o2u6p	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	scarf	This scarf is warm.	\N	Clothes	easy	\N	46	1hny5ouo9uhlz	2026-08-24 10:43:06.230188+00	2026-08-24 10:43:06.230188+00	\N
d22aa0a3-1baf-842d-8db8-4a2bfbb86bc1	1y0s6h49510i5u6g2u	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	шарф	This scarf is warm.	\N	Clothes	easy	\N	47	duo0tocdb6oy	2026-08-24 10:43:06.231942+00	2026-08-24 10:43:06.231942+00	\N
f1ea73ab-6036-8a5c-8eee-b2d75e91b74b	1v4h3h013q2j4x0n18	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	gloves	I need gloves in winter.	\N	Clothes	easy	\N	48	nsa5t6q7pyj9	2026-08-24 10:43:06.233831+00	2026-08-24 10:43:06.233831+00	\N
8184535d-6c50-812b-975e-f6a5c5a336c2	37036u5w0o256d3s30	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	рукавички	I need gloves in winter.	\N	Clothes	easy	\N	49	1949p6c0a5vph	2026-08-24 10:43:06.235571+00	2026-08-24 10:43:06.235571+00	\N
4620b24e-e9c3-8ab1-a2e0-83dd222381fb	0m5n3p501d6c5p2n0t	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	belt	This belt is black.	\N	Clothes	easy	\N	50	2q5qgvk6naulk	2026-08-24 10:43:06.237179+00	2026-08-24 10:43:06.237179+00	\N
e71a9f81-33d7-851f-81d4-caf732ca0723	4q6c6b0w5y4t3t3j6e	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	ремінь	This belt is black.	\N	Clothes	easy	\N	51	3jqlvwtz3y0ai	2026-08-24 10:43:06.2389+00	2026-08-24 10:43:06.2389+00	\N
b7fa0752-b2b6-8caf-8dfb-fa53806a3a10	4g5v1i2k0c4f6p2z4i	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	tie	His tie is red.	\N	Clothes	easy	\N	52	h3jdb4bc064f	2026-08-24 10:43:06.240598+00	2026-08-24 10:43:06.240598+00	\N
b1c50d75-21db-84cd-beea-8cd9c9b679f4	6q63281e136h110l1r	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	краватка	His tie is red.	\N	Clothes	easy	\N	53	3c2jnr95xgksp	2026-08-24 10:43:06.242403+00	2026-08-24 10:43:06.242403+00	\N
5df93fa2-3d18-82ef-a24e-f6b780945d6a	0l5u7243612v111x5l	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	bag	Her bag is small.	\N	Clothes	easy	\N	54	vdv8gk3tmj3g	2026-08-24 10:43:06.244087+00	2026-08-24 10:43:06.244087+00	\N
9bf90618-9cff-8bf9-a04a-d7069086ec32	131e5n5j550q2q522o	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	сумка	Her bag is small.	\N	Clothes	easy	\N	55	17vj5db7zosvu	2026-08-24 10:43:06.245655+00	2026-08-24 10:43:06.245655+00	\N
725a8b84-0a4d-80d9-9dce-b885f56a676c	2u6v1r120c1v6f1336	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	pocket	My phone is in my pocket.	\N	Clothes	easy	\N	56	qvxo8k3kk84p	2026-08-24 10:43:06.247328+00	2026-08-24 10:43:06.247328+00	\N
34c6010a-6ae8-8633-9cf8-54e3d309e611	5r3g0a2a5a0p1z5f09	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	кишеня	My phone is in my pocket.	\N	Clothes	easy	\N	57	6ehk7az798bx	2026-08-24 10:43:06.249094+00	2026-08-24 10:43:06.249094+00	\N
02cdf03d-9f2c-8ce4-8662-10289e1887c0	3f3e6f2q5i450v621n	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	zip	Close the zip on your jacket.	\N	Clothes	easy	\N	58	1xuxe0r9gd2e8	2026-08-24 10:43:06.250765+00	2026-08-24 10:43:06.250765+00	\N
3c8437d0-01fe-8296-b103-0d88203c29f4	3w5d2w1452704e0i0q	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	блискавка	Close the zip on your jacket.	\N	Clothes	easy	\N	59	15mvc4bcjzbq5	2026-08-24 10:43:06.252406+00	2026-08-24 10:43:06.252406+00	\N
0fbc89c1-f1de-8cd0-abaf-a6881c401929	4x1b3b355h1g684i5a	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	button	This shirt has six buttons.	\N	Clothes	easy	\N	60	2985ws9flauvv	2026-08-24 10:43:06.254164+00	2026-08-24 10:43:06.254164+00	\N
0776f85d-da36-88ba-86ba-d7a1aeb9229b	2b0k5c6m5a591f5n30	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	ґудзик	This shirt has six buttons.	\N	Clothes	easy	\N	61	1oqbnlk1lot1j	2026-08-24 10:43:06.255866+00	2026-08-24 10:43:06.255866+00	\N
f4fccf84-7594-8ab7-ad24-959184667926	19130t28683o1q533o	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	size	What size do you need?	\N	Clothes	easy	\N	62	gky8d16d0399	2026-08-24 10:43:06.2575+00	2026-08-24 10:43:06.2575+00	\N
753283f9-0464-80a8-aaa4-cc70c15284ac	6h6f0k6i3p0v55411p	5143fe75-0dde-8625-a96a-888f7f33fea4	typed_answer	розмір	What size do you need?	\N	Clothes	easy	\N	63	1p0uj67sp8oqw	2026-08-24 10:43:06.259158+00	2026-08-24 10:43:06.259158+00	\N
51fda0f9-705b-8cd9-8582-879256383a87	6k0y1o3l1g6p660x0c	5143fe75-0dde-8625-a96a-888f7f33fea4	single_choice	Which item do you usually wear on your feet when running?	Trainers are sports shoes used for running and exercise.	\N	Clothes	easy	\N	64	3ltmdp8l0707b	2026-08-24 10:43:06.260915+00	2026-08-24 10:43:06.260915+00	\N
9070dbb9-0c94-88bc-9365-025d939eea7f	3u1u3i242t4z5c4g0p	5143fe75-0dde-8625-a96a-888f7f33fea4	single_choice	Which item keeps your hands warm in winter?	Gloves are worn on the hands.	\N	Clothes	easy	\N	65	226dvi6kgnibx	2026-08-24 10:43:06.261723+00	2026-08-24 10:43:06.261723+00	\N
d815296e-fc38-82e9-afe6-cdb07814ca9d	6o0k4e6e1v2f3a5o4c	5143fe75-0dde-8625-a96a-888f7f33fea4	multiple_choice	Select all items that are normally worn on the feet.	Boots, sandals, and trainers are footwear.	\N	Clothes	easy	\N	66	11strtyz8ko3r	2026-08-24 10:43:06.262564+00	2026-08-24 10:43:06.262564+00	\N
eb245695-0058-8d64-8443-0232a7b1a47d	3p195q1d2d1r3h432k	5143fe75-0dde-8625-a96a-888f7f33fea4	multiple_choice	Select all items often worn in cold weather.	A coat, gloves, and scarf help keep you warm.	\N	Clothes	easy	\N	67	2cn9bbcafx2p1	2026-08-24 10:43:06.263368+00	2026-08-24 10:43:06.263368+00	\N
853e9353-933b-853b-a927-92bde0685559	1r3s584x283x0t4y5t	5143fe75-0dde-8625-a96a-888f7f33fea4	true_false	A scarf is usually worn around the neck.	A scarf is worn around the neck.	\N	Clothes	easy	\N	68	3u4gypm6xhocb	2026-08-24 10:43:06.264201+00	2026-08-24 10:43:06.264201+00	\N
13d2b00b-9048-8726-810c-3aadfe70d16a	3i1j6v6x2b4d5x5b2j	5143fe75-0dde-8625-a96a-888f7f33fea4	true_false	You normally wear boots on your hands.	Boots are worn on the feet.	\N	Clothes	easy	\N	69	16ddcq39k9iyc	2026-08-24 10:43:06.265031+00	2026-08-24 10:43:06.265031+00	\N
398e6cd8-2e76-8eaa-a5bb-aaf85c5012fa	455157445j0d6n163a	5143fe75-0dde-8625-a96a-888f7f33fea4	cloze	Complete the sentence: My phone is in my ____.	A pocket can hold small objects.	\N	Clothes	easy	It is a small part of clothes used to carry things.	70	3r821p7v9ti4e	2026-08-24 10:43:06.265835+00	2026-08-24 10:43:06.265835+00	\N
96f6dc83-8585-87d1-9423-23d96c95ecba	2p2u4a1g0712041e0b	5143fe75-0dde-8625-a96a-888f7f33fea4	cloze	Complete the sentence: Put on your ____; it is cold outside.	A jacket or coat is worn over other clothes.	\N	Clothes	easy	Choose warm outer clothing.	71	1jjxu83qz1nqf	2026-08-24 10:43:06.266841+00	2026-08-24 10:43:06.266841+00	\N
c20b0f9e-379c-8dce-8596-1ea844d9bd0a	2v1u68591k2i4k0d6z	5143fe75-0dde-8625-a96a-888f7f33fea4	matching	Match each item with the part of the body where it is worn.	Each item is matched to where it is normally worn.	\N	Clothes	easy	\N	72	339rfsmsid1ha	2026-08-24 10:43:06.267641+00	2026-08-24 10:43:06.267641+00	\N
c466d667-35e4-85ff-9026-785bc93857dd	466t2n1g0i2s0t510r	5143fe75-0dde-8625-a96a-888f7f33fea4	matching	Match the English words with their Ukrainian translations.	\N	\N	Clothes	easy	\N	73	3iyrs1xvlrqgm	2026-08-24 10:43:06.268489+00	2026-08-24 10:43:06.268489+00	\N
f8b8bc29-6d69-8ba3-b600-42766f969edf	3l2223596k0l02263w	5143fe75-0dde-8625-a96a-888f7f33fea4	ordering	Put the words in order to make a correct sentence.	I am wearing a blue shirt.	\N	Getting dressed	easy	\N	74	1wsox6nzlwm7t	2026-08-24 10:43:06.269409+00	2026-08-24 10:43:06.269409+00	\N
0d89095f-c9e2-8c78-b4a6-3c05a9e00d21	5z6h3d4s6u36005r1k	5143fe75-0dde-8625-a96a-888f7f33fea4	ordering	Put the words in order to make a correct question.	What size do you need?	\N	Getting dressed	easy	\N	75	2lgcb4pw19j94	2026-08-24 10:43:06.270326+00	2026-08-24 10:43:06.270326+00	\N
f54ae8b5-f277-8127-80df-11f274168b39	04510k1m492q3q1b6w	26205776-4908-8a07-ac8e-aa997bd7b85e	typed_answer	кіт	\N	\N	\N	easy	тварина, муркоче	0	24dvmpx5emzis	2026-08-24 10:43:06.271085+00	2026-08-24 10:43:06.271085+00	\N
f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	1s055516186r0e355o	26205776-4908-8a07-ac8e-aa997bd7b85e	cloze	She has lived here ___ 2019.	since + точка в часі; for + тривалість	\N	\N	medium	\N	1	39azje8snzl80	2026-08-24 10:43:06.271946+00	2026-08-24 10:43:06.271946+00	\N
877742ee-5068-8db5-af02-6c30eefc4f2d	3d0l354w5m2b4l2216	26205776-4908-8a07-ac8e-aa997bd7b85e	ordering	Складіть питання	\N	\N	\N	medium	\N	2	3fvjxr2khaxo5	2026-08-24 10:43:06.272763+00	2026-08-24 10:43:06.272763+00	\N
29fa93aa-0d3c-8809-bd19-bbc794792ecf	2h6k1t0m21250b0o21	26205776-4908-8a07-ac8e-aa997bd7b85e	matching	З'єднайте слова	\N	\N	\N	easy	\N	3	3305rh0rmwpih	2026-08-24 10:43:06.273496+00	2026-08-24 10:43:06.273496+00	\N
eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	461p2l00210f3d4i30	09501038-b4de-8557-822b-a486db4bf004	single_choice	Хто і коли запропонував реляційну модель, на якій базується SQL?	Реляційну модель запропонував Edgar Codd у 1970 році: дані організовані у relations (у SQL — таблиці), де кожна relation є невпорядкованою колекцією tuples (рядків).	p. 26	Relational Model vs. Document Model	easy	Це була теоретична пропозиція, і багато хто сумнівався, що її можна ефективно реалізувати.	0	3mh7dsa6s6vtp	2026-08-24 10:43:06.274349+00	2026-08-24 10:43:06.274349+00	\N
d70b28a9-3b88-816a-b648-f7b6f382d310	6f6g636j1o254x4m0z	09501038-b4de-8557-822b-a486db4bf004	single_choice	Звідки насправді походить термін «NoSQL»?	Термін невдалий, бо не позначає жодної конкретної технології. Він задумувався просто як catchy Twitter hashtag для мітапу 2009 року, а згодом його ретроспективно переінтерпретували як «Not Only SQL».	p. 27	The birth of NoSQL	medium	Спочатку це взагалі не мало бути назвою класу технологій.	1	1s51xy45tgaxd	2026-08-24 10:43:06.275191+00	2026-08-24 10:43:06.275191+00	\N
2ed70fac-b9de-8eb3-8e75-d87d100fc2de	283l5y3g4b4l1p3l4g	09501038-b4de-8557-822b-a486db4bf004	multiple_choice	Які рушійні сили стояли за adoption NoSQL-баз даних (за Kleppmann)?	Книга перелічує саме ці чотири драйвери. ACID-транзакції — навпаки, сильна сторона реляційних БД; це не був аргумент за NoSQL.	p. 27	The birth of NoSQL	medium	\N	2	1lzb5bg1edia	2026-08-24 10:43:06.276+00	2026-08-24 10:43:06.276+00	\N
18f2dd47-df78-8767-bce8-d538e95faf7d	4o3z271f1k6147521d	09501038-b4de-8557-822b-a486db4bf004	single_choice	Що означає термін «polyglot persistence»?	Різні застосунки мають різні вимоги, тож найкращий вибір технології для одного use case може відрізнятися від іншого. Ідея, що реляційні БД співіснуватимуть з різноманітними нереляційними сховищами, і називається polyglot persistence.	p. 27	The birth of NoSQL	easy	\N	3	2bvk1abpf8hyo	2026-08-24 10:43:06.276755+00	2026-08-24 10:43:06.276755+00	\N
2ce73501-0026-8a1f-a2f3-179d11168257	135q0c02660m4l5b56	09501038-b4de-8557-822b-a486db4bf004	single_choice	Звідки запозичено термін «impedance mismatch», яким описують розрив між об'єктами в коді та таблицями в БД?	Термін узятий з електроніки: кожен електричний контур має певний impedance на входах і виходах. Передача потужності максимізується, коли impedance виходу й входу збігаються; невідповідність призводить до відбиття сигналу.	p. 28, footnote	The object-relational mismatch	medium	\N	4	2binhmquoyr7r	2026-08-24 10:43:06.277583+00	2026-08-24 10:43:06.277583+00	\N
dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	1j6l0m2m445j5e656v	09501038-b4de-8557-822b-a486db4bf004	true_false	ORM-фреймворки на кшталт ActiveRecord та Hibernate повністю усувають різницю між об'єктною та реляційною моделями.	ORM зменшують обсяг boilerplate-коду, потрібного для translation layer, але не можуть повністю приховати різницю між двома моделями.	p. 28	The object-relational mismatch	easy	\N	5	15i04cbwf9dem	2026-08-24 10:43:06.278415+00	2026-08-24 10:43:06.278415+00	\N
3c66d373-a56e-85b1-93cd-020a008b8464	1g6x1q4a5r514f0s3h	09501038-b4de-8557-822b-a486db4bf004	single_choice	Яку структуру даних утворюють one-to-many зв'язки в JSON-поданні резюме (positions, education, contact_info)?	One-to-many зв'язки від профілю користувача до його позицій, освіти та контактів імплікують деревоподібну структуру, і JSON-подання робить цю деревоподібність явною.	pp. 29–30, Figure 2-2	The object-relational mismatch	easy	\N	6	2i1u5el1wmvab	2026-08-24 10:43:06.279306+00	2026-08-24 10:43:06.279306+00	\N
f793c91f-f869-8b6e-84bc-6211307ac9cf	1m310a5x076u181c2h	09501038-b4de-8557-822b-a486db4bf004	single_choice	Яка головна перевага JSON-подання резюме порівняно з нормалізованою multi-table схемою?	У реляційному прикладі для отримання профілю треба або кілька запитів (по user_id до кожної таблиці), або незручний multi-way join. У JSON-поданні все в одному місці — вистачає одного запиту.	p. 29	The object-relational mismatch	medium	\N	7	2baf8d0hp779f	2026-08-24 10:43:06.280223+00	2026-08-24 10:43:06.280223+00	\N
29149c08-624b-8964-8532-e7bb888eafd3	3d356w0100420z6322	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	multiple_choice	Which commands correctly remove a file named `screen shot.png`?	Quote the path or escape its space so the shell passes one argument.	\N	Paths	easy	\N	22	m8e24cvqlmbs	2026-08-24 10:43:06.31558+00	2026-08-24 10:43:06.31558+00	\N
226ce076-a057-8ef8-a48e-0669ad379701	6s3k0q0w266g2f0o42	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	On macOS BSD utilities, `ls --help` may fail. What is the most portable way listed to open full documentation?	`man ls` works across these environments and uses pager navigation.	\N	Documentation	medium	\N	23	31pmvxem2vlcm	2026-08-24 10:43:06.316668+00	2026-08-24 10:43:06.316668+00	\N
0ce4ea40-2eed-8840-8112-99c462ed7b18	0m2e416b2q1v0j6z03	09501038-b4de-8557-822b-a486db4bf004	single_choice	Чому в прикладі резюме region_id та industry_id зберігаються як ID, а не як текстові рядки?	Перевага ID у тому, що він не має значення для людей і тому ніколи не потребує зміни. Будь-яка інформація, змістовна для людини, колись може змінитися — і якщо вона продубльована, усі копії треба оновити, що дає overhead на записах і ризик неузгодженості.	p. 32	Many-to-one and many-to-many relationships	medium	\N	8	1i1lz6pjigegv	2026-08-24 10:43:06.281005+00	2026-08-24 10:43:06.281005+00	\N
e98b134b-f43f-828b-8a1b-1dc45ca80c5d	2h4o3s1m0a4j592o0j	09501038-b4de-8557-822b-a486db4bf004	single_choice	Яку модель даних використовувала IBM IMS — найпопулярніша БД для business data processing у 1970-х?	IMS (спочатку розроблена для складського обліку в програмі Apollo, комерційно випущена 1968) використовувала hierarchical model, яка має разючу схожість із JSON-моделлю document-баз. Як і document-бази, вона добре працювала з one-to-many, але ускладнювала many-to-many і не підтримувала joins.	p. 35	Are document databases repeating history?	medium	\N	9	8fqaiqnuulqh	2026-08-24 10:43:06.281794+00	2026-08-24 10:43:06.281794+00	\N
c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	4l234y25661i0a200c	09501038-b4de-8557-822b-a486db4bf004	single_choice	Чим network (CODASYL) model відрізнялася від hierarchical model?	CODASYL-модель є узагальненням ієрархічної: у дереві кожен запис має рівно одного батька, а в network model запис може мати кілька батьків. Це дозволяло моделювати many-to-one і many-to-many зв'язки.	p. 36	The network model	medium	\N	10	1ldcvdgf02rhm	2026-08-24 10:43:06.282592+00	2026-08-24 10:43:06.282592+00	\N
56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	13084a0v2h5a382w2j	09501038-b4de-8557-822b-a486db4bf004	single_choice	Що таке «access path» у network (CODASYL) моделі?	Зв'язки в network model були радше вказівниками, ніж foreign keys. Єдиним способом дістатися до запису було пройти шлях від кореневого запису вздовж цих ланцюжків. Програміст мусив тримати всі ці шляхи в голові, а запит виконувався переміщенням курсора по базі.	p. 36	The network model	medium	\N	11	2r2omiuztnevr	2026-08-24 10:43:06.283516+00	2026-08-24 10:43:06.283516+00	\N
54936afa-d480-8098-9fb1-bdd4b2595a41	5h1q5a6g0463242l0v	09501038-b4de-8557-822b-a486db4bf004	single_choice	Який ключовий інсайт реляційної моделі щодо query optimizer наводить Kleppmann?	Query optimizers — складні звірі, на які пішли роки досліджень. Але ключова ідея: оптимізатор треба побудувати один раз, і всі застосунки отримають вигоду. Захардкодити access path під конкретний запит простіше, ніж написати універсальний оптимізатор — але універсальне рішення виграє в довгостроковій перспективі.	p. 37	The relational model	hard	\N	12	w1mr2wtz3avc	2026-08-24 10:43:06.284315+00	2026-08-24 10:43:06.284315+00	\N
333d31fd-565e-8488-ba3b-f94b61de08c3	0o4n2p5k395d5v6f51	09501038-b4de-8557-822b-a486db4bf004	true_false	Document-бази даних повторили шлях CODASYL: посилання між документами розв'язуються під час вставки (insert time).	Document-бази НЕ пішли шляхом CODASYL. У них, як і в реляційних БД, пов'язаний елемент адресується унікальним ідентифікатором (foreign key / document reference), який розв'язується під час читання — через join або follow-up запити. Саме в CODASYL join фактично виконувався на етапі вставки.	pp. 37–38	Comparison to document databases	hard	\N	13	y4g40zymi8ps	2026-08-24 10:43:06.285212+00	2026-08-24 10:43:06.285212+00	\N
cc8e248a-fee5-8e8e-aa52-c20970fec6ea	28390b005k354y3p12	09501038-b4de-8557-822b-a486db4bf004	single_choice	Чому термін «schemaless» щодо document-баз є оманливим, і який термін точніший?	Код, який читає дані, зазвичай припускає якусь структуру — тобто існує implicit schema, просто вона не enforced базою. Точніший термін — schema-on-read (структура інтерпретується під час читання) на противагу schema-on-write (традиційний підхід реляційних БД).	p. 39	Schema flexibility in the document model	medium	\N	14	33ufftjlxkljm	2026-08-24 10:43:06.28626+00	2026-08-24 10:43:06.28626+00	\N
7da3ea12-5863-8c58-99ac-cd058ab2634d	010k2w5w516q3m3h20	09501038-b4de-8557-822b-a486db4bf004	single_choice	З чим у мовах програмування Kleppmann порівнює schema-on-read та schema-on-write?	Schema-on-read подібна до динамічної типізації, а schema-on-write — до статичної. І так само, як прихильники статичної та динамічної типізації сперечаються про переваги, enforcement схем у БД є спірною темою без однозначно правильної відповіді.	p. 39	Schema flexibility in the document model	medium	\N	15	3mrksghmyc4jv	2026-08-24 10:43:06.287105+00	2026-08-24 10:43:06.287105+00	\N
c8e05d70-730c-88b0-b577-84e9649571c5	5r145a3w6i081k6y19	09501038-b4de-8557-822b-a486db4bf004	single_choice	Яка СУБД є винятком у тому, що ALTER TABLE виконується не за мілісекунди?	Репутація повільних міграцій не зовсім заслужена: більшість реляційних СУБД виконують ALTER TABLE за кілька мілісекунд. Виняток — MySQL, яка копіює всю таблицю, що на великій таблиці може означати хвилини або й години downtime. Існують інструменти, що обходять це обмеження.	p. 40	Schema flexibility in the document model	hard	\N	16	3iqeiquomd6p7	2026-08-24 10:43:06.287947+00	2026-08-24 10:43:06.287947+00	\N
67f3c878-5f15-81be-8806-3c9728b415d8	0b354i3w2z0b4o0r3q	09501038-b4de-8557-822b-a486db4bf004	multiple_choice	У яких ситуаціях підхід schema-on-read є вигіднішим?	Schema-on-read вигідна, коли дані гетерогенні. Але коли всі записи очікувано мають однакову структуру, схеми є корисним механізмом документування та enforcement цієї структури.	p. 40	Schema flexibility in the document model	medium	\N	17	n2nf3ep6870	2026-08-24 10:43:06.288805+00	2026-08-24 10:43:06.288805+00	\N
6e65f4d6-d90b-8157-9002-f7118f211efe	0c4e024j3z114x6z4o	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	What does `echo -n "ready"` change compared with plain `echo`?	`-n` suppresses the final newline.	\N	echo	easy	\N	24	3p0hiq0fnq8ob	2026-08-24 10:43:06.319432+00	2026-08-24 10:43:06.319432+00	\N
7b0be6e7-7d15-8d22-a99c-c008bee13204	1l4r1y0h4t5h3l2d5w	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	A script must print embedded newlines consistently in bash and zsh. Which is the best choice?	`printf` has consistent formatting behavior; `echo` escape handling varies between shells.	\N	printf	medium	\N	25	3jmaihtnndqf	2026-08-24 10:43:06.321725+00	2026-08-24 10:43:06.321725+00	\N
0ab8254c-c04e-88ba-8bc4-bc089b0912a3	1k680r5422686s5l1g	09501038-b4de-8557-822b-a486db4bf004	multiple_choice	Які системи, крім document-баз, реалізують ідею групування пов'язаних даних заради locality?	Ідея групування пов'язаних даних заради locality не обмежується документною моделлю: Spanner дає ті самі властивості locality в реляційній моделі через interleaved rows, Oracle — через multi-table index cluster tables, а Bigtable — через column families.	pp. 40–41	Data locality for queries	hard	\N	18	n78tvdgz700w	2026-08-24 10:43:06.289662+00	2026-08-24 10:43:06.289662+00	\N
cde1048f-b752-8b92-8d91-ba64737e534e	32160e6r5o2d0j063h	09501038-b4de-8557-822b-a486db4bf004	true_false	Перевага locality в document-базах діє завжди, незалежно від того, яку частину документа ви читаєте.	Перевага locality діє лише тоді, коли вам потрібні великі частини документа одночасно. БД зазвичай мусить завантажити весь документ, навіть якщо ви звертаєтеся до малої його частини — що марнотратно на великих документах. Крім того, при оновленні документ зазвичай переписується цілком. Тому рекомендується тримати документи невеликими.	p. 40	Data locality for queries	medium	\N	19	3vuh7qt4j7age	2026-08-24 10:43:06.290534+00	2026-08-24 10:43:06.290534+00	\N
3dc0172a-bad6-89de-8207-cff14f2b95f5	143622012b2x5j490d	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Which command prints the absolute path of the current working directory?	`pwd` prints the current working directory as an absolute path.	\N	Navigation	easy	\N	0	2k31ql3sygf71	2026-08-24 10:43:06.291393+00	2026-08-24 10:43:06.291393+00	\N
1ec19a39-3492-8435-a404-bc53f87dc33a	1r0e547148562e490t	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	multiple_choice	What does `ls -lah` request?	`-l` is long format, `-a` includes hidden entries, and `-h` makes sizes human-readable.	\N	ls	easy	\N	1	27zfuu53j1osk	2026-08-24 10:43:06.292375+00	2026-08-24 10:43:06.292375+00	\N
fa190593-0f0f-872c-9dc0-88516b47f762	3z71464y443h5i1g5b	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	You want hidden entries but do not want `.` and `..` in the output. Which command is best?	`-A` includes hidden entries while omitting `.` and `..`.	\N	ls	medium	\N	2	111hwe45a065m	2026-08-24 10:43:06.293399+00	2026-08-24 10:43:06.293399+00	\N
c4ccdb06-8158-8298-a9fe-33d186ee146e	5s4r2g280q6o264l17	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	true_false	In this material, `ls -h` is useful for file sizes only when combined with long format (`-l`).	Human-readable sizes appear in the size column provided by long format.	\N	ls	easy	\N	3	38sjk9tjmok3c	2026-08-24 10:43:06.294299+00	2026-08-24 10:43:06.294299+00	\N
e36595fa-b28d-8cf0-916e-d8b649288822	4q68566q0s2f0o575z	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write the command that switches back to the previous working directory.	`cd -` toggles between the current and previous directories.	\N	cd	easy	\N	4	sjbd9t5ksqhv	2026-08-24 10:43:06.295149+00	2026-08-24 10:43:06.295149+00	\N
0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	166m6g3o6t5562684p	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	multiple_choice	Which commands take you to your home directory?	Both `cd` without arguments and `cd ~` select the home directory.	\N	cd	easy	\N	5	2aryqz26z1u41	2026-08-24 10:43:06.296202+00	2026-08-24 10:43:06.296202+00	\N
efa69e8b-d383-8371-b742-716e644512f4	1n1p6g2f5h684x431h	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which path is absolute?	An absolute Unix path begins at `/`.	\N	Paths	easy	\N	6	2hv4ypbumq536	2026-08-24 10:43:06.297269+00	2026-08-24 10:43:06.297269+00	\N
8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	1q4q6c73516g4n565z	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	What does `cat first.txt second.txt` print?	`cat` concatenates the supplied files in order.	\N	cat	easy	\N	7	2d0k7nfsn18b2	2026-08-24 10:43:06.298215+00	2026-08-24 10:43:06.298215+00	\N
fef1cb06-7f6a-8698-a69a-6d9895bf82bf	5o3l37582u0a2e4m2a	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write the command that prints `notes.txt` with numbered output lines.	`cat -n` numbers output lines.	\N	cat	easy	\N	8	34h2cm3jlpatl	2026-08-24 10:43:06.299216+00	2026-08-24 10:43:06.299216+00	\N
81e06311-a749-8c85-b477-4c2c213c0db5	6y5m160p214v1w5k4k	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	A text file looks normal but may contain tabs or unusual line endings. Which command from the material helps reveal invisible characters?	`cat -A` displays normally invisible characters.	\N	cat	medium	\N	9	31kn2gu3k7bfa	2026-08-24 10:43:06.30011+00	2026-08-24 10:43:06.30011+00	\N
09be3ff3-1403-891d-aea7-d6ae41a62bc8	4r2k2q511n4w6l0l40	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which command opens `server.log` in a pager and shows line numbers?	For `less`, uppercase `-N` displays line numbers.	\N	less	easy	\N	10	ngtuz4fw10qq	2026-08-24 10:43:06.301026+00	2026-08-24 10:43:06.301026+00	\N
d9606bee-fed2-8305-8fc4-18117c0dcba3	15202j580i3h500241	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	matching	Match each key used inside `less` to its action.	These navigation keys also work in `man`, which commonly uses `less`.	\N	less	medium	\N	11	2j6jdavfvo1u5	2026-08-24 10:43:06.3033+00	2026-08-24 10:43:06.3033+00	\N
27b0780a-72a9-898b-95b6-593afbb151f5	6c433i3z1w1c5l3l47	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write a command that creates `apps/api/src/new-module`, including any missing parent directories.	`mkdir -p` creates missing parents and does not fail merely because a directory already exists.	\N	mkdir	easy	\N	12	1djoe5cpvpkmn	2026-08-24 10:43:06.304686+00	2026-08-24 10:43:06.304686+00	\N
70200632-c1de-8d49-babd-170d2b896826	6z4a0i1k426q5n4p6l	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Using brace expansion, create both `packages/nodes/src/http` and `packages/nodes/src/webhook` with one command.	Brace expansion generates both path variants before `mkdir` runs.	\N	mkdir	medium	\N	13	3al70fjycg9rl	2026-08-24 10:43:06.305637+00	2026-08-24 10:43:06.305637+00	\N
762cd5b1-d4fa-833f-9f7a-5d64162d960d	48503c1y4z4n533v07	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	true_false	Running `touch existing.md` normally replaces the file contents with an empty file.	For an existing file, `touch` updates timestamps; creating an empty file is only a side effect when the path is missing.	\N	touch	easy	\N	14	32j6lhq131lqw	2026-08-24 10:43:06.306575+00	2026-08-24 10:43:06.306575+00	\N
1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	2q6i2i3e406p2a3z5z	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which command copies the directory `prisma` recursively to `../archive/prisma-snapshot`?	Directories require recursive copying with `cp -r`.	\N	cp	easy	\N	15	2g3eyzypmsz0t	2026-08-24 10:43:06.30751+00	2026-08-24 10:43:06.30751+00	\N
d9cf128e-ecea-8533-b85c-eab045522b9a	5j6y1t1e5g311d3v12	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	matching	Match the `cp` option to its overwrite behavior.	\N	\N	cp	easy	\N	16	wrc11dq41tac	2026-08-24 10:43:06.308476+00	2026-08-24 10:43:06.308476+00	\N
64fabd3d-6863-8422-907a-250c3ab5b289	173o31686o130x6n72	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write the command that renames `old.md` to `new.md`.	`mv` performs both moves and renames.	\N	mv	easy	\N	17	1xtvfzqkmevfx	2026-08-24 10:43:06.309388+00	2026-08-24 10:43:06.309388+00	\N
0ba44dfc-8221-8888-ba76-ac30a34ca3a1	6k5836591b4y71636s	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	In `mv a.md b.md target-dir/`, what must the last argument represent?	When moving several sources, the final argument must be the destination directory.	\N	mv	medium	\N	18	1nxda4e5ou04g	2026-08-24 10:43:06.310776+00	2026-08-24 10:43:06.310776+00	\N
48dfcd45-c54f-8827-930f-786dfe516c63	2g0k5m1x6d4v3r1c3f	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	true_false	By default, `mv` always asks before overwriting an existing destination.	Default `mv` may overwrite silently; use `-i` to prompt or `-n` to refuse overwrites.	\N	mv	medium	\N	19	11mfxhf3ila92	2026-08-24 10:43:06.312088+00	2026-08-24 10:43:06.312088+00	\N
c73ca850-0c62-8370-bb20-ff10b9ef8ed1	551z1f493m3b2n0t1h	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	You intend to remove a non-empty directory tree named `old-folder`. Which command does that forcefully?	`-r` recurses into directories and `-f` suppresses prompts and missing-file errors.	\N	rm	easy	\N	20	2zn13f6a654un	2026-08-24 10:43:06.313011+00	2026-08-24 10:43:06.313011+00	\N
4a0f96f0-653a-81df-a77c-384300dade32	2e3h4z5f4j4t1k3i10	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which option asks for confirmation before each deletion?	`rm -i` prompts before each removal.	\N	rm	easy	\N	21	1tjn5je4wmy9	2026-08-24 10:43:06.314664+00	2026-08-24 10:43:06.314664+00	\N
e6efc7ff-23ee-8457-8254-8d01416835a2	4z644j3j5z0p546m02	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Why would you write `<< 'EOF'` with a quoted delimiter?	Quoting the heredoc delimiter disables shell substitution in the body.	\N	Heredoc	medium	\N	26	hz6v2yf8rtxm	2026-08-24 10:43:06.322873+00	2026-08-24 10:43:06.322873+00	\N
1870667a-01ad-8bb2-9ff1-243c8b27ae5a	3s4j0c272d3e6y5l4v	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	true_false	With an unquoted delimiter such as `<< EOF`, the shell can expand variables and command substitutions inside the heredoc.	\N	\N	Heredoc	medium	\N	27	2vdt7qf9q1obt	2026-08-24 10:43:06.324109+00	2026-08-24 10:43:06.324109+00	\N
52ba481c-097d-8cea-bb3f-9f43ed2b2be1	675a04715r2o1i1l2r	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	multiple_choice	Which conditions must the ordinary heredoc closing word satisfy?	The delimiter word is arbitrary, but its closing occurrence must match exactly.	\N	Heredoc	medium	\N	28	848zgetfdn5f	2026-08-24 10:43:06.325075+00	2026-08-24 10:43:06.325075+00	\N
c1f0db99-722f-8a49-afef-939116ea9e24	0x0p0f500v1d2e206e	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	What does `<<-EOF` strip from the beginning of heredoc lines?	The dash form strips leading tab characters, not spaces.	\N	Heredoc	hard	\N	29	19d9u0eqw3n2c	2026-08-24 10:43:06.325994+00	2026-08-24 10:43:06.325994+00	\N
0f67d24b-0a4f-8acb-9858-1cf7db90f854	1v6l2u2g6w08165l2u	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which construct feeds the single JSON string directly to `jq` as stdin?	`<<<` is a here-string: a one-line value supplied as stdin.	\N	Herestring	medium	\N	30	xsd23jtgx87c	2026-08-24 10:43:06.326926+00	2026-08-24 10:43:06.326926+00	\N
28d48723-0ad1-8ffa-804a-fa45f0bfda83	4g0r1f5a4m296x4w26	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write the shortest shell command that empties `app.log` without deleting the file.	Redirection truncates the existing file while keeping its identity and permissions.	\N	Truncation	easy	\N	31	12dpw9r76dbbu	2026-08-24 10:43:06.328547+00	2026-08-24 10:43:06.328547+00	\N
94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	1s1v0j192d6r6t4x2p	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Why is `rm app.log && touch app.log` a poor way to empty a live log?	Truncation preserves the original file object; delete-and-recreate does not.	\N	Truncation	hard	\N	32	3dy0wgppdz7g0	2026-08-24 10:43:06.329446+00	2026-08-24 10:43:06.329446+00	\N
518b33e1-4334-8a58-84b1-0dd99cdac6ce	1k121s2g0i1h32625b	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	What does the pipe operator `|` do?	\N	\N	Pipes	easy	\N	33	33hajxfz1dn0a	2026-08-24 10:43:06.330368+00	2026-08-24 10:43:06.330368+00	\N
cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	2x5z5x3e603o5t1y06	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	What happens before output is written by `command > result.txt`?	`>` redirects stdout and overwrites the destination.	\N	Redirection	easy	\N	34	7dcxltap2mnm	2026-08-24 10:43:06.331353+00	2026-08-24 10:43:06.331353+00	\N
1789be8f-08a0-8c7d-ad5a-ca56c5070b12	596n691k65296d5d1g	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which operator appends stdout while preserving the existing file contents?	\N	\N	Redirection	easy	\N	35	1duy597rpq0kr	2026-08-24 10:43:06.33228+00	2026-08-24 10:43:06.33228+00	\N
ee033d47-a447-8c33-8f22-da9c2c1139ba	3p4x5b503c5j6v5j6h	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	matching	Match the standard stream to its file descriptor.	\N	\N	Streams	easy	\N	36	2av8wey88ol2n	2026-08-24 10:43:06.333274+00	2026-08-24 10:43:06.333274+00	\N
b08dcd53-dc0a-8705-a742-6e4c50302aa5	5m5c3p203e716c5d0s	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write a command that lists `exists.txt` and `missing.txt`, saving normal output in `out.txt` and errors in `err.txt`.	Redirect stdout and stderr independently.	\N	Streams	medium	\N	37	15nrahulv3og6	2026-08-24 10:43:06.334532+00	2026-08-24 10:43:06.334532+00	\N
902657f7-edd5-828f-8768-56e35f1166b6	083c04332x0m2e3q1u	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write the portable redirection that saves both stdout and stderr from `command` into `both.txt`.	First point stdout at the file, then point stderr at stdout's current destination.	\N	Streams	medium	\N	38	25zivpif1nunn	2026-08-24 10:43:06.335534+00	2026-08-24 10:43:06.335534+00	\N
f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	2c6o1f5u1l3e4n5m2g	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	What happens with `command 2>&1 > file.txt`?	Redirections are applied left to right, so order matters.	\N	Streams	hard	\N	39	1znsfptm0g0cf	2026-08-24 10:43:06.33653+00	2026-08-24 10:43:06.33653+00	\N
f63867aa-4dea-82bd-b5f4-def14df0b116	4f2y1h472p4u1x1w2p	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	true_false	`&> file` is convenient in bash and zsh, but `> file 2>&1` is more portable for plain `sh` scripts.	\N	\N	Streams	medium	\N	40	1utcdor3t3mzn	2026-08-24 10:43:06.337483+00	2026-08-24 10:43:06.337483+00	\N
98200032-2db8-8e2d-b646-f885d9ca4259	5g0r3b1g6u0v0o2t2z	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	You need results from `find / -name "*.conf"` but want to hide permission errors. Which command is appropriate?	Send only stderr (descriptor 2) to `/dev/null`.	\N	Streams	medium	\N	41	pobds423dswq	2026-08-24 10:43:06.338509+00	2026-08-24 10:43:06.338509+00	\N
251ffd80-870d-8f7b-b149-aaa077b66e47	0q460q6g52720c274y	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Why does `wc -l < file.txt` normally print only a number, while `wc -l file.txt` may also print the filename?	\N	\N	stdin	medium	\N	42	qvz7403pmoy8	2026-08-24 10:43:06.339492+00	2026-08-24 10:43:06.339492+00	\N
fffb38a6-067b-8733-bc78-3162c40cbf6a	4m0c130o2x4j046n5v	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write a command that prints the first 3 lines of `notes.txt`.	`head` defaults to 10 lines; `-n 3` selects three.	\N	head	easy	\N	43	2ujs081eo4722	2026-08-24 10:43:06.341293+00	2026-08-24 10:43:06.341293+00	\N
c1b61b3f-d9ea-87db-a256-3e5ab2686e53	4z0g001r5c1d1j3t4c	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write the everyday command that follows `app.log` and prints new lines as they are appended.	`tail -f` keeps running until interrupted, commonly with Ctrl+C.	\N	tail	easy	\N	44	3dphaxsaufnjh	2026-08-24 10:43:06.342348+00	2026-08-24 10:43:06.342348+00	\N
6ea13554-4f77-8120-a798-703b4efcd29c	1a6o076u5y3b4d3w2f	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which statement correctly distinguishes `wc -c` and `wc -m`?	They can differ for multibyte text such as Cyrillic.	\N	wc	medium	\N	45	1cu0128dofp5k	2026-08-24 10:43:06.343214+00	2026-08-24 10:43:06.343214+00	\N
b206788a-01b9-8fd2-bd71-a2c9415ba174	156m572i49510l4m2h	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	You want matching error lines saved to `errors.txt` and displayed on screen. Which pipeline does both?	`tee` splits stdin to a file and stdout.	\N	tee	easy	\N	46	vs18o1bsfaao	2026-08-24 10:43:06.344717+00	2026-08-24 10:43:06.344717+00	\N
cf13f13c-e8e9-8c93-858a-4df6a31c258c	0t2m0x0i516i383d4d	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Which is the cleaner equivalent of `cat logs/api.log | grep ERROR` when only one file is read?	`grep` reads files directly; `cat` is useful in a pipe when actually concatenating several inputs.	\N	Pipes	medium	\N	47	2oti62jbwhm5f	2026-08-24 10:43:06.345821+00	2026-08-24 10:43:06.345821+00	\N
e0d32edc-4908-83e4-805f-8945c738605c	2x0o4p0z104n5w3f4d	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	single_choice	Why can `grep INFO log.txt > log.txt` destroy the data?	\N	\N	Redirection safety	hard	\N	48	okxd6qhj37f5	2026-08-24 10:43:06.346848+00	2026-08-24 10:43:06.346848+00	\N
547d8cd7-55dc-81ed-8dd4-ed5f115ea42b	2m6218135g0r3b494a	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	typed_answer	Write the safe two-step command from the material that keeps only `INFO` lines in `log.txt` using a temporary file.	Write to a different file, and replace the original only if `grep` succeeds.	\N	Redirection safety	hard	\N	49	165u1zelidnoq	2026-08-24 10:43:06.347839+00	2026-08-24 10:43:06.347839+00	\N
\.


--
-- Data for Name: quiz_attachments; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.quiz_attachments (page_id, quiz_id, "position", created_at) FROM stdin;
\.


--
-- Data for Name: quizzes; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.quizzes (id, legacy_id, page_id, title, description, language, source, source_chapters, tags, status, visibility, version, created_at, updated_at, published_at, archived_at, deleted_at) FROM stdin;
b1177332-3109-8cdb-ab5e-942bf9c85ef7	125p4d73655q1a2n41	c39ee411-b12e-809c-b29e-7999049fa199	SQLite: основи	Демонстраційний набір для першого запуску	uk	\N	\N	{demo,sqlite}	published	private	0	2026-08-08 10:09:31.117+00	2026-08-14 20:12:31.113+00	2026-08-08 10:09:31.124+00	\N	\N
09501038-b4de-8557-822b-a486db4bf004	5q6o4l4b034c534k16	\N	DDIA — Розділ 2: Data Models and Query Languages	Тест за другим розділом книги Martin Kleppmann «Designing Data-Intensive Applications»: реляційна vs документна модель, історія IMS/CODASYL, schema-on-read, декларативні vs імперативні мови запитів, MapReduce, графові моделі (Cypher, SPARQL, Datalog).	uk	Martin Kleppmann — Designing Data-Intensive Applications (O'Reilly, Early Release)	Chapter 2: Data Models and Query Languages (pp. 25–62)	{ddia,databases,data-models,sql,nosql,graph-databases,system-design}	published	private	0	2026-08-08 10:41:26.358+00	2026-08-13 20:58:03.705+00	2026-08-13 20:58:03.705+00	\N	\N
26205776-4908-8a07-ac8e-aa997bd7b85e	4w0i2358170i5v154v	37456bb3-acb6-866f-80e0-e3cf3ad36ac5	A1: перші слова	\N	en	\N	\N	{}	published	private	0	2026-08-15 05:59:41.227+00	2026-08-15 05:59:41.233+00	2026-08-15 05:59:41.233+00	\N	\N
bcd84e48-222b-887e-9937-ee30570c01ba	3g5r5z6m2a164r3j73	37456bb3-acb6-866f-80e0-e3cf3ad36ac5	A1 Food Vocabulary	Learn 25 essential A1 English food words with English–Ukrainian matching and typed translation practice in both directions.	English / Ukrainian	A1 everyday food vocabulary	\N	{A1,English,Ukrainian,food,vocabulary}	published	private	0	2026-08-17 17:20:57.064+00	2026-08-17 17:22:15.963+00	2026-08-17 17:22:15.963+00	\N	\N
5143fe75-0dde-8625-a96a-888f7f33fea4	4d0q075t0n1u5y3b34	37456bb3-acb6-866f-80e0-e3cf3ad36ac5	A1 Clothes Vocabulary	Basic A1 English vocabulary about clothes, shoes, accessories, and getting dressed. Includes English–Ukrainian vocabulary practice and mixed question types.	English / Ukrainian	Custom A1 vocabulary set	\N	{A1,vocabulary,clothes,English,Ukrainian}	published	private	0	2026-08-19 21:38:47.745+00	2026-08-19 21:40:41.548+00	2026-08-19 21:40:41.548+00	\N	\N
399d7d59-7f36-8c81-b878-ffd73a0c830b	2w06194c6r3w660r60	90760bed-788c-8aad-9e00-96bcdba1851d	Chapter 01 — Practical Review	Meaningful review of reliability, scalability, performance, and maintainability, with practical system-design scenarios.	English	Designing Data-Intensive Applications (Martin Kleppmann, 2017)	Chapter 1 — Reliable, Scalable and Maintainable	{DDIA,databases,system-design,chapter-1}	published	private	0	2026-08-20 17:46:56.821+00	2026-08-20 17:50:33.981+00	2026-08-20 17:50:33.981+00	\N	\N
078d0047-2b60-8c52-8b81-e0ebf4b3c79a	273j06520o4y435i1w	f2c2932f-b4f4-85a0-b9d5-98f2b507525d	Chapter 02 — Relational, Document and Query Models	Review of Chapter 2 up to, but excluding, Graph-Like Data Models. Focuses on choosing data models and query styles in realistic applications.	English	Designing Data-Intensive Applications (Martin Kleppmann, 2017)	Chapter 2 — from the beginning through MapReduce Querying; excludes Graph-Like Data Models	{DDIA,data-models,query-languages,chapter-2}	published	private	0	2026-08-20 17:47:02.283+00	2026-08-20 17:50:37.053+00	2026-08-20 17:50:37.053+00	\N	\N
0d02bfdf-2283-8b2a-8ea3-e54883dbab53	6b2z353r6o55477350	3d119068-f214-8c9e-9f7d-ec0614dafe0d	Shell Commands — Basics 1	Navigation, files, output, heredocs, pipes, redirects, and stream handling. Includes syntax recall and practical scenarios.	English	User-provided Notion export: Basics — Shell Commands v1	Levels 1, 1.5, and 2	{linux,shell,command-line,bash,terminal}	published	private	0	2026-08-23 08:44:33.943+00	2026-08-23 08:51:22.453+00	2026-08-23 08:51:22.453+00	\N	\N
8d50a017-1da9-8de5-bf68-ffcbebad128f	38310v595r3n363q07	3d119068-f214-8c9e-9f7d-ec0614dafe0d	Shell Commands — Basics 2	Search, processes, ports, jobs, disk usage, timing, and macOS/Linux differences. Includes syntax recall and practical scenarios.	English	User-provided Notion export: Basics — Shell Commands v1	Levels 3 and 4; macOS vs Linux	{linux,shell,command-line,bash,terminal}	published	private	0	2026-08-23 08:44:36.979+00	2026-08-23 08:51:18.85+00	2026-08-23 08:51:18.85+00	\N	\N
\.


--
-- Data for Name: responses; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.responses (attempt_id, question_id, selected_option_ids, is_correct, typed_answer, skipped, credit_earned, credit_possible, answered_at) FROM stdin;
a6a89c01-6161-8a73-a229-d32d06d52b87	818c6acd-d71c-884f-b789-200afa196196	{f7b8782a-59a1-8859-a8b5-0f6c014994da}	t	\N	f	\N	\N	2026-08-08 10:11:19.4+00
a6a89c01-6161-8a73-a229-d32d06d52b87	cd281ab2-0b80-8059-ac87-cca56165b018	{8f5ccff6-6356-851b-8e80-abbcfb223b64}	f	\N	f	\N	\N	2026-08-08 10:11:31.575+00
a6a89c01-6161-8a73-a229-d32d06d52b87	bd1b441b-be06-815e-a8ef-438fa70764ad	{77cbd3a0-af1c-876c-8266-078397991108,e5c7b203-f6b4-8924-9d03-b88c6274c523}	t	\N	f	\N	\N	2026-08-08 10:12:03.659+00
fdde0f4b-347c-84da-87a8-425d55dac234	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	\N	\N	2026-08-08 10:18:15.482+00
7c3cf6f6-b2d5-8275-a5cf-3195553052e3	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	\N	\N	2026-08-08 10:18:40.292+00
18411bac-36b2-847e-bf65-7c7e5f66e7c8	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	\N	\N	2026-08-08 10:20:50.519+00
a0089e72-2cc5-8625-88b3-7fffd4f89e07	818c6acd-d71c-884f-b789-200afa196196	{f7b8782a-59a1-8859-a8b5-0f6c014994da}	t	\N	f	\N	\N	2026-08-08 10:21:07.581+00
a0089e72-2cc5-8625-88b3-7fffd4f89e07	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	\N	\N	2026-08-08 10:21:11.192+00
a4b71692-5d80-86b4-a447-4b420635b696	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	{a27a3deb-9cf7-8135-882c-7fa64fa2568e}	t	\N	f	\N	\N	2026-08-13 21:33:23.325+00
a4b71692-5d80-86b4-a447-4b420635b696	d70b28a9-3b88-816a-b648-f7b6f382d310	{8e8b6f02-d0c5-808b-89eb-319aa16a876d}	t	\N	f	\N	\N	2026-08-13 21:33:30.822+00
a4b71692-5d80-86b4-a447-4b420635b696	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	{ad36351a-0934-8654-b171-b43d16f68069,981825df-2184-84f4-bb5b-e2f276a516d8}	f	\N	f	\N	\N	2026-08-13 21:34:36.235+00
a4b71692-5d80-86b4-a447-4b420635b696	18f2dd47-df78-8767-bce8-d538e95faf7d	{250a3377-e394-8b26-829d-6f0a2771323d}	t	\N	f	\N	\N	2026-08-13 21:35:06.715+00
a4b71692-5d80-86b4-a447-4b420635b696	2ce73501-0026-8a1f-a2f3-179d11168257	{24166966-72f1-8646-9cb5-1f3ec4370377}	f	\N	f	\N	\N	2026-08-13 21:35:29.336+00
a4b71692-5d80-86b4-a447-4b420635b696	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	{69f3eb9b-8b94-8f3e-a422-b0839114640e}	t	\N	f	\N	\N	2026-08-13 21:35:38.701+00
a4b71692-5d80-86b4-a447-4b420635b696	3c66d373-a56e-85b1-93cd-020a008b8464	{a18b17b6-0d78-8e6d-a1af-0a9afc115296}	f	\N	f	\N	\N	2026-08-13 21:35:59.886+00
a4b71692-5d80-86b4-a447-4b420635b696	f793c91f-f869-8b6e-84bc-6211307ac9cf	{43929f95-2cba-862c-844f-7282e5c1558b}	t	\N	f	\N	\N	2026-08-13 21:36:34.668+00
a4b71692-5d80-86b4-a447-4b420635b696	0ce4ea40-2eed-8840-8112-99c462ed7b18	{b4b63c25-0db4-85f7-a93b-a09e6d282f69}	f	\N	f	\N	\N	2026-08-13 21:36:38.465+00
a4b71692-5d80-86b4-a447-4b420635b696	e98b134b-f43f-828b-8a1b-1dc45ca80c5d	{5fd1850e-b5aa-865e-88e9-cab883ae7849}	f	\N	f	\N	\N	2026-08-13 21:36:39.852+00
a4b71692-5d80-86b4-a447-4b420635b696	c030dbb9-8761-8ad7-b1e0-d15f10b7a88b	{13fb0482-239b-827f-af6b-382a7b3a613c}	f	\N	f	\N	\N	2026-08-13 21:36:41.137+00
a4b71692-5d80-86b4-a447-4b420635b696	56ec85fe-0db8-8cd3-b0ca-c0a4583638cf	{e4826c06-1aa5-8af5-abd5-91fc2affc9ea}	f	\N	f	\N	\N	2026-08-13 21:36:42.324+00
a4b71692-5d80-86b4-a447-4b420635b696	54936afa-d480-8098-9fb1-bdd4b2595a41	{a38682a7-3a95-8f17-8425-dc54b14e158e}	f	\N	f	\N	\N	2026-08-13 21:36:47.06+00
a4b71692-5d80-86b4-a447-4b420635b696	333d31fd-565e-8488-ba3b-f94b61de08c3	{71546067-69fa-89e2-a0c7-82dda2d85c43}	f	\N	f	\N	\N	2026-08-13 21:36:50.771+00
a4b71692-5d80-86b4-a447-4b420635b696	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	{16952390-ade1-89d1-80f8-a4ec8c2d510b}	f	\N	f	\N	\N	2026-08-13 21:36:54.532+00
a4b71692-5d80-86b4-a447-4b420635b696	7da3ea12-5863-8c58-99ac-cd058ab2634d	{2efe7a99-6e78-8d84-82d0-4acff0a10a65}	t	\N	f	\N	\N	2026-08-13 21:36:56.583+00
a4b71692-5d80-86b4-a447-4b420635b696	c8e05d70-730c-88b0-b577-84e9649571c5	{12abefcf-d83f-817e-8317-4c1f0d2dc50b}	f	\N	f	\N	\N	2026-08-13 21:36:58.336+00
4e06b8e2-17f5-81b7-a005-ab25fba57273	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	\N	\N	2026-08-13 21:37:36.331+00
0ec954e6-f87e-8960-bd30-cae65914bf75	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	cat	f	\N	\N	2026-08-15 06:00:03.476+00
0ec954e6-f87e-8960-bd30-cae65914bf75	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	since	f	\N	\N	2026-08-15 06:00:03.478+00
0ec954e6-f87e-8960-bd30-cae65914bf75	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	\N	\N	2026-08-15 06:00:03.48+00
0ec954e6-f87e-8960-bd30-cae65914bf75	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	\N	\N	2026-08-15 06:00:03.481+00
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	cat	f	\N	\N	2026-08-15 06:00:09.823+00
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	since	f	\N	\N	2026-08-15 06:00:09.825+00
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	\N	\N	2026-08-15 06:00:09.827+00
d8065e88-253d-8aa0-bb6a-3ddc08d4dd74	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	\N	\N	2026-08-15 06:00:09.829+00
e46047f8-4046-8118-ba3c-e75fd4a26530	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	cat	f	\N	\N	2026-08-15 06:05:29.575+00
e46047f8-4046-8118-ba3c-e75fd4a26530	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	Since	f	\N	\N	2026-08-15 06:05:36.625+00
e46047f8-4046-8118-ba3c-e75fd4a26530	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,acb65390-c6f1-849c-b5a0-46de7250b519,eefabbdc-a4c6-8523-b585-ddb5e01280e6}	f	\N	f	\N	\N	2026-08-15 06:05:57.707+00
e46047f8-4046-8118-ba3c-e75fd4a26530	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	\N	\N	2026-08-15 06:06:14.76+00
7200bb9e-1034-8cdf-8428-0a820505b77c	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	Cat	f	\N	\N	2026-08-15 06:06:43.652+00
7200bb9e-1034-8cdf-8428-0a820505b77c	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	f	\N	t	\N	\N	2026-08-15 06:06:45.669+00
7200bb9e-1034-8cdf-8428-0a820505b77c	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	\N	\N	2026-08-15 06:07:01.484+00
7200bb9e-1034-8cdf-8428-0a820505b77c	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	\N	\N	2026-08-15 06:07:20.848+00
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	f54ae8b5-f277-8127-80df-11f274168b39	{}	f	\N	t	\N	\N	2026-08-15 17:42:52.916+00
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	since	f	\N	\N	2026-08-15 17:42:58.62+00
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	\N	\N	2026-08-15 17:43:14.406+00
cf7ee706-8ad6-89b2-8427-83d9bd8cc870	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	\N	\N	2026-08-15 17:43:22.489+00
897a1223-9340-84bb-9c7c-09cef22cfeea	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	Cat	f	\N	\N	2026-08-15 17:43:44.66+00
897a1223-9340-84bb-9c7c-09cef22cfeea	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	since	f	\N	\N	2026-08-15 17:43:51.984+00
897a1223-9340-84bb-9c7c-09cef22cfeea	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	\N	\N	2026-08-15 17:44:14.901+00
897a1223-9340-84bb-9c7c-09cef22cfeea	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,3c94f1d2-759c-855f-a3eb-9668da53d50d,c12fc1a5-58b6-81ac-b191-4481c65417cb,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	f	\N	f	\N	\N	2026-08-15 17:44:22.991+00
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	f54ae8b5-f277-8127-80df-11f274168b39	{}	f	\N	t	0	1	2026-08-15 18:25:47.184+00
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	f	\N	t	0	1	2026-08-15 18:25:50.668+00
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,acb65390-c6f1-849c-b5a0-46de7250b519,eefabbdc-a4c6-8523-b585-ddb5e01280e6}	f	\N	f	0	1	2026-08-15 18:25:58.943+00
dce6bc30-d3f3-8e1a-8c74-cd96cfa5eb91	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,5a5c5c5f-526f-8f34-9358-915221e5c47a,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8}	f	\N	f	1	3	2026-08-15 18:26:10.27+00
d3c237c7-4d8f-86dc-99e3-d692ab10a8d8	818c6acd-d71c-884f-b789-200afa196196	{f7b8782a-59a1-8859-a8b5-0f6c014994da}	t	\N	f	1	1	2026-08-15 20:47:06.474+00
d3c237c7-4d8f-86dc-99e3-d692ab10a8d8	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	1	1	2026-08-15 20:47:10.429+00
d3c237c7-4d8f-86dc-99e3-d692ab10a8d8	bd1b441b-be06-815e-a8ef-438fa70764ad	{77cbd3a0-af1c-876c-8266-078397991108,e5c7b203-f6b4-8924-9d03-b88c6274c523}	t	\N	f	1	1	2026-08-15 20:47:19.309+00
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	f54ae8b5-f277-8127-80df-11f274168b39	{}	f	\N	t	0	1	2026-08-15 20:47:42.121+00
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	f	\N	t	0	1	2026-08-15 20:47:45.674+00
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	1	1	2026-08-15 20:47:52.433+00
5007b49e-fcc0-8a6e-891e-fe83e2a2e097	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	3	3	2026-08-15 20:48:11.067+00
aaecfbbf-4678-8b7d-a967-b3a568fecd36	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	Cat	f	1	1	2026-08-15 20:50:28.348+00
aaecfbbf-4678-8b7d-a967-b3a568fecd36	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	Since	f	1	1	2026-08-15 20:50:37.001+00
aaecfbbf-4678-8b7d-a967-b3a568fecd36	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	1	1	2026-08-15 20:50:45.871+00
aaecfbbf-4678-8b7d-a967-b3a568fecd36	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,5a5c5c5f-526f-8f34-9358-915221e5c47a,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8}	f	\N	f	1	3	2026-08-15 20:50:54.987+00
8e6514f8-adf3-868b-87b2-9f5dffa3b94d	818c6acd-d71c-884f-b789-200afa196196	{f7b8782a-59a1-8859-a8b5-0f6c014994da}	t	\N	f	1	1	2026-08-16 06:00:42.854+00
8e6514f8-adf3-868b-87b2-9f5dffa3b94d	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	1	1	2026-08-16 06:00:46.027+00
8e6514f8-adf3-868b-87b2-9f5dffa3b94d	bd1b441b-be06-815e-a8ef-438fa70764ad	{77cbd3a0-af1c-876c-8266-078397991108,e5c7b203-f6b4-8924-9d03-b88c6274c523}	t	\N	f	1	1	2026-08-16 06:00:52.286+00
d255f3b6-6507-8ecb-b862-e6779de0af92	818c6acd-d71c-884f-b789-200afa196196	{f7b8782a-59a1-8859-a8b5-0f6c014994da}	t	\N	f	1	1	2026-08-16 06:53:31.623+00
d255f3b6-6507-8ecb-b862-e6779de0af92	cd281ab2-0b80-8059-ac87-cca56165b018	{418edc37-2d3a-8ce1-bab1-0e4c9176b791}	t	\N	f	1	1	2026-08-16 06:53:33.823+00
d255f3b6-6507-8ecb-b862-e6779de0af92	bd1b441b-be06-815e-a8ef-438fa70764ad	{77cbd3a0-af1c-876c-8266-078397991108,e5c7b203-f6b4-8924-9d03-b88c6274c523}	t	\N	f	1	1	2026-08-16 06:53:37.669+00
30ea588a-77ba-8e82-abef-d273375574ce	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	Cat	f	1	1	2026-08-17 14:50:36.413+00
30ea588a-77ba-8e82-abef-d273375574ce	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	Since	f	1	1	2026-08-17 14:50:43.862+00
30ea588a-77ba-8e82-abef-d273375574ce	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	1	1	2026-08-17 14:50:50.42+00
30ea588a-77ba-8e82-abef-d273375574ce	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a,3c94f1d2-759c-855f-a3eb-9668da53d50d,c12fc1a5-58b6-81ac-b191-4481c65417cb}	f	\N	f	1	3	2026-08-17 14:50:59.628+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	f1037adb-1988-8b66-bad2-ffa44ed0825e	{}	t	Хліб	f	1	1	2026-08-17 17:22:35.176+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	1924c112-1179-8e2f-ad89-68063c0fb4ba	{adf9acb6-f8eb-8b8b-bb2e-c476e3a1574d,f3738308-9dd4-8aef-ae7c-3c1bb95befdb,8ea50220-c987-8f95-82d8-42e6f5f67f41,55085cee-2f19-8219-a356-82509c626526,9ea3c3b6-14c6-899e-9253-88c09a9a5444,3d857775-30a5-805b-b5bb-b79befb9f9ae,eb767f6c-ee83-8b7f-8eea-d0d8f568fcc4,788e86f5-5f1d-8ed6-a7a0-0eea32822b0b,05620cbc-a767-8036-aeb6-f41e9a0f53e0,53009f1f-6ee1-8ffd-8b21-72dfedaccf4b}	f	\N	f	3	5	2026-08-17 17:22:58.004+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	6b378dee-6b57-89e1-9353-e8523409b93e	{bc6fe60c-374a-8624-a581-f751fb9c1c30,d9aa7180-699e-8355-b243-655809cc3936,17568179-5fe8-8342-829e-20e06f2c6a26,787c6d15-8e75-8d4c-927c-1145034f87b9,8520047d-e550-878b-8f4d-17a9a7cdc89b,bcd9c1b9-cf26-8813-9a9e-af164ff171c1,d02aa7c5-c2b7-80c0-9384-c4a58dc652c0,a033d362-950f-81f1-881f-2bde74ccbe39,9f333c89-14b3-8119-bcd5-1ec4a319d39b,7079300b-b20a-8eae-97af-79deca336366}	t	\N	f	5	5	2026-08-17 17:23:25.055+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	8ab7e970-c7c3-831d-897c-a3909736a573	{}	t	Bread	f	1	1	2026-08-17 17:23:31.126+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	926f924e-f393-85df-9a9c-d0207306c0c1	{}	t	Milk	f	1	1	2026-08-17 17:23:35.745+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	af729aba-bb95-8766-b73c-6b81997dd7b7	{}	t	Water	f	1	1	2026-08-17 17:23:39.5+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	0e7e852f-e50b-8952-bc3e-c0c83de81cac	{}	t	Tea	f	1	1	2026-08-17 17:23:41.99+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	b931cb06-d05e-8ec6-9795-c489217db379	{}	t	Coffee	f	1	1	2026-08-17 17:23:44.84+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	a24b40d9-727d-81ed-98f1-b989e072a0a0	{}	t	Apple	f	1	1	2026-08-17 17:23:47.227+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	efc13df1-fda7-8b42-8fcb-ca888f4545d5	{}	t	Banana	f	1	1	2026-08-17 17:23:50.576+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	be6554d4-f65c-811c-a2d7-0a66b186bc2c	{}	t	Orange	f	1	1	2026-08-17 17:23:54.096+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	02c3c4b9-5132-8b3e-9114-c9f146ad4f63	{}	t	Potato	f	1	1	2026-08-17 17:23:57.931+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	60b4995a-c666-8a54-bae4-ea04723842b7	{}	t	Tomato	f	1	1	2026-08-17 17:24:02.58+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	ea37c658-195d-840c-a522-1955c7c6f53f	{}	t	Carrot	f	1	1	2026-08-17 17:24:06.144+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	e7678d2e-ded4-8dbc-ac4e-7a1c3bf4acb7	{}	t	Egg	f	1	1	2026-08-17 17:24:08.679+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	fe874b23-e369-8879-a5cb-e44f41453788	{}	t	Cheese	f	1	1	2026-08-17 17:24:13.082+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	9f1784c8-79a9-8412-ac89-aa73c30edb4b	{}	t	Rice	f	1	1	2026-08-17 17:24:15.946+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	78f9fdd3-d042-82f6-9f78-72fd962f617b	{}	f	Chiken	f	0	1	2026-08-17 17:24:21.787+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	8dfd3a56-a49e-8031-afaa-39c372f61ec9	{}	t	Fish	f	1	1	2026-08-17 17:24:29.47+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	0f529282-d38c-8783-8b0b-f65e31c4abc0	{}	t	Meat	f	1	1	2026-08-17 17:24:35.563+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	4c256dee-8118-8976-945c-99e84cacea9b	{}	t	Soup	f	1	1	2026-08-17 17:24:42.575+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	a53aa7ae-7e47-8eb1-bb3b-5ef27ec5d3aa	{}	t	Salad	f	1	1	2026-08-17 17:24:46.509+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	7bff993f-8a2e-8c2a-8d1b-e57e392574a5	{}	t	Cake	f	1	1	2026-08-17 17:24:49.999+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	67493a3e-9e27-831e-b630-1b721eca7d41	{}	t	Sugar	f	1	1	2026-08-17 17:24:53.344+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	d8148550-5148-8b1e-974b-6ed02a6754c1	{}	t	Salt	f	1	1	2026-08-17 17:24:56.302+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	6732320d-e771-86b1-8afb-292069131611	{}	t	Breakfast	f	1	1	2026-08-17 17:25:01.109+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	4bda6e56-3c08-82fb-b6d9-87e8e37fd461	{}	f	Dinner	f	0	1	2026-08-17 17:25:04.802+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	00ca5865-c1a1-88f1-b3b8-dade63883e8d	{}	t	Dinner	f	1	1	2026-08-17 17:25:09.199+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	77ab2f42-4ae7-8b10-8fea-15e43c590a57	{}	t	Молоко	f	1	1	2026-08-17 17:25:13.907+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	94cec9f1-4846-84b1-9dc8-8d93efd417ad	{}	t	Вода	f	1	1	2026-08-17 17:25:16.612+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	0354deb1-6fb6-88a3-a2ac-4bb19afb7224	{}	t	Чай	f	1	1	2026-08-17 17:25:19.232+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	0b73f77e-db3d-8899-a73d-c60fb6c29683	{}	t	Кава	f	1	1	2026-08-17 17:25:21.483+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	7e92a1d0-a3f6-83fc-a7be-e88f71419f68	{}	t	Яблуко	f	1	1	2026-08-17 17:25:25.684+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	0f08d9e8-0b97-82e5-9bfa-d7931ba7c404	{}	t	Банан	f	1	1	2026-08-17 17:25:28.769+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	e53929bf-d21f-8806-82ff-7530cdcf641a	{}	t	Апельсин	f	1	1	2026-08-17 17:25:32.851+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	a8efb48a-b05e-8768-b3fd-bcfbdb9ed074	{}	t	Картопля	f	1	1	2026-08-17 17:25:37.363+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	ddbc9a48-4047-8646-ac6d-6e85ded76f42	{}	t	Помідор	f	1	1	2026-08-17 17:25:40.87+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	d23670eb-5087-8357-9940-175b65829981	{}	t	Морква	f	1	1	2026-08-17 17:25:44.08+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	01a2cbe4-f74d-88c9-a8a3-514b3ecf4f97	{}	t	Яйце	f	1	1	2026-08-17 17:25:50.265+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	bdecf5a6-62bd-8b62-bdc6-6a9f54c2831c	{}	t	Сир	f	1	1	2026-08-17 17:25:53.408+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	43cb3fe3-b62c-8baf-b77c-28f9c1ad529e	{}	t	Рис	f	1	1	2026-08-17 17:25:55.682+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	c5555818-485c-8f68-985f-bfd5fddc5eba	{}	t	Курка	f	1	1	2026-08-17 17:25:58.261+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	f14b8c4d-1afc-8adc-9006-308318e0e258	{}	t	Риба	f	1	1	2026-08-17 17:26:00.721+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	024c7c63-d5f4-8f29-9470-ca3af756dc51	{}	t	М'ясо	f	1	1	2026-08-17 17:26:03.39+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	13561850-3a37-82af-84ce-454f4caf47fe	{}	t	Суп	f	1	1	2026-08-17 17:26:05.918+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	cf7bb76e-641e-8b56-bccc-9de7922c735e	{}	t	Салат	f	1	1	2026-08-17 17:26:10.343+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	5affe485-36d6-8a5e-8992-eb9f9d093cbf	{}	t	Торт	f	1	1	2026-08-17 17:26:13.709+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	fc1c519c-dee8-8641-9d33-182724f0e452	{}	t	Цукор	f	1	1	2026-08-17 17:26:18.312+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	833020c1-5468-88f3-a31c-f81a99229fe4	{}	t	Сіль	f	1	1	2026-08-17 17:26:20.936+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	f021f898-d2cc-887e-84be-dc02c320abd2	{}	t	Сніданок	f	1	1	2026-08-17 17:26:24.614+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	bf9f079f-f9ed-8ad0-86bf-d1c0e2aefc02	{}	t	Обід	f	1	1	2026-08-17 17:26:26.61+00
516c50d3-2206-89d1-9109-b5e4c9e9052e	200dd31c-b6ea-8d44-a350-1c2daf328f30	{}	t	Вечеря	f	1	1	2026-08-17 17:26:28.76+00
fe6515ed-94fa-80af-abca-5e057ac36118	d70b28a9-3b88-816a-b648-f7b6f382d310	{a2354f6d-11fc-80db-bc86-5ef4618293e0}	f	\N	f	0	1	2026-08-19 20:36:22.04+00
fe6515ed-94fa-80af-abca-5e057ac36118	2ed70fac-b9de-8eb3-8e75-d87d100fc2de	{bfaa7f90-c4bf-8f05-947e-7e75fb0d0aef,981825df-2184-84f4-bb5b-e2f276a516d8}	f	\N	f	0	1	2026-08-19 20:36:49.599+00
fe6515ed-94fa-80af-abca-5e057ac36118	18f2dd47-df78-8767-bce8-d538e95faf7d	{23e0fcd1-1a30-8875-a80a-d472c9487f8e}	f	\N	f	0	1	2026-08-19 20:37:14.562+00
fe6515ed-94fa-80af-abca-5e057ac36118	2ce73501-0026-8a1f-a2f3-179d11168257	{7c71aa09-0160-8760-a5cd-2f0ee1570521}	t	\N	f	1	1	2026-08-19 20:37:34.988+00
fe6515ed-94fa-80af-abca-5e057ac36118	dea5e419-5ec3-8470-aad8-da1bf0c1f9f1	{69f3eb9b-8b94-8f3e-a422-b0839114640e}	t	\N	f	1	1	2026-08-19 20:37:44.947+00
fe6515ed-94fa-80af-abca-5e057ac36118	3c66d373-a56e-85b1-93cd-020a008b8464	{0d4b4577-3642-8cb6-a7cc-d2addca92c46}	t	\N	f	1	1	2026-08-19 20:37:56.331+00
fe6515ed-94fa-80af-abca-5e057ac36118	f793c91f-f869-8b6e-84bc-6211307ac9cf	{43929f95-2cba-862c-844f-7282e5c1558b}	t	\N	f	1	1	2026-08-19 20:38:06.572+00
fe6515ed-94fa-80af-abca-5e057ac36118	cc8e248a-fee5-8e8e-aa52-c20970fec6ea	{e6f2a582-e3b8-8b13-9dee-a3a3f510daf7}	t	\N	f	1	1	2026-08-19 20:38:21.329+00
fe6515ed-94fa-80af-abca-5e057ac36118	7da3ea12-5863-8c58-99ac-cd058ab2634d	{02f34f8a-aac8-8594-af15-9c5e47f4d898}	f	\N	f	0	1	2026-08-19 20:38:35.831+00
fe6515ed-94fa-80af-abca-5e057ac36118	c8e05d70-730c-88b0-b577-84e9649571c5	{a8ffb10d-d717-8844-88a8-3851f68785fe}	t	\N	f	1	1	2026-08-19 20:38:47.867+00
fe6515ed-94fa-80af-abca-5e057ac36118	67f3c878-5f15-81be-8806-3c9728b415d8	{ee0bedfd-eb82-8930-99b3-1bf9fa5d0e3f,e69712a3-9526-8448-bfca-2b67c7d21f04}	t	\N	f	1	1	2026-08-19 20:39:15.503+00
418557ad-380a-83ad-8120-7bec8969a6a2	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	3	3	2026-08-19 20:40:13.254+00
d8299a78-5ed7-8737-8ebc-289535e28f74	f54ae8b5-f277-8127-80df-11f274168b39	{}	t	Cat	f	1	1	2026-08-19 20:40:44.111+00
d8299a78-5ed7-8737-8ebc-289535e28f74	f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	{}	t	Since	f	1	1	2026-08-19 20:40:48.867+00
d8299a78-5ed7-8737-8ebc-289535e28f74	877742ee-5068-8db5-af02-6c30eefc4f2d	{943d1c4a-f1c2-8caa-a28f-5e162e35e797,ea1e07fa-c6e0-8b95-b0bf-f144e083e5ca,eefabbdc-a4c6-8523-b585-ddb5e01280e6,acb65390-c6f1-849c-b5a0-46de7250b519}	t	\N	f	1	1	2026-08-19 20:40:57.84+00
d8299a78-5ed7-8737-8ebc-289535e28f74	29fa93aa-0d3c-8809-bd19-bbc794792ecf	{7e98e995-054a-8243-bdba-c030efdf80ca,c12fc1a5-58b6-81ac-b191-4481c65417cb,3c94f1d2-759c-855f-a3eb-9668da53d50d,a17cfb7b-eb5a-8d78-bf97-4da0d82eaed8,a4b6cd34-30dd-8577-bd9b-2c0b7d0cae8d,5a5c5c5f-526f-8f34-9358-915221e5c47a}	t	\N	f	3	3	2026-08-19 20:41:06.781+00
60dd2594-3f02-8d60-872b-0b58da676bf8	f1037adb-1988-8b66-bad2-ffa44ed0825e	{}	f	\N	t	0	1	2026-08-19 21:42:23.332+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	485bea2b-95ad-8185-b0ea-48befaef18ad	{}	t	Футболка	f	1	1	2026-08-19 21:47:50.852+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	c2fa4fd5-de53-8ade-87e8-781b4ddb67c2	{}	f	Штани	f	0	1	2026-08-19 21:48:05.421+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	03048403-511c-85ec-86e4-378e9117b5db	{}	t	Костюм	f	1	1	2026-08-19 21:48:13.91+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	d815296e-fc38-82e9-afe6-cdb07814ca9d	{49f19436-17d9-8e40-ab17-1be12fb0831b,1a65934a-2e89-8278-8dbf-47af893fcf4f}	f	\N	f	0	1	2026-08-19 21:49:30.38+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	9a18a4db-0dbb-8e43-b47f-f5560016dedb	{}	t	Взуття	f	1	1	2026-08-19 21:49:53.577+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	f4fccf84-7594-8ab7-ad24-959184667926	{}	t	Розмір	f	1	1	2026-08-19 21:50:16.151+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	853e9353-933b-853b-a927-92bde0685559	{a0ead206-5cfc-891f-ad81-fe2e748d13ac}	t	\N	f	1	1	2026-08-19 21:51:08.39+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	f1ea73ab-6036-8a5c-8eee-b2d75e91b74b	{}	f	Рукавиці	f	0	1	2026-08-19 21:51:16.232+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	ab87fbf3-6331-8bef-a903-f673df12aa0b	{}	t	Шарф	f	1	1	2026-08-19 21:51:26.895+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	eb365fc9-8ea7-8f18-b591-43a21df9fa29	{}	t	Штани	f	1	1	2026-08-19 21:51:32.625+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	9f22978d-d803-8181-a4d6-8e7ee9a5fc8a	{}	t	Шорти	f	1	1	2026-08-19 21:51:36.686+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	02cdf03d-9f2c-8ce4-8662-10289e1887c0	{}	f	Повзунок	f	0	1	2026-08-19 21:52:06.13+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	f9c7d64f-a85d-85f7-b0b3-e73367bfad01	{}	t	Sandals	f	1	1	2026-08-19 21:52:15.641+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	3c8437d0-01fe-8296-b103-0d88203c29f4	{}	t	Zip	f	1	1	2026-08-19 21:52:25.337+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	240ed98f-7280-8081-ac83-966292f63e5d	{}	f	Жакет	f	0	1	2026-08-19 21:52:29.499+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	9bf90618-9cff-8bf9-a04a-d7069086ec32	{}	t	Bag	f	1	1	2026-08-19 21:52:39.221+00
86aba442-254e-88a3-b1a9-6e78d11f4d18	725a8b84-0a4d-80d9-9dce-b885f56a676c	{}	f	Карман	f	0	1	2026-08-19 21:52:43.282+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	d753cdd4-4d6e-8b96-b924-b979f66ec8c6	{9cb10af6-a10a-8085-a1c8-34ee7b2b9e3e}	t	\N	f	1	1	2026-08-20 18:21:19.733+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	788c11ea-b800-8c85-ab83-0df2e4f3923c	{d655d710-d2ac-849e-bf26-9fdbd48041fb,4986aa81-7b67-800c-a145-ac52aa35888d}	t	\N	f	1	1	2026-08-20 18:21:37.914+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	40a40575-be0e-8573-af1a-ddd4b1862ce5	{0f116e77-8659-85bb-912a-55ae51baf1b6}	t	\N	f	1	1	2026-08-20 18:22:16.082+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	468da566-061c-8d59-9974-55c09e8215bb	{c9e2e331-784d-898a-8d19-9ff0c7430757}	t	\N	f	1	1	2026-08-20 18:22:40.233+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	d65cfb4c-062a-8450-bba8-ccb846fe76a1	{7a090580-facc-8659-afd5-ed0ea7e577c0,21cb788a-e4d5-8cc7-b71b-29e057829b42}	f	\N	f	0	1	2026-08-20 18:23:08.103+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	86557979-9c3c-8f79-80cb-329e36c5e99e	{8c2e0b05-c945-8054-bda2-213efe56bd81}	t	\N	f	1	1	2026-08-20 18:23:48.763+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	2bd04385-e605-8bf3-b2f1-e0a7c36cd766	{849c3da1-145d-841b-a0db-4c2e013f4492}	t	\N	f	1	1	2026-08-20 18:24:05.891+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	bd2c9751-98b0-88f7-9223-f29721376a9e	{007de105-f44a-807a-be47-690c68d39b67}	t	\N	f	1	1	2026-08-20 18:24:38.408+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	6f9b6517-a5d3-8721-bef9-ff23a3809351	{e8742d4a-672e-88f5-beba-2d34b4842dcb}	t	\N	f	1	1	2026-08-20 18:24:51.417+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	77866774-fb69-8499-8aa7-f8530ca764dc	{8c92e3e9-ffc6-8dad-97d9-6a2afce5051c}	t	\N	f	1	1	2026-08-20 18:25:06.973+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	1714869f-9ff5-8137-a14b-a99a945cf514	{9edde1bc-0784-802c-920d-03f76174d531}	t	\N	f	1	1	2026-08-20 18:25:24.112+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	15535a2d-826e-8205-a33b-41f47925d22e	{4f176242-c83b-8033-832d-dafec892c173,f1f3cb9b-d177-84d9-8746-a9d98e456bbc}	f	\N	f	0	1	2026-08-20 18:26:11.116+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	34f29309-50df-8290-b944-03e027d0c59d	{d949a6a4-b08d-855a-9f1a-bdb902391251}	t	\N	f	1	1	2026-08-20 18:26:35.256+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	deeeb039-35df-854d-a816-601d7386c7ce	{b7eec568-a612-8895-a670-385e4fafefc5,7972582f-ae71-8057-9aea-26324adbf027,90020a1d-e0f0-8ec0-892f-b3fec796de2b,3bfac761-96bd-8780-bcd7-53bc13247401}	f	\N	f	0	1	2026-08-20 18:27:47.005+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	01ffa53b-2875-8d4c-95f5-da4c04c89f9e	{f1a306d8-e662-82a9-9b33-cdc19218a9f7}	t	\N	f	1	1	2026-08-20 18:28:11.293+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	ba03a02e-7bcf-8475-952a-7c760012c37e	{141d0378-bafb-8147-802b-197f7474c6b6}	t	\N	f	1	1	2026-08-20 18:28:30.745+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	feadd348-a8d7-84f7-9e20-d9849b3d4157	{518cff09-f1ad-8446-b387-c9fee03679a3,cef0bc79-346c-8cca-9835-db1ffb326a99,c1796b33-ae66-8aea-a51a-7cfcb02dbb17}	t	\N	f	1	1	2026-08-20 18:28:49.572+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	95871f4e-3c26-8d26-88e6-572d96da602f	{71376969-3149-8208-936f-3d0fd6c1641c,a883cc35-bf01-8595-8b74-1a5b0ee26ad5,a889f60b-1dc6-885f-8c4a-350d4edaff8c,07ba13ab-4dab-8e75-940e-c91f4a20bd70,bc3a9084-4fe6-810b-bf49-e5f0364a5a8b,fd1133ad-9c74-8584-b1c4-ec480f739fdc}	f	\N	f	1	3	2026-08-20 18:29:08.977+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	{8418727b-4987-85ac-9899-70dab78cc60f}	t	\N	f	1	1	2026-08-20 18:29:35.809+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	800e98ae-c6b5-824b-826c-c8cffe76ff57	{77cda005-cba1-8ccf-9258-8c4abd43b433}	t	\N	f	1	1	2026-08-20 18:30:00.948+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	8b76ee55-c231-8734-8e63-384a82f24116	{6c5b5045-02a0-86bb-9e71-a9cbe9b32f2e}	t	\N	f	1	1	2026-08-20 18:30:19.678+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	517567ba-4265-8ef8-849a-6a3c7890eeea	{c72860c1-243b-8fbc-8137-9c044c1a1665,79db52c7-838b-8c57-94f0-4bdfaaa726fd,d1fc90ec-17dc-8324-a742-378410eed52c,b6a677e2-f1a4-8846-bec9-1403ed5541bf,bc0877b0-b565-8706-9d92-1ba21bfd7c3e,1c1a7186-5dc8-86dc-8ef1-219777d74ae6,f836dbfc-6c80-8f1e-9c47-f7a8e33c65c3,3fea6aa8-cd3e-864c-a5ff-7ad27e626b27}	t	\N	f	4	4	2026-08-20 18:31:03.613+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	680c9336-42f1-84fe-b056-2611e0450aa5	{6f1c6c64-bbdb-8cb7-bb1e-e47f3092751e,80442baf-a3da-8043-9565-43c8bba54a07}	t	\N	f	1	1	2026-08-20 18:31:46.007+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	1c19d9ac-239b-8cc5-8059-d54271d9ba38	{c1ce353d-d22c-879f-9f02-f1364a0486bb}	t	\N	f	1	1	2026-08-20 18:31:58.963+00
f0ef689e-c32e-8b2f-abac-f443552c4df5	868f6f7d-37cc-88f0-8d60-3c3651525291	{6169c4b7-c2b7-889f-b2c2-feb4a9f25523}	t	\N	f	1	1	2026-08-20 18:32:12.025+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	ac4aa3b3-11c9-8125-aa74-261b5e56310e	{b57e7aa0-1bce-813c-8b04-f1ad097bd03c}	t	\N	f	1	1	2026-08-20 18:32:38.332+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	eeb52fd5-522c-80dc-a4f7-c2a83b44421c	{4de344ec-57a3-83a6-8f1a-0b478434ecbe}	t	\N	f	1	1	2026-08-20 18:32:54.967+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	{69a7a3f4-5999-8c0b-8ea3-78479749a0e6}	t	\N	f	1	1	2026-08-20 18:33:19.35+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	fd427a6d-34dc-88b4-b938-f00097aabda9	{83eacd4f-7042-8ec2-b72b-7b6752a848b7}	t	\N	f	1	1	2026-08-20 18:33:38.238+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	9a211a19-8d92-825c-819d-f45f08b1dbb0	{7b6262c0-5b2d-857e-8fe9-cfda71709f62}	t	\N	f	1	1	2026-08-20 18:34:09.982+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	{deaff2ca-4f05-8f86-a26b-ccea1e91f8a3}	t	\N	f	1	1	2026-08-20 18:34:23.25+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	79220895-4e55-8f69-8ba0-5faad9e97f12	{fef012f4-905c-81e9-b08d-1c5854703ba2}	t	\N	f	1	1	2026-08-20 18:34:43.361+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	10b59ad5-03cb-86fc-a265-9ceb0a087bd0	{0e933d9b-190d-8886-9de7-86d389b01c0a}	t	\N	f	1	1	2026-08-20 18:35:03.104+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	{2ddfb9db-c62c-854f-abf1-48ef34cd9a58}	t	\N	f	1	1	2026-08-20 18:35:25.04+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	{2d12aeb6-56d2-82ae-8d1d-da1cd9846c86,a666c376-8047-83f0-b77b-35f5a2309c57}	f	\N	f	0	1	2026-08-20 18:35:48.232+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	20010d78-12a6-8783-bc7f-386366215af6	{8816c2b9-7f55-8ad3-b5fc-d7485d14b919}	t	\N	f	1	1	2026-08-20 18:36:02.353+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	98d2f28b-b220-8068-9755-1eae8ff052d2	{e2724454-3413-871d-a3de-8f109169be94}	t	\N	f	1	1	2026-08-20 18:36:35.567+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	ee939949-2555-851e-9674-f27bebab1af0	{4103d7ef-3a96-8769-91e3-9e481f31ced1}	t	\N	f	1	1	2026-08-20 18:36:54.381+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	d787de3a-98bd-8d5b-be33-fa8c801a8e46	{ede92eb7-f1d9-85af-87c1-e102b353476d}	t	\N	f	1	1	2026-08-20 18:37:15.017+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	2834179a-ca26-8275-92a3-b05000ccb4b1	{510ff0ce-b7a8-80e6-ac69-682e1c5c3e35}	t	\N	f	1	1	2026-08-20 18:37:54.627+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	3c8c3c15-79fa-8ee9-918b-ef8495d69cad	{52e64fe4-c054-891a-8063-8a03c514bcf4,ad6f16e7-8796-8e15-ab6a-797ac43f31d9,e389a2ba-eb8b-86ad-b41b-8a2880ecdf5c,be74cae6-c9b1-8e9d-be7c-1ae822f3ecac}	t	\N	f	1	1	2026-08-20 18:38:45.739+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	89e593ff-4696-8e64-8c9d-5d386aa2b437	{5f928615-5d13-8e94-ab7b-bfb71f308b82}	t	\N	f	1	1	2026-08-20 18:38:59.873+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	3c637446-91c1-8984-9563-80c1bcd8f0b3	{4ffe2dd6-0392-83d9-97c6-180aa7eec9a2}	t	\N	f	1	1	2026-08-20 18:39:22.729+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	f31739e3-4257-8ee6-8fcc-377f3f275fa4	{14751318-f309-82a6-8d98-f0e8ed5f1882,131c330f-bf6b-8383-bba7-35c115594023}	f	\N	f	0	1	2026-08-20 18:39:53.223+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	5f318fff-368e-85d2-9fc5-59f8efa0d6dd	{b1778916-8b73-8a07-babe-72b430a1bd03,4a25b9a6-5e0d-842b-bc83-12636a650860,d76d8d22-8b4e-8d5d-9328-a8e77e0cbf1b}	t	\N	f	1	1	2026-08-20 18:40:40.086+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	22cd375b-1acf-8360-ba2a-26e3b4f1c529	{19be9a8c-a540-8ef0-ab14-661cb1bc3a51}	t	\N	f	1	1	2026-08-20 18:40:57.427+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	2cfa8251-a04b-8e69-a160-89bf1b78e622	{310683ce-ee04-84a4-b058-c35a28eb1dfa,fe321f12-db1b-8376-b558-d0dbaaa553d8,4649cfe6-132c-88ed-b88a-3acba517a7e2}	t	\N	f	1	1	2026-08-20 18:41:40.049+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	5dd4bdfd-e18d-87ff-9f05-9c3447893b49	{fa30892d-c34b-8393-8598-bc77bbb3fc6c}	t	\N	f	1	1	2026-08-20 18:41:56.92+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	{07ae7ea0-8978-8d73-9871-98ba1d853d98,f3d89453-0647-8a91-a821-5b718b123661,6684e916-997e-8ec0-b750-7eba51ea57ca,efd56651-7acf-815e-8dc0-910e78fe3890}	f	\N	f	0	1	2026-08-20 18:43:17.203+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	9a68cdf4-4762-85b8-b981-b95361a814e3	{8db006ac-826d-812c-8611-a79cadbe2238}	t	\N	f	1	1	2026-08-20 18:44:04.418+00
c3d978fb-924b-8f2f-b75c-46a06e6117f7	a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	{37f92918-75b2-8f71-904d-46675dc66eca}	t	\N	f	1	1	2026-08-20 18:44:35.535+00
a7408889-377b-86cd-a3c3-deb5d1380daf	0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	{8656f1a4-9991-8506-a7c6-da76253df091}	f	\N	f	0	1	2026-08-23 08:51:58.54+00
a7408889-377b-86cd-a3c3-deb5d1380daf	c4ccdb06-8158-8298-a9fe-33d186ee146e	{516bec1f-c870-8cc7-b845-36953535409e}	f	\N	f	0	1	2026-08-23 08:52:15.346+00
a7408889-377b-86cd-a3c3-deb5d1380daf	518b33e1-4334-8a58-84b1-0dd99cdac6ce	{4a697a78-2dc2-8937-b216-82a93623ba89}	t	\N	f	1	1	2026-08-23 08:52:29.919+00
a7408889-377b-86cd-a3c3-deb5d1380daf	70200632-c1de-8d49-babd-170d2b896826	{}	f	\N	t	0	1	2026-08-23 08:52:42.111+00
a7408889-377b-86cd-a3c3-deb5d1380daf	1ec19a39-3492-8435-a404-bc53f87dc33a	{13fa7eaf-efb3-8eed-94eb-0796385ad7c8,ced8e2b7-72fa-8a5a-a2bc-b3ee85553682,3308d317-a25d-8843-942a-5038de2c3ec1}	t	\N	f	1	1	2026-08-23 08:53:09.603+00
a7408889-377b-86cd-a3c3-deb5d1380daf	251ffd80-870d-8f7b-b149-aaa077b66e47	{9baa77f9-0dcf-8dbd-b6c8-9775ac1f9ab0}	t	\N	f	1	1	2026-08-23 08:53:28.127+00
a7408889-377b-86cd-a3c3-deb5d1380daf	28d48723-0ad1-8ffa-804a-fa45f0bfda83	{}	f	\N	t	0	1	2026-08-23 08:53:40.216+00
a7408889-377b-86cd-a3c3-deb5d1380daf	547d8cd7-55dc-81ed-8dd4-ed5f115ea42b	{}	f	\N	t	0	1	2026-08-23 08:54:12.784+00
a7408889-377b-86cd-a3c3-deb5d1380daf	48dfcd45-c54f-8827-930f-786dfe516c63	{6abe0b6c-6ff0-8282-98a1-d0ba72783eb4}	t	\N	f	1	1	2026-08-23 08:54:36.255+00
a7408889-377b-86cd-a3c3-deb5d1380daf	1870667a-01ad-8bb2-9ff1-243c8b27ae5a	{f11ec625-ae27-81ae-99bd-960d1382f78e}	t	\N	f	1	1	2026-08-23 09:54:09.612+00
a7408889-377b-86cd-a3c3-deb5d1380daf	98200032-2db8-8e2d-b646-f885d9ca4259	{0c5704a6-3ecd-8dd9-a859-846445047e6d}	t	\N	f	1	1	2026-08-23 09:54:29.404+00
a7408889-377b-86cd-a3c3-deb5d1380daf	1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	{eb693964-8e62-84c7-bbf9-ea1760faebf0}	t	\N	f	1	1	2026-08-23 09:54:42.909+00
a7408889-377b-86cd-a3c3-deb5d1380daf	4a0f96f0-653a-81df-a77c-384300dade32	{bdaeaea5-adba-82f0-a7c4-5526fa3a5c6b}	t	\N	f	1	1	2026-08-23 09:55:12.404+00
a7408889-377b-86cd-a3c3-deb5d1380daf	64fabd3d-6863-8422-907a-250c3ab5b289	{}	f	\N	t	0	1	2026-08-23 09:55:34.175+00
a7408889-377b-86cd-a3c3-deb5d1380daf	fa190593-0f0f-872c-9dc0-88516b47f762	{525199fd-8445-857d-90e2-2d5b612150a1}	t	\N	f	1	1	2026-08-23 09:55:50.623+00
a7408889-377b-86cd-a3c3-deb5d1380daf	b08dcd53-dc0a-8705-a742-6e4c50302aa5	{}	f	cat exists.txt missing.txt > out.txt 2? err.txt	f	0	1	2026-08-23 09:56:18.851+00
a7408889-377b-86cd-a3c3-deb5d1380daf	c73ca850-0c62-8370-bb20-ff10b9ef8ed1	{79b6f783-de6a-8da5-b294-9bb2b43e6520}	t	\N	f	1	1	2026-08-23 09:56:55.712+00
a7408889-377b-86cd-a3c3-deb5d1380daf	cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	{87e00ce9-9ef0-806c-ae86-940017922bff}	t	\N	f	1	1	2026-08-23 09:57:06.566+00
a7408889-377b-86cd-a3c3-deb5d1380daf	762cd5b1-d4fa-833f-9f7a-5d64162d960d	{6dc5da7f-d286-8c27-981d-8b5ab7c0e343}	f	\N	f	0	1	2026-08-23 09:57:12.584+00
a7408889-377b-86cd-a3c3-deb5d1380daf	e0d32edc-4908-83e4-805f-8945c738605c	{b646a45d-88cf-8d4d-92b9-6b06614e2bdf}	t	\N	f	1	1	2026-08-23 09:57:35.653+00
a7408889-377b-86cd-a3c3-deb5d1380daf	52ba481c-097d-8cea-bb3f-9f43ed2b2be1	{5782b3d9-2d0a-8a7f-9199-8cab95e0644d}	f	\N	f	0	1	2026-08-23 09:57:57.227+00
a7408889-377b-86cd-a3c3-deb5d1380daf	0ba44dfc-8221-8888-ba76-ac30a34ca3a1	{443f340d-12d1-8bd6-9b07-d54c2fc55219}	t	\N	f	1	1	2026-08-23 09:58:20.657+00
a7408889-377b-86cd-a3c3-deb5d1380daf	f63867aa-4dea-82bd-b5f4-def14df0b116	{531ba056-81e9-89f6-bcad-9337b6214828}	f	\N	f	0	1	2026-08-23 09:58:33.948+00
a7408889-377b-86cd-a3c3-deb5d1380daf	e6efc7ff-23ee-8457-8254-8d01416835a2	{201c9cb2-83cb-8391-8147-2c55611e51dc}	t	\N	f	1	1	2026-08-23 09:59:17.044+00
a7408889-377b-86cd-a3c3-deb5d1380daf	8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	{62b43d73-b3e4-8566-a39d-37d10d328e60}	t	\N	f	1	1	2026-08-23 09:59:30.533+00
a7408889-377b-86cd-a3c3-deb5d1380daf	fffb38a6-067b-8733-bc78-3162c40cbf6a	{}	f	\N	t	0	1	2026-08-23 09:59:38.415+00
a7408889-377b-86cd-a3c3-deb5d1380daf	fef1cb06-7f6a-8698-a69a-6d9895bf82bf	{}	f	\N	t	0	1	2026-08-23 09:59:53.378+00
a7408889-377b-86cd-a3c3-deb5d1380daf	e36595fa-b28d-8cf0-916e-d8b649288822	{}	f	cd ..	f	0	1	2026-08-23 10:00:01.098+00
a7408889-377b-86cd-a3c3-deb5d1380daf	f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	{8794a289-aae0-8112-afa3-0f79169aca02}	f	\N	f	0	1	2026-08-23 10:00:20.164+00
a7408889-377b-86cd-a3c3-deb5d1380daf	29149c08-624b-8964-8532-e7bb888eafd3	{73b41012-47d9-8b80-becc-3ad3fc5d80b3,f77250f5-a9d8-8412-8cef-7d9803760849}	t	\N	f	1	1	2026-08-23 10:01:12.423+00
a7408889-377b-86cd-a3c3-deb5d1380daf	6ea13554-4f77-8120-a798-703b4efcd29c	{5fc04233-d486-81c7-86eb-49a17e1801d6}	f	\N	f	0	1	2026-08-23 10:01:27.953+00
a7408889-377b-86cd-a3c3-deb5d1380daf	cf13f13c-e8e9-8c93-858a-4df6a31c258c	{bd7dffb0-55d8-8e66-aff4-7ebd5b5bc576}	t	\N	f	1	1	2026-08-23 10:01:55.373+00
a7408889-377b-86cd-a3c3-deb5d1380daf	d9606bee-fed2-8305-8fc4-18117c0dcba3	{c10e8803-bd5b-8e2e-aed5-fbaefbdffce1,3683683d-8c9c-8b73-a11c-64849a084383,fa4f0a55-cd00-8241-8e71-ba50d0c35cbd,ac15d9e4-f70c-8fa0-93e2-4b11c5f0f414,7a3fd924-a0c0-8f6b-acb7-21b239e98f53,204bafb1-7ffa-8257-ab70-e2bfb8faa98b,6ae91894-5aa3-8bf5-a33b-366994704a2b,d0a9dc1b-d053-8777-819a-8832d5000aae,30e0a30e-8a24-8787-bc73-40480bdbab49,5e1dfc5f-a492-8515-81df-de27b336dd22}	t	\N	f	5	5	2026-08-23 10:02:51.699+00
a7408889-377b-86cd-a3c3-deb5d1380daf	09be3ff3-1403-891d-aea7-d6ae41a62bc8	{dcdd7377-4060-887a-8e96-9c9eefc9b1bc}	f	\N	f	0	1	2026-08-23 10:03:22.375+00
a7408889-377b-86cd-a3c3-deb5d1380daf	efa69e8b-d383-8371-b742-716e644512f4	{2ee739c3-a9c2-8f4b-925a-76eeb1601141}	t	\N	f	1	1	2026-08-23 10:03:45.592+00
a7408889-377b-86cd-a3c3-deb5d1380daf	94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	{a924f75c-729a-82ce-82dc-36b4f3fc46bf}	t	\N	f	1	1	2026-08-23 10:04:02.039+00
a7408889-377b-86cd-a3c3-deb5d1380daf	226ce076-a057-8ef8-a48e-0669ad379701	{76449d89-748e-8839-aaea-89900d826561}	t	\N	f	1	1	2026-08-23 10:04:11.928+00
a7408889-377b-86cd-a3c3-deb5d1380daf	c1b61b3f-d9ea-87db-a256-3e5ab2686e53	{}	t	tail -f app.log	f	1	1	2026-08-23 10:04:27.032+00
a7408889-377b-86cd-a3c3-deb5d1380daf	81e06311-a749-8c85-b477-4c2c213c0db5	{d9bcb016-4173-8fbb-9297-dc6818f0c9ba}	t	\N	f	1	1	2026-08-23 10:04:50.105+00
a7408889-377b-86cd-a3c3-deb5d1380daf	d9cf128e-ecea-8533-b85c-eab045522b9a	{7129116b-56f1-8890-ad85-b182ab168a55,0ac86dc3-aed6-8e47-88ca-d151288fc6a0,91a2da49-4fb9-86a5-a8c6-a9361db926a9,731114b6-333c-8619-b0d0-abf5f3ad92a9,22561f16-3ded-809b-abb5-b0b917ae11cb,c34aa127-28e6-8f59-b401-5927390ecad7}	t	\N	f	3	3	2026-08-23 10:05:14.29+00
a7408889-377b-86cd-a3c3-deb5d1380daf	3dc0172a-bad6-89de-8207-cff14f2b95f5	{}	t	pwd	f	1	1	2026-08-23 10:05:25.402+00
a7408889-377b-86cd-a3c3-deb5d1380daf	0f67d24b-0a4f-8acb-9858-1cf7db90f854	{b844780b-6fd5-85ff-a276-2a6eeffcf860}	f	\N	f	0	1	2026-08-23 10:05:46.716+00
a7408889-377b-86cd-a3c3-deb5d1380daf	7b0be6e7-7d15-8d22-a99c-c008bee13204	{3c5838ed-a19f-85df-b1b9-cd87df41895a}	f	\N	f	0	1	2026-08-23 10:06:34.626+00
a7408889-377b-86cd-a3c3-deb5d1380daf	27b0780a-72a9-898b-95b6-593afbb151f5	{}	t	mkdir -p apps/api/src/new-module	f	1	1	2026-08-23 10:06:54.698+00
a7408889-377b-86cd-a3c3-deb5d1380daf	ee033d47-a447-8c33-8f22-da9c2c1139ba	{146609c2-7890-8ecc-947f-e87165a76a71,cd53b4cc-aca6-8145-9c0f-e79ca8f13c4b,7e9a9462-58f1-87e0-99fc-8d88a28c0113,b09571b1-89b4-83e3-ba05-646f876291da,e5b58dfa-75a3-831d-99a7-1bf5699ee5c4,531b8ac3-93f2-8ab3-8e3e-2d53c00dbfc6}	t	\N	f	3	3	2026-08-23 10:07:24.312+00
a7408889-377b-86cd-a3c3-deb5d1380daf	902657f7-edd5-828f-8768-56e35f1166b6	{}	f	&> both.txt	f	0	1	2026-08-23 10:07:42.329+00
a7408889-377b-86cd-a3c3-deb5d1380daf	1789be8f-08a0-8c7d-ad5a-ca56c5070b12	{a96a6fea-1d78-8f02-be0b-66fda527b4a5}	t	\N	f	1	1	2026-08-23 10:08:21.786+00
a7408889-377b-86cd-a3c3-deb5d1380daf	6e65f4d6-d90b-8157-9002-f7118f211efe	{ab5f73df-fafd-87c1-b8f6-2997d54a7ae5}	t	\N	f	1	1	2026-08-23 10:08:47.51+00
a7408889-377b-86cd-a3c3-deb5d1380daf	c1f0db99-722f-8a49-afef-939116ea9e24	{d30a0435-8663-8f5f-b202-94c8b513e6b9}	f	\N	f	0	1	2026-08-23 10:08:58.366+00
a7408889-377b-86cd-a3c3-deb5d1380daf	b206788a-01b9-8fd2-bd71-a2c9415ba174	{b5860ef8-016d-8e2f-861b-6c2050effba6}	f	\N	f	0	1	2026-08-23 10:10:03.927+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	c37c9ae4-666f-801c-892d-16efaf60a66d	{026d66e7-4557-8a70-8b47-f580ca2aa78b,5fdfecd3-c21b-8ac2-80f8-4f2c0e87f989,eca6b32d-b36e-8380-be68-77954ff3661c,e6426096-7995-8041-9e0c-45c8237a1019,ef1797ca-4ae5-8b4b-ac53-aa67ab74d8d6,45bb51dc-8066-8ac0-a00d-1a1464d5a1a8,b66570fd-0270-869c-be39-74447584d62a,7022f2d5-ce2d-8f62-a1a1-1a55a9db5dd9}	t	\N	f	4	4	2026-08-23 10:11:22.478+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	{e8e8ecc4-8fea-8754-9da2-8af23ef3d4c5}	t	\N	f	1	1	2026-08-23 10:12:20.414+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	13525375-1855-87f9-a506-ad882d6e9662	{4194cff9-df48-8bcd-bc92-0e8d9428e67a}	t	\N	f	1	1	2026-08-23 10:14:31.8+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	2bf82f23-7734-8f97-9e42-97abb45eefa6	{419410c8-b41e-8f12-89df-b0f93c871b3f,3d5390b2-4216-8dee-8f15-2ab203f9d306,208f12aa-2046-850a-a5fd-227d55010994,b18b107b-4836-80b4-9c67-9ddb2e2fb87b,ae72bb92-a0fb-8569-ac85-1cba36ade7f1,f0446572-6304-8d62-8d1a-c48bdef8298a,579c6841-3f0e-85ed-b8dd-c00bc18a2f7e,2e34ac33-872b-85ed-92ef-7f3528869780}	f	\N	f	1	4	2026-08-23 10:15:01.153+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	{c45e3ecb-cac0-855e-8089-ef15eb69ac18}	t	\N	f	1	1	2026-08-23 10:15:36.926+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	1ad09b97-f93c-8a17-b194-dc1cf2067597	{2eca6152-3e01-8f2f-b266-ac139b343e19}	t	\N	f	1	1	2026-08-23 10:15:59.973+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	c2af6150-ffac-8294-8e92-fd0281ffce05	{25dbcb96-7bb5-892d-9b04-f21e5eae716f,37ec1099-efb8-817d-a12e-3ab1f35b4973,e15870e7-d842-8f25-ae3f-9a442bdc7006,8391c3c4-7ae6-8b33-843f-3b301c51d3e9,c92a5a48-a281-84a3-a4e3-bbfdfa94d677,24bb7ee3-ac47-832c-912f-b20f4f0670e8,02b573e9-b1b0-8560-baa2-2c02fcf649f1,66a7872d-0869-8f32-8a3c-c6df3acb20bf}	t	\N	f	4	4	2026-08-23 10:16:32.477+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	f769fe1c-d743-88a2-9add-f1cc3f94fe03	{7574f30a-603d-835c-9b22-3c5e5919cc41,f75c110a-85b0-8f09-b8c8-2e55e1165513}	t	\N	f	1	1	2026-08-23 10:16:45.021+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	c7e7d4d9-1faa-888a-8614-f4e329ef6f16	{51abfd83-0efe-892c-9fba-a3abefbc95c0}	f	\N	f	0	1	2026-08-23 10:17:14.5+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	8c7e731b-b835-8095-9b01-56763a4209d9	{02d92acf-8ad6-835c-af0c-f46187353510}	t	\N	f	1	1	2026-08-23 10:17:34.677+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	658715ed-295b-84ab-9144-c532e6b4ee79	{b98c2729-2cde-8cef-a534-1ed4f35e8a19}	t	\N	f	1	1	2026-08-23 10:18:01.707+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	{28c03011-b2aa-8627-9ba3-26516ad3f6b9,c6914eff-21fc-86ea-9eaa-b0707b47508f,06115b26-0c93-87b6-93cf-831e8cbc4a5b,bf487a12-5d9c-8d27-acd2-e0f2fc5d3a7b,3b26a331-81f1-8086-852c-8d9dfa33d83d,e08ef516-6ba1-8475-b24c-daf49ba3641d}	t	\N	f	3	3	2026-08-23 10:18:35.098+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	290c3db5-299b-8d89-8151-1d9abc8584d7	{ee20d960-e15a-8d6c-971d-9d9a6cf2f4b5,a42c5973-87f2-8a8a-8b9e-809f9199882f,835c6813-3d96-8c56-9be3-7b202190f7e8,dd5c5f68-1e1c-8012-bdd2-4b9fd915d823,73c4e82f-e2ee-8bd0-a234-a386e78c8046,557f8d8c-1211-826c-af26-6bd6fa23309b,57d013f9-255c-86d2-9f05-31855724fe12,0934bf28-c1aa-8caa-97d8-a28af09dd471}	t	\N	f	4	4	2026-08-23 10:18:55.902+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	c2c200f0-4559-8d23-8883-8b5577a99c9e	{88b10e26-8a94-83d2-9429-9e161fc73b8f,f13ff81d-5593-8d62-9318-2e3c2e72846f,c737d8f8-68d2-89d9-8f4a-9392f81b5fdc,c081051c-b7aa-8e5c-8aac-c5f649f6ae4b,0e6a0d17-b1fd-8a8e-bcfe-ded2fe494abb,71282569-2e7b-8787-bc96-95ad130d65aa,5a60add8-0849-8420-8f16-e4422f9a4f09,f98951db-4bfe-8739-8f91-d535a7d5e227,65138bab-b976-8bc1-9f3c-96abb8a1fe38,18602d06-695a-8081-a6c4-4f20d0cb68ef}	t	\N	f	5	5	2026-08-23 10:19:39.641+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	54e7ac12-7800-846c-833f-6e8bdf55ea7d	{2a572c43-9213-8cb4-a34d-b1feb9ee5521}	t	\N	f	1	1	2026-08-23 10:19:59.607+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	db2f66db-5d99-823d-a2ec-3f29d907b28f	{86fd254a-7c1b-8e5b-a2cc-bd9ad1c70bb0}	f	\N	f	0	1	2026-08-23 10:20:16.167+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	bf69aa1e-d263-882f-93ca-94634446955b	{a01588f2-b1c8-8677-ac6b-62fc65bc95d8}	t	\N	f	1	1	2026-08-23 10:20:35.544+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	3d9c4cc6-2e85-886e-91c9-a135a8467c45	{94b9104c-a524-87ec-bb71-749a09a13435}	t	\N	f	1	1	2026-08-23 10:20:49.326+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	7f738a26-77d8-802c-a087-d96d3083c5d3	{a234650f-7f77-8df0-a4fc-0d92e0bf13d1}	t	\N	f	1	1	2026-08-23 10:21:32.537+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	{1ea1fd4d-873c-8369-8aa8-decb191a1b6e}	t	\N	f	1	1	2026-08-23 10:22:18.373+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	f8101924-53a1-8a05-98fe-0f7543eba194	{2e75d0a5-d968-8568-b44b-2ff2b9ef5d13}	t	\N	f	1	1	2026-08-23 10:23:02.627+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	1a963fd5-5a70-890d-8500-a4076dddd161	{b840fa2d-f04e-8498-95e1-5296e42a4ddf}	t	\N	f	1	1	2026-08-23 10:23:20.274+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	727a7d0e-a227-852b-9493-e6e5516f5093	{96df9f2d-2d04-8f16-b8ee-7a8d5f3994aa}	t	\N	f	1	1	2026-08-23 10:23:30.203+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	a6ad60b9-0b48-82bb-98ea-edc36fbf1756	{a76f0279-2c1d-8526-8c1b-db06badcbf15}	f	\N	f	0	1	2026-08-23 10:23:39.972+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	daa7f706-e343-8d89-969f-a2ef67eb4ac9	{08882b3f-a0f9-871a-9517-b9ace0d23d04}	t	\N	f	1	1	2026-08-23 10:23:51.687+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	cf9a6f8d-d091-8c5d-80e3-1db49f31623a	{54444342-bd56-8e96-965c-d70ccd9eed4f}	t	\N	f	1	1	2026-08-23 10:24:04.742+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	ca01857e-ebd2-8cad-af43-7c9d5f2e1849	{29550e4e-d2a7-87f6-ba06-7630a54bb557}	t	\N	f	1	1	2026-08-23 10:24:18.307+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	4050b806-1050-896c-963a-30fbfa3a383b	{ad35f7ac-fdf6-882e-9c4d-2773f0c56216}	t	\N	f	1	1	2026-08-23 10:24:30.829+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	6cf248b3-ef20-81c0-8ffd-25cb9020ada0	{441f9f71-8d33-88e0-b070-7328d30d3fa3}	f	\N	f	0	1	2026-08-23 10:24:42.85+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	2f3a6ad2-3e01-8532-aadd-18e0cffece86	{da7d92f5-27c8-8d13-a77e-10f9f7f20b8c,412ed08d-f045-8575-8053-8c2916dc7049,a0740336-348e-89c3-806e-73bd38a00bd1,08c28188-7e1d-835f-9ea6-35df65747258,6879722d-97c8-8ebc-b2c5-a7ad22a5fb95,3dffdef8-6721-8dba-af87-c3e3228594cc,adab0533-31e3-83bb-932d-702fdc42f92e,17f22a33-68d6-8ef5-8a2d-72c0a865c4b8}	t	\N	f	4	4	2026-08-23 10:25:13.787+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	f4c17d81-0f88-8f70-86bf-f48e5ec04854	{1ac3d6e5-715f-8631-a1a8-af350723e7cf,a58eea9c-e6fd-83e6-bd80-2898667deeb5,db90dd14-d1c1-8418-807c-c29aa31f9192,65474646-0e19-8cac-9626-9e11b50c2b16,c2efda5d-6fbf-8a38-bb33-9c69724cd800,9979d9c0-e5ae-806a-b4f6-de7b67b4b7ce}	f	\N	f	1	3	2026-08-23 10:25:53.035+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	80e95d2a-436a-82b9-b270-a3336b065c3f	{459b5b38-3da7-81ca-b5df-ded5e82b9521}	t	\N	f	1	1	2026-08-23 10:26:41.922+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	ee897593-a4d0-8de2-af3b-3ca065d53e26	{}	f	\N	t	0	1	2026-08-23 10:26:52.076+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	{859e3d78-7e2a-8233-bf1f-90c76e3dfc3b}	f	\N	f	0	1	2026-08-23 10:27:30.826+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	0a91ac19-81f4-83f7-aea2-83f713b46764	{648e80ee-4d48-8f04-9def-e3e0fe01d75d}	t	\N	f	1	1	2026-08-23 10:27:50.863+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	5691bb7c-8592-8999-a296-143809294193	{47d526b7-1604-8378-add5-5b50dc1af505}	t	\N	f	1	1	2026-08-23 10:28:04.998+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	8b7978e3-2ade-893a-ba36-e7497326659c	{}	t	lsof -i :3000	f	1	1	2026-08-23 10:28:14.967+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	cfecff05-f00f-8178-97d7-27b450543d93	{70a8795b-5f5b-8ccb-82ea-64dc9f201775,3da46c85-5720-83e7-a2b0-42fc7f447975,f847657d-4e63-854a-994e-150743612f67,2aa96cc4-7186-8b0c-8da9-f91452988b49,63ab5027-deb4-86dd-a117-c303341d8d02,16d1870a-05dd-8553-9f60-5c3ed674220c}	t	\N	f	3	3	2026-08-23 10:28:35.005+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	4f0f05b6-6bcc-8201-9b2b-4a5b5975b505	{41e65bf1-4a79-8b46-b991-83f4a2991421,dff08d28-17cc-8a44-a708-310a0af77a37,325d5b36-cac8-8b57-8149-297b759cb4eb}	t	\N	f	1	1	2026-08-23 10:28:53.582+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	fd26ad66-1a47-8ba0-bf6c-2111da50584c	{498ca366-3276-87df-ad77-c9182f43feb1}	t	\N	f	1	1	2026-08-23 10:29:10.054+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	691f4b64-6f30-889c-836a-d09001606728	{}	t	rg "useState" -t tsx	f	1	1	2026-08-23 10:29:27.183+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	4e9568c2-787a-8d19-ba7c-5b0dc71a2c4f	{}	t	du -sh * | sort -h	f	1	1	2026-08-23 10:30:00.051+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	65789a15-ec78-8505-82ea-f4df69754a07	{}	f	grep -rin todo .	f	0	1	2026-08-23 10:30:19.368+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	be54437f-d5e9-876b-b691-27009848bb48	{23da1682-c10c-8c10-8f53-1b51fbb30702}	f	\N	f	0	1	2026-08-23 10:30:51.783+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	e43bbddf-419b-8165-bf19-3e8654f82eaf	{928ea9a9-247f-8297-b11e-328c96c7bd04,a1c4a25e-14b0-82b3-9747-c6bd38c1423d,b8ef4bdf-579d-8260-a524-9b2af1039ffc,f179a865-96aa-84c6-9eb8-c9ced0a8c211,43b51a40-7b77-893a-a159-c214185ac114,ada9e1e4-0e7e-8233-b5a1-b03c8c919edb}	t	\N	f	3	3	2026-08-23 10:31:18.217+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	f8a2fe7c-7da1-8a6b-bd07-af42744f554b	{89c2f5c8-b8a8-8281-b68e-39d4221f63aa}	t	\N	f	1	1	2026-08-23 10:31:27.099+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	75e38364-4e93-831f-8d1e-73f96601b1e8	{}	f	\N	t	0	1	2026-08-23 10:31:36.656+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	336283db-749b-8cea-b5b5-a670d877a41d	{}	f	\N	t	0	1	2026-08-23 10:32:05.262+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	9718cbdc-48f6-8e50-a412-a9589360f397	{ce0e115b-b873-8dfd-abb5-ab4a7e58e800}	t	\N	f	1	1	2026-08-23 10:32:30.811+00
ab51ef1d-cf6d-8234-ac72-8e06fadf0684	68444d79-c6c7-80ad-b5d4-0daf97754e11	{a9663eb2-871f-8e29-a3cd-4fd212153c2c,c8418673-b588-890c-9d45-2bda302707dc,281df6d0-2d34-8aae-8e14-4bb2448c5979,ec76d121-c177-845d-8ff7-97dbcee61b6f,49399125-02d4-823b-a3ab-9185979d827b,95ad92d0-17bd-8bdc-a40c-049bc6c26474}	t	\N	f	3	3	2026-08-23 10:33:00.195+00
56232963-20e4-47ed-b958-1905f2f124fd	eabe3965-0ce2-81a6-90f1-5f21e7f8e7e0	{856cd096-e6fd-8d5c-99f8-2ad87c3ec919}	f	\N	f	0	1	2026-08-25 15:48:36.694+00
\.


--
-- Data for Name: review_states; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.review_states (question_id, telegram_user_id, repetition_count, lapses, interval_days, stability, difficulty, last_reviewed_at, due_at, created_at, updated_at) FROM stdin;
818c6acd-d71c-884f-b789-200afa196196	797736131	3	0	\N	\N	\N	2026-08-16 06:53:40.558+00	2026-08-23 00:00:00+00	2026-08-15 20:47:22.407+00	2026-08-16 06:53:40.561+00
cd281ab2-0b80-8059-ac87-cca56165b018	797736131	3	0	\N	\N	\N	2026-08-16 06:53:40.558+00	2026-08-23 00:00:00+00	2026-08-15 20:47:22.407+00	2026-08-16 06:53:40.561+00
bd1b441b-be06-815e-a8ef-438fa70764ad	797736131	3	0	\N	\N	\N	2026-08-16 06:53:40.558+00	2026-08-23 00:00:00+00	2026-08-15 20:47:22.407+00	2026-08-16 06:53:40.561+00
f54ae8b5-f277-8127-80df-11f274168b39	797736131	4	0	\N	\N	\N	2026-08-19 20:41:07.607+00	2026-09-02 00:00:00+00	2026-08-15 20:48:12.613+00	2026-08-19 20:41:07.61+00
f1f2d4f1-55f6-85d9-847f-97bf74b4b49c	797736131	4	0	\N	\N	\N	2026-08-19 20:41:07.607+00	2026-09-02 00:00:00+00	2026-08-15 20:48:12.613+00	2026-08-19 20:41:07.61+00
877742ee-5068-8db5-af02-6c30eefc4f2d	797736131	4	0	\N	\N	\N	2026-08-19 20:41:07.607+00	2026-09-02 00:00:00+00	2026-08-15 20:48:12.613+00	2026-08-19 20:41:07.61+00
29fa93aa-0d3c-8809-bd19-bbc794792ecf	797736131	3	1	\N	\N	\N	2026-08-19 20:41:07.607+00	2026-08-26 00:00:00+00	2026-08-15 20:48:12.613+00	2026-08-19 20:41:07.61+00
f1037adb-1988-8b66-bad2-ffa44ed0825e	797736131	1	1	\N	\N	\N	2026-08-19 21:42:26.355+00	2026-08-20 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-19 21:42:26.36+00
1924c112-1179-8e2f-ad89-68063c0fb4ba	797736131	1	1	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
6b378dee-6b57-89e1-9353-e8523409b93e	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
8ab7e970-c7c3-831d-897c-a3909736a573	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
926f924e-f393-85df-9a9c-d0207306c0c1	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
af729aba-bb95-8766-b73c-6b81997dd7b7	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
0e7e852f-e50b-8952-bc3e-c0c83de81cac	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
b931cb06-d05e-8ec6-9795-c489217db379	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
a24b40d9-727d-81ed-98f1-b989e072a0a0	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
efc13df1-fda7-8b42-8fcb-ca888f4545d5	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
be6554d4-f65c-811c-a2d7-0a66b186bc2c	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
02c3c4b9-5132-8b3e-9114-c9f146ad4f63	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
60b4995a-c666-8a54-bae4-ea04723842b7	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
ea37c658-195d-840c-a522-1955c7c6f53f	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
e7678d2e-ded4-8dbc-ac4e-7a1c3bf4acb7	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
fe874b23-e369-8879-a5cb-e44f41453788	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
9f1784c8-79a9-8412-ac89-aa73c30edb4b	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
78f9fdd3-d042-82f6-9f78-72fd962f617b	797736131	1	1	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
8dfd3a56-a49e-8031-afaa-39c372f61ec9	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
0f529282-d38c-8783-8b0b-f65e31c4abc0	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
4c256dee-8118-8976-945c-99e84cacea9b	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
a53aa7ae-7e47-8eb1-bb3b-5ef27ec5d3aa	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
7bff993f-8a2e-8c2a-8d1b-e57e392574a5	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
67493a3e-9e27-831e-b630-1b721eca7d41	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
d8148550-5148-8b1e-974b-6ed02a6754c1	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
6732320d-e771-86b1-8afb-292069131611	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
4bda6e56-3c08-82fb-b6d9-87e8e37fd461	797736131	1	1	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
00ca5865-c1a1-88f1-b3b8-dade63883e8d	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
77ab2f42-4ae7-8b10-8fea-15e43c590a57	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
94cec9f1-4846-84b1-9dc8-8d93efd417ad	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
0354deb1-6fb6-88a3-a2ac-4bb19afb7224	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
0b73f77e-db3d-8899-a73d-c60fb6c29683	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
7e92a1d0-a3f6-83fc-a7be-e88f71419f68	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
0f08d9e8-0b97-82e5-9bfa-d7931ba7c404	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
e53929bf-d21f-8806-82ff-7530cdcf641a	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
a8efb48a-b05e-8768-b3fd-bcfbdb9ed074	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
ddbc9a48-4047-8646-ac6d-6e85ded76f42	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
d23670eb-5087-8357-9940-175b65829981	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
01a2cbe4-f74d-88c9-a8a3-514b3ecf4f97	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
bdecf5a6-62bd-8b62-bdc6-6a9f54c2831c	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
43cb3fe3-b62c-8baf-b77c-28f9c1ad529e	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
c5555818-485c-8f68-985f-bfd5fddc5eba	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
f14b8c4d-1afc-8adc-9006-308318e0e258	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
024c7c63-d5f4-8f29-9470-ca3af756dc51	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
13561850-3a37-82af-84ce-454f4caf47fe	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
cf7bb76e-641e-8b56-bccc-9de7922c735e	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
5affe485-36d6-8a5e-8992-eb9f9d093cbf	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
fc1c519c-dee8-8641-9d33-182724f0e452	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
833020c1-5468-88f3-a31c-f81a99229fe4	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
f021f898-d2cc-887e-84be-dc02c320abd2	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
bf9f079f-f9ed-8ad0-86bf-d1c0e2aefc02	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
200dd31c-b6ea-8d44-a350-1c2daf328f30	797736131	1	0	\N	\N	\N	2026-08-17 17:26:59.655+00	2026-08-18 00:00:00+00	2026-08-17 17:26:59.67+00	2026-08-17 17:26:59.67+00
485bea2b-95ad-8185-b0ea-48befaef18ad	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
c2fa4fd5-de53-8ade-87e8-781b4ddb67c2	797736131	1	1	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
03048403-511c-85ec-86e4-378e9117b5db	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
d815296e-fc38-82e9-afe6-cdb07814ca9d	797736131	1	1	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
9a18a4db-0dbb-8e43-b47f-f5560016dedb	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
f4fccf84-7594-8ab7-ad24-959184667926	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
853e9353-933b-853b-a927-92bde0685559	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
f1ea73ab-6036-8a5c-8eee-b2d75e91b74b	797736131	1	1	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
ab87fbf3-6331-8bef-a903-f673df12aa0b	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
eb365fc9-8ea7-8f18-b591-43a21df9fa29	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
9f22978d-d803-8181-a4d6-8e7ee9a5fc8a	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
02cdf03d-9f2c-8ce4-8662-10289e1887c0	797736131	1	1	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
f9c7d64f-a85d-85f7-b0b3-e73367bfad01	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
3c8437d0-01fe-8296-b103-0d88203c29f4	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
240ed98f-7280-8081-ac83-966292f63e5d	797736131	1	1	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
9bf90618-9cff-8bf9-a04a-d7069086ec32	797736131	1	0	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
725a8b84-0a4d-80d9-9dce-b885f56a676c	797736131	1	1	\N	\N	\N	2026-08-20 18:20:32.046+00	2026-08-21 00:00:00+00	2026-08-20 18:20:32.057+00	2026-08-20 18:20:32.057+00
d753cdd4-4d6e-8b96-b924-b979f66ec8c6	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
788c11ea-b800-8c85-ab83-0df2e4f3923c	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
40a40575-be0e-8573-af1a-ddd4b1862ce5	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
468da566-061c-8d59-9974-55c09e8215bb	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
d65cfb4c-062a-8450-bba8-ccb846fe76a1	797736131	1	1	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
86557979-9c3c-8f79-80cb-329e36c5e99e	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
2bd04385-e605-8bf3-b2f1-e0a7c36cd766	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
bd2c9751-98b0-88f7-9223-f29721376a9e	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
6f9b6517-a5d3-8721-bef9-ff23a3809351	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
77866774-fb69-8499-8aa7-f8530ca764dc	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
1714869f-9ff5-8137-a14b-a99a945cf514	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
15535a2d-826e-8205-a33b-41f47925d22e	797736131	1	1	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
34f29309-50df-8290-b944-03e027d0c59d	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
deeeb039-35df-854d-a816-601d7386c7ce	797736131	1	1	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
01ffa53b-2875-8d4c-95f5-da4c04c89f9e	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
ba03a02e-7bcf-8475-952a-7c760012c37e	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
feadd348-a8d7-84f7-9e20-d9849b3d4157	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
95871f4e-3c26-8d26-88e6-572d96da602f	797736131	1	1	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
79b0379a-b3e1-88ea-b3e6-8c9cbfe53441	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
800e98ae-c6b5-824b-826c-c8cffe76ff57	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
8b76ee55-c231-8734-8e63-384a82f24116	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
517567ba-4265-8ef8-849a-6a3c7890eeea	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
680c9336-42f1-84fe-b056-2611e0450aa5	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
1c19d9ac-239b-8cc5-8059-d54271d9ba38	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
868f6f7d-37cc-88f0-8d60-3c3651525291	797736131	1	0	\N	\N	\N	2026-08-20 18:32:13.042+00	2026-08-21 00:00:00+00	2026-08-20 18:32:13.049+00	2026-08-20 18:32:13.049+00
ac4aa3b3-11c9-8125-aa74-261b5e56310e	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
eeb52fd5-522c-80dc-a4f7-c2a83b44421c	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
e807fc11-1c84-8a95-b8c7-89dd5b7e37d7	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
fd427a6d-34dc-88b4-b938-f00097aabda9	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
9a211a19-8d92-825c-819d-f45f08b1dbb0	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
a2f0de50-cb8f-84d4-a3af-6e8b4c2f5e8c	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
79220895-4e55-8f69-8ba0-5faad9e97f12	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
10b59ad5-03cb-86fc-a265-9ceb0a087bd0	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
4f8ee8f6-8326-8b5f-a6bc-b2124b9f9d40	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
cbcf50c3-cc39-8e64-a91e-4e2c2c87f965	797736131	1	1	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
20010d78-12a6-8783-bc7f-386366215af6	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
98d2f28b-b220-8068-9755-1eae8ff052d2	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
ee939949-2555-851e-9674-f27bebab1af0	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
d787de3a-98bd-8d5b-be33-fa8c801a8e46	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
2834179a-ca26-8275-92a3-b05000ccb4b1	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
3c8c3c15-79fa-8ee9-918b-ef8495d69cad	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
89e593ff-4696-8e64-8c9d-5d386aa2b437	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
3c637446-91c1-8984-9563-80c1bcd8f0b3	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
f31739e3-4257-8ee6-8fcc-377f3f275fa4	797736131	1	1	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
5f318fff-368e-85d2-9fc5-59f8efa0d6dd	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
22cd375b-1acf-8360-ba2a-26e3b4f1c529	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
2cfa8251-a04b-8e69-a160-89bf1b78e622	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
5dd4bdfd-e18d-87ff-9f05-9c3447893b49	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
e3dbcafa-212f-857c-a6c4-2e9b61cf30e4	797736131	1	1	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
9a68cdf4-4762-85b8-b981-b95361a814e3	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
a2c9db1c-b994-8c9f-9a42-1b4e66602fe6	797736131	1	0	\N	\N	\N	2026-08-20 18:44:36.581+00	2026-08-21 00:00:00+00	2026-08-20 18:44:36.589+00	2026-08-20 18:44:36.589+00
0a1e0b3e-568e-8a69-bb3f-25e97af7fd04	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
c4ccdb06-8158-8298-a9fe-33d186ee146e	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
518b33e1-4334-8a58-84b1-0dd99cdac6ce	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
70200632-c1de-8d49-babd-170d2b896826	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
1ec19a39-3492-8435-a404-bc53f87dc33a	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
251ffd80-870d-8f7b-b149-aaa077b66e47	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
28d48723-0ad1-8ffa-804a-fa45f0bfda83	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
547d8cd7-55dc-81ed-8dd4-ed5f115ea42b	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
48dfcd45-c54f-8827-930f-786dfe516c63	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
1870667a-01ad-8bb2-9ff1-243c8b27ae5a	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
98200032-2db8-8e2d-b646-f885d9ca4259	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
1f410f44-b11d-88f7-b3eb-7d43ce35c7b1	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
4a0f96f0-653a-81df-a77c-384300dade32	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
64fabd3d-6863-8422-907a-250c3ab5b289	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
fa190593-0f0f-872c-9dc0-88516b47f762	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
b08dcd53-dc0a-8705-a742-6e4c50302aa5	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
c73ca850-0c62-8370-bb20-ff10b9ef8ed1	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
cb7a8a42-6975-8ce3-bcff-723bffbb3b6e	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
762cd5b1-d4fa-833f-9f7a-5d64162d960d	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
e0d32edc-4908-83e4-805f-8945c738605c	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
52ba481c-097d-8cea-bb3f-9f43ed2b2be1	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
0ba44dfc-8221-8888-ba76-ac30a34ca3a1	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
f63867aa-4dea-82bd-b5f4-def14df0b116	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
e6efc7ff-23ee-8457-8254-8d01416835a2	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
8cfbb9bb-4db9-836e-b2b2-3cec3c532aad	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
fffb38a6-067b-8733-bc78-3162c40cbf6a	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
fef1cb06-7f6a-8698-a69a-6d9895bf82bf	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
e36595fa-b28d-8cf0-916e-d8b649288822	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
f72f46ef-b6d4-89aa-a473-c5ec5089c5a5	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
29149c08-624b-8964-8532-e7bb888eafd3	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
6ea13554-4f77-8120-a798-703b4efcd29c	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
cf13f13c-e8e9-8c93-858a-4df6a31c258c	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
d9606bee-fed2-8305-8fc4-18117c0dcba3	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
09be3ff3-1403-891d-aea7-d6ae41a62bc8	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
efa69e8b-d383-8371-b742-716e644512f4	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
94e04a34-a3d5-8c41-a8b3-d49dd6eaf7c2	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
226ce076-a057-8ef8-a48e-0669ad379701	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
c1b61b3f-d9ea-87db-a256-3e5ab2686e53	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
81e06311-a749-8c85-b477-4c2c213c0db5	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
d9cf128e-ecea-8533-b85c-eab045522b9a	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
3dc0172a-bad6-89de-8207-cff14f2b95f5	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
0f67d24b-0a4f-8acb-9858-1cf7db90f854	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
7b0be6e7-7d15-8d22-a99c-c008bee13204	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
27b0780a-72a9-898b-95b6-593afbb151f5	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
ee033d47-a447-8c33-8f22-da9c2c1139ba	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
902657f7-edd5-828f-8768-56e35f1166b6	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
1789be8f-08a0-8c7d-ad5a-ca56c5070b12	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
6e65f4d6-d90b-8157-9002-f7118f211efe	797736131	1	0	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
c1f0db99-722f-8a49-afef-939116ea9e24	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
b206788a-01b9-8fd2-bd71-a2c9415ba174	797736131	1	1	\N	\N	\N	2026-08-23 10:10:11.91+00	2026-08-24 00:00:00+00	2026-08-23 10:10:11.915+00	2026-08-23 10:10:11.915+00
c37c9ae4-666f-801c-892d-16efaf60a66d	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
9c74ca3a-2b16-8874-8ec2-7e80c592e2a5	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
13525375-1855-87f9-a506-ad882d6e9662	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
2bf82f23-7734-8f97-9e42-97abb45eefa6	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
19e41824-9f9a-8bdf-a04f-1ed6e9a61a62	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
1ad09b97-f93c-8a17-b194-dc1cf2067597	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
c2af6150-ffac-8294-8e92-fd0281ffce05	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
f769fe1c-d743-88a2-9add-f1cc3f94fe03	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
c7e7d4d9-1faa-888a-8614-f4e329ef6f16	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
8c7e731b-b835-8095-9b01-56763a4209d9	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
658715ed-295b-84ab-9144-c532e6b4ee79	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
f05f6c34-a38a-8b7a-bc0c-5d6f2b20d0df	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
290c3db5-299b-8d89-8151-1d9abc8584d7	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
c2c200f0-4559-8d23-8883-8b5577a99c9e	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
54e7ac12-7800-846c-833f-6e8bdf55ea7d	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
db2f66db-5d99-823d-a2ec-3f29d907b28f	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
bf69aa1e-d263-882f-93ca-94634446955b	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
3d9c4cc6-2e85-886e-91c9-a135a8467c45	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
7f738a26-77d8-802c-a087-d96d3083c5d3	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
7338cf96-f8e7-8d6f-80b8-bc2233d1e1d1	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
f8101924-53a1-8a05-98fe-0f7543eba194	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
1a963fd5-5a70-890d-8500-a4076dddd161	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
727a7d0e-a227-852b-9493-e6e5516f5093	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
a6ad60b9-0b48-82bb-98ea-edc36fbf1756	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
daa7f706-e343-8d89-969f-a2ef67eb4ac9	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
cf9a6f8d-d091-8c5d-80e3-1db49f31623a	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
ca01857e-ebd2-8cad-af43-7c9d5f2e1849	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
4050b806-1050-896c-963a-30fbfa3a383b	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
6cf248b3-ef20-81c0-8ffd-25cb9020ada0	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
2f3a6ad2-3e01-8532-aadd-18e0cffece86	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
f4c17d81-0f88-8f70-86bf-f48e5ec04854	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
80e95d2a-436a-82b9-b270-a3336b065c3f	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
ee897593-a4d0-8de2-af3b-3ca065d53e26	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
bb9a02f1-7347-8eac-8de3-0bfa06d68dcc	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
0a91ac19-81f4-83f7-aea2-83f713b46764	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
5691bb7c-8592-8999-a296-143809294193	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
8b7978e3-2ade-893a-ba36-e7497326659c	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
cfecff05-f00f-8178-97d7-27b450543d93	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
4f0f05b6-6bcc-8201-9b2b-4a5b5975b505	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
fd26ad66-1a47-8ba0-bf6c-2111da50584c	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
691f4b64-6f30-889c-836a-d09001606728	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
4e9568c2-787a-8d19-ba7c-5b0dc71a2c4f	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
65789a15-ec78-8505-82ea-f4df69754a07	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
be54437f-d5e9-876b-b691-27009848bb48	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
e43bbddf-419b-8165-bf19-3e8654f82eaf	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
f8a2fe7c-7da1-8a6b-bd07-af42744f554b	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
75e38364-4e93-831f-8d1e-73f96601b1e8	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
336283db-749b-8cea-b5b5-a670d877a41d	797736131	1	1	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
9718cbdc-48f6-8e50-a412-a9589360f397	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
68444d79-c6c7-80ad-b5d4-0daf97754e11	797736131	1	0	\N	\N	\N	2026-08-23 10:33:01.101+00	2026-08-24 00:00:00+00	2026-08-23 10:33:01.105+00	2026-08-23 10:33:01.105+00
\.


--
-- Data for Name: study_settings; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.study_settings (id, scope_type, scope_id, intervals_days, max_interval_days, max_repetitions, shuffle_options, shuffle_questions, exam_mode, updated_at) FROM stdin;
9773502f-de51-8630-9128-6f4a885747bf	owner	\N	{1,3,7,14,30}	30	10	t	f	f	2026-08-16 06:53:20.648+00
38a2833b-aa78-885d-a70c-063cf1ab298a	quiz	26205776-4908-8a07-ac8e-aa997bd7b85e	{1,3,7,14,30}	30	10	t	f	t	2026-08-19 20:40:28.315+00
fa856bc9-4964-80f2-b065-e65110f1eff5	quiz	5143fe75-0dde-8625-a96a-888f7f33fea4	{1,3,7,14,30}	30	10	t	t	f	2026-08-19 21:40:29.75+00
baab7d21-4b86-8b36-a29a-0600fc134c85	quiz	399d7d59-7f36-8c81-b878-ffd73a0c830b	{1,3,7,14,30}	30	10	t	t	f	2026-08-20 17:50:23.862+00
13fd58b5-8bfe-8af0-abc2-4d5a6191dd20	quiz	078d0047-2b60-8c52-8b81-e0ebf4b3c79a	{1,3,7,14,30}	30	10	t	t	f	2026-08-20 17:50:28.34+00
9415a1a7-018f-812a-9710-4a69c62c499b	quiz	8d50a017-1da9-8de5-bf68-ffcbebad128f	{1,3,7,14,30}	30	10	t	t	f	2026-08-23 08:51:02.676+00
4f0b1dc8-73bb-8a00-9ba2-7128ceaa03ac	quiz	0d02bfdf-2283-8b2a-8ea3-e54883dbab53	{1,3,7,14,30}	30	10	t	t	f	2026-08-23 08:51:06.973+00
\.


--
-- Data for Name: term_pairs; Type: TABLE DATA; Schema: public; Owner: recall
--

COPY public.term_pairs (id, legacy_id, quiz_id, terms, translations, transcription, example, topic, created_at, updated_at, deleted_at) FROM stdin;
c170a1a5-8ca3-86e8-870f-ad1097ef45b1	085d191n0p6p014g1w	5143fe75-0dde-8625-a96a-888f7f33fea4	{T-shirt}	{футболка,футболку}	\N	I am wearing a white T-shirt.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
6666c300-07d7-8616-ad29-9bdf7069b144	6p1c5x1c283i4i1j6j	5143fe75-0dde-8625-a96a-888f7f33fea4	{shirt}	{сорочка,сорочку}	\N	He wears a blue shirt.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
ae789aff-e7f8-846f-8f43-d27cec8588e9	4j383g4m633n093i63	5143fe75-0dde-8625-a96a-888f7f33fea4	{blouse}	{блузка,блузку}	\N	Her blouse is white.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
8bf19ea5-f65f-873d-89f1-5fc8a006b9db	346e1a2s211q5z0u0f	5143fe75-0dde-8625-a96a-888f7f33fea4	{sweater}	{светр,светра}	\N	This sweater is warm.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
2368188f-d472-8ee2-ae22-3a58351522fe	6r5k4l5p1t5u1h0j65	5143fe75-0dde-8625-a96a-888f7f33fea4	{hoodie}	{худі}	\N	My hoodie is grey.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
305a393f-6885-8cea-a68c-7c5185c1a386	4y5h19116p050e4q2c	5143fe75-0dde-8625-a96a-888f7f33fea4	{jacket}	{куртка,куртку}	\N	Put on your jacket.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
7df0e550-4ad4-8077-8082-87ecf8dab967	312h060l4y1u4i183s	5143fe75-0dde-8625-a96a-888f7f33fea4	{coat}	{пальто}	\N	She has a long coat.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
1a1f1b17-eb8e-8ebf-91ba-08bec0ccf5b7	4l1l62536m2o064n21	5143fe75-0dde-8625-a96a-888f7f33fea4	{dress}	{сукня,сукню}	\N	The dress is red.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
7045cd00-0195-8600-afd1-1829d4d49278	3t6c0z0m0h4q3x2h18	5143fe75-0dde-8625-a96a-888f7f33fea4	{skirt}	{спідниця,спідницю}	\N	Her skirt is black.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
c15907c7-24e5-8718-910a-448b36255345	2s3q2h0m5f5z275b6q	5143fe75-0dde-8625-a96a-888f7f33fea4	{jeans}	{джинси}	\N	These jeans are blue.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
d9a4ac37-609f-8123-9594-5a6d94155a05	723y4a571s6s3t2w21	5143fe75-0dde-8625-a96a-888f7f33fea4	{trousers}	{штани}	\N	His trousers are brown.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
c86112a4-b92b-8ba2-8faf-293352cc3d50	3t1y5d53161o6o6465	5143fe75-0dde-8625-a96a-888f7f33fea4	{shorts}	{шорти}	\N	I wear shorts in summer.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
6a37787e-0731-8261-9e81-ca280aaec738	4i0z682j6g0d123g51	5143fe75-0dde-8625-a96a-888f7f33fea4	{suit}	{костюм,костюма}	\N	He wears a suit to work.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
247597eb-e779-857a-bc43-d7bd1d47a9ad	4u5o452g3j2l2x0d47	5143fe75-0dde-8625-a96a-888f7f33fea4	{uniform}	{форма,форму}	\N	We wear a school uniform.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
188ca045-083f-8a31-84a4-d16736885160	6d4t1v1y2o3i1b1f0x	5143fe75-0dde-8625-a96a-888f7f33fea4	{pyjamas}	{піжама,піжаму}	\N	My pyjamas are comfortable.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
132edc7b-0e31-8675-a15c-d8b6e53c9cd0	4v103q464o5x1v1w54	5143fe75-0dde-8625-a96a-888f7f33fea4	{underwear}	{"нижня білизна","нижню білизну"}	\N	Pack clean underwear.	Clothes	2026-08-19 21:39:44.874+00	2026-08-19 21:39:44.874+00	\N
94455320-b001-8b2e-9d70-8b7d003b9eb9	2x245k544u2q2c3s6l	5143fe75-0dde-8625-a96a-888f7f33fea4	{socks}	{шкарпетки}	\N	These socks are warm.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
2647184a-5388-8f3a-9a38-68a1c8f0a466	4k6d6d4362075d3o3y	5143fe75-0dde-8625-a96a-888f7f33fea4	{shoes}	{туфлі,взуття}	\N	Her shoes are new.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
3aaf2743-6236-85a5-8bf6-29f9321e2ad3	0o41184f0h493k462i	5143fe75-0dde-8625-a96a-888f7f33fea4	{trainers}	{кросівки}	\N	I run in trainers.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
329e7ae0-0101-8bd1-a6b2-825e3c1b7f24	1k4c6z1l3u5m6h0s36	5143fe75-0dde-8625-a96a-888f7f33fea4	{boots}	{чоботи}	\N	Wear boots in the snow.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
25783aa9-16ee-8089-ae9a-ec640e62461c	5v2i216x5l5t664j5p	5143fe75-0dde-8625-a96a-888f7f33fea4	{sandals}	{сандалі}	\N	Sandals are good for summer.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
e18951e8-ece8-8bbb-9f7f-6a8ea3f28bda	55286v471g154j1q26	5143fe75-0dde-8625-a96a-888f7f33fea4	{hat}	{капелюх,капелюха}	\N	He is wearing a hat.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
0477edc4-d6a1-89ae-9794-bcda7ba73ff4	60572t4z362t2g533c	5143fe75-0dde-8625-a96a-888f7f33fea4	{cap}	{кепка,кепку}	\N	My cap is green.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
26c7b3f6-e5d2-8161-85e4-34d0729351e3	25006v3p5a5r225g1w	5143fe75-0dde-8625-a96a-888f7f33fea4	{scarf}	{шарф,шарфа}	\N	This scarf is warm.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
23e18b8e-0650-84b8-97c0-3bf5e5ef9b56	662w6l5h6t1h4g6401	5143fe75-0dde-8625-a96a-888f7f33fea4	{gloves}	{рукавички}	\N	I need gloves in winter.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
626e069b-6d07-8076-b765-8a354cb37ae0	4n6f4y4y0k1y5j6v2i	5143fe75-0dde-8625-a96a-888f7f33fea4	{belt}	{ремінь,ременя}	\N	This belt is black.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
6f048ec5-d0fa-822e-9dd8-667756eb35b6	0x2v5h434n025n0f16	5143fe75-0dde-8625-a96a-888f7f33fea4	{tie}	{краватка,краватку}	\N	His tie is red.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
49ca713d-3f25-89c4-bd63-e57767d7e207	064q032b6x0m0t1e1c	5143fe75-0dde-8625-a96a-888f7f33fea4	{bag}	{сумка,сумку}	\N	Her bag is small.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
77fda670-b5e3-8928-95ad-c0d809cd3d32	6u666d6o6k361x1832	5143fe75-0dde-8625-a96a-888f7f33fea4	{pocket}	{кишеня,кишеню}	\N	My phone is in my pocket.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
97c83bea-a6b5-882d-9647-34ce1dad622f	5t16423q2z2k3n2b2p	5143fe75-0dde-8625-a96a-888f7f33fea4	{zip}	{блискавка,блискавку}	\N	Close the zip on your jacket.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
2b06d5cf-ee62-85a1-a1da-5891318d4c64	3v1r0c1o4f5f29416k	5143fe75-0dde-8625-a96a-888f7f33fea4	{button}	{ґудзик,гудзик}	\N	This shirt has six buttons.	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
aff388ff-259f-8033-bc1a-33f8a199b68c	370c300e6l1v1d3l3v	5143fe75-0dde-8625-a96a-888f7f33fea4	{size}	{розмір,розміру}	\N	What size do you need?	Clothes	2026-08-19 21:39:48.546+00	2026-08-19 21:39:48.546+00	\N
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: recall
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: recall
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: attempt_questions attempt_questions_attempt_id_position_pk; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_attempt_id_position_pk PRIMARY KEY (attempt_id, "position");


--
-- Name: attempt_questions attempt_questions_attempt_question_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_attempt_question_unique UNIQUE (attempt_id, question_id);


--
-- Name: attempts attempts_legacy_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_legacy_unique UNIQUE (legacy_id);


--
-- Name: attempts attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_pkey PRIMARY KEY (id);


--
-- Name: pages pages_legacy_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_legacy_unique UNIQUE (legacy_id);


--
-- Name: pages pages_parent_slug_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_parent_slug_unique UNIQUE NULLS NOT DISTINCT (parent_id, slug);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: question_options question_options_legacy_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_legacy_unique UNIQUE (legacy_id);


--
-- Name: question_options question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_pkey PRIMARY KEY (id);


--
-- Name: question_options question_options_question_position_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_question_position_unique UNIQUE (question_id, "position");


--
-- Name: question_sources question_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.question_sources
    ADD CONSTRAINT question_sources_pkey PRIMARY KEY (question_id);


--
-- Name: questions questions_legacy_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_legacy_unique UNIQUE (legacy_id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: questions questions_quiz_fingerprint_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_quiz_fingerprint_unique UNIQUE (quiz_id, fingerprint);


--
-- Name: questions questions_quiz_position_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_quiz_position_unique UNIQUE (quiz_id, "position");


--
-- Name: quiz_attachments quiz_attachments_page_id_quiz_id_pk; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.quiz_attachments
    ADD CONSTRAINT quiz_attachments_page_id_quiz_id_pk PRIMARY KEY (page_id, quiz_id);


--
-- Name: quizzes quizzes_legacy_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_legacy_unique UNIQUE (legacy_id);


--
-- Name: quizzes quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);


--
-- Name: responses responses_attempt_id_question_id_pk; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_attempt_id_question_id_pk PRIMARY KEY (attempt_id, question_id);


--
-- Name: review_states review_states_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.review_states
    ADD CONSTRAINT review_states_pkey PRIMARY KEY (question_id);


--
-- Name: study_settings study_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.study_settings
    ADD CONSTRAINT study_settings_pkey PRIMARY KEY (id);


--
-- Name: study_settings study_settings_scope_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.study_settings
    ADD CONSTRAINT study_settings_scope_unique UNIQUE NULLS NOT DISTINCT (scope_type, scope_id);


--
-- Name: term_pairs term_pairs_legacy_unique; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.term_pairs
    ADD CONSTRAINT term_pairs_legacy_unique UNIQUE (legacy_id);


--
-- Name: term_pairs term_pairs_pkey; Type: CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.term_pairs
    ADD CONSTRAINT term_pairs_pkey PRIMARY KEY (id);


--
-- Name: attempts_quiz_status_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX attempts_quiz_status_idx ON public.attempts USING btree (quiz_id, status);


--
-- Name: pages_parent_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX pages_parent_idx ON public.pages USING btree (parent_id);


--
-- Name: quiz_attachments_quiz_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX quiz_attachments_quiz_idx ON public.quiz_attachments USING btree (quiz_id);


--
-- Name: quizzes_page_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX quizzes_page_idx ON public.quizzes USING btree (page_id);


--
-- Name: quizzes_status_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX quizzes_status_idx ON public.quizzes USING btree (status, updated_at);


--
-- Name: responses_question_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX responses_question_idx ON public.responses USING btree (question_id);


--
-- Name: review_states_due_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX review_states_due_idx ON public.review_states USING btree (due_at);


--
-- Name: term_pairs_quiz_idx; Type: INDEX; Schema: public; Owner: recall
--

CREATE INDEX term_pairs_quiz_idx ON public.term_pairs USING btree (quiz_id);


--
-- Name: attempt_questions attempt_questions_attempt_id_attempts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_attempt_id_attempts_id_fk FOREIGN KEY (attempt_id) REFERENCES public.attempts(id) ON DELETE CASCADE;


--
-- Name: attempt_questions attempt_questions_question_id_questions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.attempt_questions
    ADD CONSTRAINT attempt_questions_question_id_questions_id_fk FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE RESTRICT;


--
-- Name: attempts attempts_quiz_id_quizzes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_quiz_id_quizzes_id_fk FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: pages pages_parent_id_pages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_parent_id_pages_id_fk FOREIGN KEY (parent_id) REFERENCES public.pages(id) ON DELETE RESTRICT;


--
-- Name: question_options question_options_question_id_questions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_question_id_questions_id_fk FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: question_sources question_sources_question_id_questions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.question_sources
    ADD CONSTRAINT question_sources_question_id_questions_id_fk FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: question_sources question_sources_term_pair_id_term_pairs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.question_sources
    ADD CONSTRAINT question_sources_term_pair_id_term_pairs_id_fk FOREIGN KEY (term_pair_id) REFERENCES public.term_pairs(id) ON DELETE CASCADE;


--
-- Name: questions questions_quiz_id_quizzes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_quiz_id_quizzes_id_fk FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE RESTRICT;


--
-- Name: quiz_attachments quiz_attachments_page_id_pages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.quiz_attachments
    ADD CONSTRAINT quiz_attachments_page_id_pages_id_fk FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: quiz_attachments quiz_attachments_quiz_id_quizzes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.quiz_attachments
    ADD CONSTRAINT quiz_attachments_quiz_id_quizzes_id_fk FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- Name: quizzes quizzes_page_id_pages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.quizzes
    ADD CONSTRAINT quizzes_page_id_pages_id_fk FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE SET NULL;


--
-- Name: responses responses_attempt_id_attempts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_attempt_id_attempts_id_fk FOREIGN KEY (attempt_id) REFERENCES public.attempts(id) ON DELETE CASCADE;


--
-- Name: responses responses_question_id_questions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_question_id_questions_id_fk FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE RESTRICT;


--
-- Name: review_states review_states_question_id_questions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.review_states
    ADD CONSTRAINT review_states_question_id_questions_id_fk FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- Name: term_pairs term_pairs_quiz_id_quizzes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: recall
--

ALTER TABLE ONLY public.term_pairs
    ADD CONSTRAINT term_pairs_quiz_id_quizzes_id_fk FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 527EeIQvc994vXJ3YHw4VAkcvNnJnmc3B3HAn6iGxhLEI27WLApxlbDq6fRgtam

