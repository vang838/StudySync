--
-- PostgreSQL database dump
--

\restrict sapeWENgU1Os2GbPe4GdTK7ziecLBmwmUGYFunQgmD4SR661OccedrNRskvVFhc

-- Dumped from database version 17.12 (Debian 17.12-1.pgdg13+1)
-- Dumped by pg_dump version 17.12 (Debian 17.12-1.pgdg13+1)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_evidence_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_evidence_assessments (
    id integer NOT NULL,
    chat_id character varying(32) NOT NULL,
    mode character varying(32) NOT NULL,
    evidence_status character varying(32) NOT NULL,
    citations json NOT NULL,
    claims json NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: chat_evidence_assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_evidence_assessments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_evidence_assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_evidence_assessments_id_seq OWNED BY public.chat_evidence_assessments.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    chat_id character varying(32) NOT NULL,
    role character varying(32) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_threads (
    chat_id character varying(32) NOT NULL,
    course_id character varying(128),
    question text NOT NULL,
    answer text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: course_forum_post_bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_forum_post_bookmarks (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: course_forum_post_bookmarks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_forum_post_bookmarks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_forum_post_bookmarks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_forum_post_bookmarks_id_seq OWNED BY public.course_forum_post_bookmarks.id;


--
-- Name: course_forum_post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_forum_post_likes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    post_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: course_forum_post_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_forum_post_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_forum_post_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_forum_post_likes_id_seq OWNED BY public.course_forum_post_likes.id;


--
-- Name: course_forum_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_forum_posts (
    post_id integer NOT NULL,
    course_id character varying(128) NOT NULL,
    user_id integer NOT NULL,
    parent_post_id integer,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: course_forum_posts_post_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_forum_posts_post_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_forum_posts_post_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_forum_posts_post_id_seq OWNED BY public.course_forum_posts.post_id;


--
-- Name: course_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_members (
    id integer NOT NULL,
    user_id integer NOT NULL,
    course_id character varying(128) NOT NULL,
    is_archived boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: course_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_members_id_seq OWNED BY public.course_members.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    course_id character varying(128) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    professor character varying(200),
    subject character varying(128) NOT NULL,
    year integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: document_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_chunks (
    chunk_id character varying(32) NOT NULL,
    job_id character varying(32) NOT NULL,
    chunk_index integer NOT NULL,
    text text NOT NULL,
    source_start_index integer,
    source_end_index integer,
    source_start_label character varying(128),
    source_end_label character varying(128),
    page_start integer,
    page_end integer,
    section_title character varying(512),
    token_count integer,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_document_chunk_index_nonnegative CHECK ((chunk_index >= 0))
);


--
-- Name: document_owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_owners (
    id integer NOT NULL,
    document_id character varying(32) NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: document_owners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_owners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_owners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_owners_id_seq OWNED BY public.document_owners.id;


--
-- Name: document_publications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_publications (
    id integer NOT NULL,
    document_id character varying(32) NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: document_publications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_publications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_publications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_publications_id_seq OWNED BY public.document_publications.id;


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    version_id character varying(32) NOT NULL,
    document_id character varying(32) NOT NULL,
    version_number integer NOT NULL,
    original_filename character varying(512) NOT NULL,
    declared_media_type character varying(128),
    detected_media_type character varying(128),
    file_size_bytes bigint NOT NULL,
    file_hash character varying(64) NOT NULL,
    content_hash character varying(64),
    object_key character varying(1024) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_document_file_size_nonnegative CHECK ((file_size_bytes >= 0)),
    CONSTRAINT ck_document_version_positive CHECK ((version_number >= 1))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    document_id character varying(32) NOT NULL,
    course_id character varying(128) NOT NULL,
    owner_ref character varying(128),
    title character varying(200) NOT NULL,
    is_published boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: flashcard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flashcard (
    flashcard_id integer NOT NULL,
    flashcardsets_id integer NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: flashcard_flashcard_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flashcard_flashcard_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flashcard_flashcard_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flashcard_flashcard_id_seq OWNED BY public.flashcard.flashcard_id;


--
-- Name: flashcard_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flashcard_sets (
    flashcard_set_id integer NOT NULL,
    user_id integer NOT NULL,
    course_id character varying(128) NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: flashcard_sets_flashcard_set_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flashcard_sets_flashcard_set_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flashcard_sets_flashcard_set_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flashcard_sets_flashcard_set_id_seq OWNED BY public.flashcard_sets.flashcard_set_id;


--
-- Name: flashcard_study_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flashcard_study_progress (
    id integer NOT NULL,
    user_id integer NOT NULL,
    flashcard_id integer NOT NULL,
    rating character varying(20) NOT NULL,
    last_reviewed_at timestamp with time zone NOT NULL
);


--
-- Name: flashcard_study_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.flashcard_study_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flashcard_study_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.flashcard_study_progress_id_seq OWNED BY public.flashcard_study_progress.id;


--
-- Name: forum_point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_point_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    delta_points integer NOT NULL,
    reason character varying(64) NOT NULL,
    related_post_id integer,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: forum_point_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.forum_point_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: forum_point_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.forum_point_transactions_id_seq OWNED BY public.forum_point_transactions.id;


--
-- Name: ingestion_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingestion_jobs (
    job_id character varying(32) NOT NULL,
    version_id character varying(32) NOT NULL,
    status character varying(32) NOT NULL,
    current_stage character varying(64),
    pipeline_version character varying(64),
    retry_count integer NOT NULL,
    failure_code character varying(64),
    failure_message text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT ck_ingestion_retry_nonnegative CHECK ((retry_count >= 0))
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id integer NOT NULL,
    forum_replies boolean NOT NULL,
    study_tasks boolean NOT NULL,
    study_materials boolean NOT NULL,
    challenges boolean NOT NULL,
    course_file_uploads boolean NOT NULL,
    saved_course_posts boolean NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    notification_id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(32) NOT NULL,
    title character varying(200) NOT NULL,
    message character varying(1000) NOT NULL,
    link character varying(500),
    is_read boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: notifications_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_notification_id_seq OWNED BY public.notifications.notification_id;


--
-- Name: professor_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professor_reviews (
    review_id integer NOT NULL,
    professor character varying(200) NOT NULL,
    course_id character varying(128) NOT NULL,
    user_id integer,
    rating integer NOT NULL,
    feedback text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_professor_review_rating CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: professor_reviews_review_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.professor_reviews_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: professor_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.professor_reviews_review_id_seq OWNED BY public.professor_reviews.review_id;


--
-- Name: study_planner_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_planner_preferences (
    user_id integer NOT NULL,
    auto_prioritization_enabled boolean NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: study_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.study_tasks (
    id character varying(36) NOT NULL,
    user_id integer NOT NULL,
    title character varying(200) NOT NULL,
    due_date character varying(10) NOT NULL,
    course character varying(200) NOT NULL,
    completed boolean NOT NULL,
    importance character varying(16) NOT NULL,
    kind character varying(32) NOT NULL,
    quadrant character varying(32) NOT NULL,
    quadrant_override character varying(32),
    estimated_hours double precision NOT NULL,
    estimated_pomodoros integer NOT NULL,
    completed_pomodoros integer NOT NULL,
    depends_on json NOT NULL,
    recurrence character varying(16) NOT NULL,
    last_pomodoro_session_id character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    public_id character varying(36) NOT NULL,
    user_first_name character varying(128) NOT NULL,
    user_last_name character varying(128) NOT NULL,
    user_email character varying(128) NOT NULL,
    password_hash character varying(258) NOT NULL,
    password_needs_update boolean NOT NULL,
    forum_points_balance integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: chat_evidence_assessments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_evidence_assessments ALTER COLUMN id SET DEFAULT nextval('public.chat_evidence_assessments_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: course_forum_post_bookmarks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_bookmarks ALTER COLUMN id SET DEFAULT nextval('public.course_forum_post_bookmarks_id_seq'::regclass);


--
-- Name: course_forum_post_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_likes ALTER COLUMN id SET DEFAULT nextval('public.course_forum_post_likes_id_seq'::regclass);


--
-- Name: course_forum_posts post_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_posts ALTER COLUMN post_id SET DEFAULT nextval('public.course_forum_posts_post_id_seq'::regclass);


--
-- Name: course_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_members ALTER COLUMN id SET DEFAULT nextval('public.course_members_id_seq'::regclass);


--
-- Name: document_owners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_owners ALTER COLUMN id SET DEFAULT nextval('public.document_owners_id_seq'::regclass);


--
-- Name: document_publications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_publications ALTER COLUMN id SET DEFAULT nextval('public.document_publications_id_seq'::regclass);


--
-- Name: flashcard flashcard_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard ALTER COLUMN flashcard_id SET DEFAULT nextval('public.flashcard_flashcard_id_seq'::regclass);


--
-- Name: flashcard_sets flashcard_set_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_sets ALTER COLUMN flashcard_set_id SET DEFAULT nextval('public.flashcard_sets_flashcard_set_id_seq'::regclass);


--
-- Name: flashcard_study_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_study_progress ALTER COLUMN id SET DEFAULT nextval('public.flashcard_study_progress_id_seq'::regclass);


--
-- Name: forum_point_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_point_transactions ALTER COLUMN id SET DEFAULT nextval('public.forum_point_transactions_id_seq'::regclass);


--
-- Name: notifications notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN notification_id SET DEFAULT nextval('public.notifications_notification_id_seq'::regclass);


--
-- Name: professor_reviews review_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professor_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.professor_reviews_review_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Name: chat_evidence_assessments chat_evidence_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_evidence_assessments
    ADD CONSTRAINT chat_evidence_assessments_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_threads chat_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_pkey PRIMARY KEY (chat_id);


--
-- Name: course_forum_post_bookmarks course_forum_post_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_bookmarks
    ADD CONSTRAINT course_forum_post_bookmarks_pkey PRIMARY KEY (id);


--
-- Name: course_forum_post_likes course_forum_post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_likes
    ADD CONSTRAINT course_forum_post_likes_pkey PRIMARY KEY (id);


--
-- Name: course_forum_posts course_forum_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_posts
    ADD CONSTRAINT course_forum_posts_pkey PRIMARY KEY (post_id);


--
-- Name: course_members course_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_members
    ADD CONSTRAINT course_members_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (course_id);


--
-- Name: document_chunks document_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_pkey PRIMARY KEY (chunk_id);


--
-- Name: document_owners document_owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_owners
    ADD CONSTRAINT document_owners_pkey PRIMARY KEY (id);


--
-- Name: document_publications document_publications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_publications
    ADD CONSTRAINT document_publications_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_object_key_key UNIQUE (object_key);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (version_id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (document_id);


--
-- Name: flashcard flashcard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard
    ADD CONSTRAINT flashcard_pkey PRIMARY KEY (flashcard_id);


--
-- Name: flashcard_sets flashcard_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_sets
    ADD CONSTRAINT flashcard_sets_pkey PRIMARY KEY (flashcard_set_id);


--
-- Name: flashcard_study_progress flashcard_study_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_study_progress
    ADD CONSTRAINT flashcard_study_progress_pkey PRIMARY KEY (id);


--
-- Name: forum_point_transactions forum_point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_point_transactions
    ADD CONSTRAINT forum_point_transactions_pkey PRIMARY KEY (id);


--
-- Name: ingestion_jobs ingestion_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingestion_jobs
    ADD CONSTRAINT ingestion_jobs_pkey PRIMARY KEY (job_id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: professor_reviews professor_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professor_reviews
    ADD CONSTRAINT professor_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: study_planner_preferences study_planner_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_planner_preferences
    ADD CONSTRAINT study_planner_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: study_tasks study_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_tasks
    ADD CONSTRAINT study_tasks_pkey PRIMARY KEY (id);


--
-- Name: document_owners uq_document_owner; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_owners
    ADD CONSTRAINT uq_document_owner UNIQUE (document_id, user_id);


--
-- Name: document_publications uq_document_publication; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_publications
    ADD CONSTRAINT uq_document_publication UNIQUE (document_id, user_id);


--
-- Name: document_versions uq_document_version_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT uq_document_version_number UNIQUE (document_id, version_number);


--
-- Name: flashcard_study_progress uq_flashcard_progress_user_card; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_study_progress
    ADD CONSTRAINT uq_flashcard_progress_user_card UNIQUE (user_id, flashcard_id);


--
-- Name: course_forum_post_bookmarks uq_forum_post_bookmark_user_post; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_bookmarks
    ADD CONSTRAINT uq_forum_post_bookmark_user_post UNIQUE (user_id, post_id);


--
-- Name: course_forum_post_likes uq_forum_post_like_user_post; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_likes
    ADD CONSTRAINT uq_forum_post_like_user_post UNIQUE (user_id, post_id);


--
-- Name: document_chunks uq_ingestion_chunk_index; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT uq_ingestion_chunk_index UNIQUE (job_id, chunk_index);


--
-- Name: professor_reviews uq_professor_review_user_professor_course; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professor_reviews
    ADD CONSTRAINT uq_professor_review_user_professor_course UNIQUE (user_id, professor, course_id);


--
-- Name: course_members uq_user_course_save; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_members
    ADD CONSTRAINT uq_user_course_save UNIQUE (user_id, course_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_public_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_public_id_key UNIQUE (public_id);


--
-- Name: ix_chat_evidence_assessments_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_chat_evidence_assessments_chat_id ON public.chat_evidence_assessments USING btree (chat_id);


--
-- Name: ix_chat_messages_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_chat_id ON public.chat_messages USING btree (chat_id);


--
-- Name: ix_chat_threads_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_threads_course_id ON public.chat_threads USING btree (course_id);


--
-- Name: ix_course_forum_post_bookmarks_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_forum_post_bookmarks_post_id ON public.course_forum_post_bookmarks USING btree (post_id);


--
-- Name: ix_course_forum_post_bookmarks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_forum_post_bookmarks_user_id ON public.course_forum_post_bookmarks USING btree (user_id);


--
-- Name: ix_course_forum_post_likes_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_forum_post_likes_post_id ON public.course_forum_post_likes USING btree (post_id);


--
-- Name: ix_course_forum_post_likes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_forum_post_likes_user_id ON public.course_forum_post_likes USING btree (user_id);


--
-- Name: ix_course_forum_posts_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_forum_posts_course_id ON public.course_forum_posts USING btree (course_id);


--
-- Name: ix_course_forum_posts_parent_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_forum_posts_parent_post_id ON public.course_forum_posts USING btree (parent_post_id);


--
-- Name: ix_course_forum_posts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_forum_posts_user_id ON public.course_forum_posts USING btree (user_id);


--
-- Name: ix_course_members_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_members_course_id ON public.course_members USING btree (course_id);


--
-- Name: ix_course_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_course_members_user_id ON public.course_members USING btree (user_id);


--
-- Name: ix_courses_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_courses_course_id ON public.courses USING btree (course_id);


--
-- Name: ix_courses_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_courses_subject ON public.courses USING btree (subject);


--
-- Name: ix_document_chunks_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_chunks_job_id ON public.document_chunks USING btree (job_id);


--
-- Name: ix_document_owners_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_owners_document_id ON public.document_owners USING btree (document_id);


--
-- Name: ix_document_owners_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_owners_user_id ON public.document_owners USING btree (user_id);


--
-- Name: ix_document_publications_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_publications_document_id ON public.document_publications USING btree (document_id);


--
-- Name: ix_document_publications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_publications_user_id ON public.document_publications USING btree (user_id);


--
-- Name: ix_document_versions_content_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_versions_content_hash ON public.document_versions USING btree (content_hash);


--
-- Name: ix_document_versions_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_versions_document_id ON public.document_versions USING btree (document_id);


--
-- Name: ix_document_versions_file_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_versions_file_hash ON public.document_versions USING btree (file_hash);


--
-- Name: ix_documents_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documents_course_id ON public.documents USING btree (course_id);


--
-- Name: ix_documents_owner_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documents_owner_ref ON public.documents USING btree (owner_ref);


--
-- Name: ix_flashcard_flashcardsets_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flashcard_flashcardsets_id ON public.flashcard USING btree (flashcardsets_id);


--
-- Name: ix_flashcard_sets_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flashcard_sets_course_id ON public.flashcard_sets USING btree (course_id);


--
-- Name: ix_flashcard_sets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flashcard_sets_user_id ON public.flashcard_sets USING btree (user_id);


--
-- Name: ix_flashcard_study_progress_flashcard_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flashcard_study_progress_flashcard_id ON public.flashcard_study_progress USING btree (flashcard_id);


--
-- Name: ix_flashcard_study_progress_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_flashcard_study_progress_user_id ON public.flashcard_study_progress USING btree (user_id);


--
-- Name: ix_forum_point_transactions_related_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_forum_point_transactions_related_post_id ON public.forum_point_transactions USING btree (related_post_id);


--
-- Name: ix_forum_point_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_forum_point_transactions_user_id ON public.forum_point_transactions USING btree (user_id);


--
-- Name: ix_ingestion_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ingestion_jobs_status ON public.ingestion_jobs USING btree (status);


--
-- Name: ix_ingestion_jobs_version_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ingestion_jobs_version_id ON public.ingestion_jobs USING btree (version_id);


--
-- Name: ix_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_type ON public.notifications USING btree (type);


--
-- Name: ix_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: ix_professor_reviews_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_professor_reviews_course_id ON public.professor_reviews USING btree (course_id);


--
-- Name: ix_professor_reviews_professor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_professor_reviews_professor ON public.professor_reviews USING btree (professor);


--
-- Name: ix_professor_reviews_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_professor_reviews_user_id ON public.professor_reviews USING btree (user_id);


--
-- Name: ix_study_tasks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_study_tasks_user_id ON public.study_tasks USING btree (user_id);


--
-- Name: ix_users_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_user_email ON public.users USING btree (user_email);


--
-- Name: chat_evidence_assessments chat_evidence_assessments_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_evidence_assessments
    ADD CONSTRAINT chat_evidence_assessments_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat_threads(chat_id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chat_threads(chat_id) ON DELETE CASCADE;


--
-- Name: course_forum_post_bookmarks course_forum_post_bookmarks_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_bookmarks
    ADD CONSTRAINT course_forum_post_bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.course_forum_posts(post_id) ON DELETE CASCADE;


--
-- Name: course_forum_post_bookmarks course_forum_post_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_bookmarks
    ADD CONSTRAINT course_forum_post_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: course_forum_post_likes course_forum_post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_likes
    ADD CONSTRAINT course_forum_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.course_forum_posts(post_id) ON DELETE CASCADE;


--
-- Name: course_forum_post_likes course_forum_post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_post_likes
    ADD CONSTRAINT course_forum_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: course_forum_posts course_forum_posts_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_posts
    ADD CONSTRAINT course_forum_posts_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: course_forum_posts course_forum_posts_parent_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_posts
    ADD CONSTRAINT course_forum_posts_parent_post_id_fkey FOREIGN KEY (parent_post_id) REFERENCES public.course_forum_posts(post_id) ON DELETE CASCADE;


--
-- Name: course_forum_posts course_forum_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_forum_posts
    ADD CONSTRAINT course_forum_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: course_members course_members_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_members
    ADD CONSTRAINT course_members_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: course_members course_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_members
    ADD CONSTRAINT course_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: document_chunks document_chunks_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.ingestion_jobs(job_id) ON DELETE CASCADE;


--
-- Name: document_owners document_owners_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_owners
    ADD CONSTRAINT document_owners_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id) ON DELETE CASCADE;


--
-- Name: document_owners document_owners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_owners
    ADD CONSTRAINT document_owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: document_publications document_publications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_publications
    ADD CONSTRAINT document_publications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id) ON DELETE CASCADE;


--
-- Name: document_publications document_publications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_publications
    ADD CONSTRAINT document_publications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(document_id) ON DELETE CASCADE;


--
-- Name: flashcard flashcard_flashcardsets_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard
    ADD CONSTRAINT flashcard_flashcardsets_id_fkey FOREIGN KEY (flashcardsets_id) REFERENCES public.flashcard_sets(flashcard_set_id) ON DELETE CASCADE;


--
-- Name: flashcard_sets flashcard_sets_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_sets
    ADD CONSTRAINT flashcard_sets_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE RESTRICT;


--
-- Name: flashcard_sets flashcard_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_sets
    ADD CONSTRAINT flashcard_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: flashcard_study_progress flashcard_study_progress_flashcard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_study_progress
    ADD CONSTRAINT flashcard_study_progress_flashcard_id_fkey FOREIGN KEY (flashcard_id) REFERENCES public.flashcard(flashcard_id) ON DELETE CASCADE;


--
-- Name: flashcard_study_progress flashcard_study_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flashcard_study_progress
    ADD CONSTRAINT flashcard_study_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: forum_point_transactions forum_point_transactions_related_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_point_transactions
    ADD CONSTRAINT forum_point_transactions_related_post_id_fkey FOREIGN KEY (related_post_id) REFERENCES public.course_forum_posts(post_id) ON DELETE SET NULL;


--
-- Name: forum_point_transactions forum_point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_point_transactions
    ADD CONSTRAINT forum_point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: ingestion_jobs ingestion_jobs_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingestion_jobs
    ADD CONSTRAINT ingestion_jobs_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.document_versions(version_id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: professor_reviews professor_reviews_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professor_reviews
    ADD CONSTRAINT professor_reviews_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE;


--
-- Name: professor_reviews professor_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professor_reviews
    ADD CONSTRAINT professor_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: study_planner_preferences study_planner_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_planner_preferences
    ADD CONSTRAINT study_planner_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: study_tasks study_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.study_tasks
    ADD CONSTRAINT study_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict sapeWENgU1Os2GbPe4GdTK7ziecLBmwmUGYFunQgmD4SR661OccedrNRskvVFhc

