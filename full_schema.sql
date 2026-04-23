--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

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
-- Name: decrement_votes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_votes(row_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
  UPDATE retro_items SET votes = GREATEST(COALESCE(votes, 0) - 1, 0) WHERE id = row_id;
$$;


--
-- Name: increment_votes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_votes(row_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
  UPDATE retro_items SET votes = COALESCE(votes, 0) + 1 WHERE id = row_id;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    actor_name text,
    old_data jsonb,
    new_data jsonb,
    changes jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid NOT NULL,
    name text,
    email text,
    role text DEFAULT 'employee'::text,
    created_at timestamp without time zone DEFAULT now(),
    teams text[] DEFAULT '{}'::text[],
    password_set boolean DEFAULT true
);


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_by uuid,
    status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: retro_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_date text NOT NULL,
    phase text NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    avatar_url text,
    content text NOT NULL,
    assignee text,
    done boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    due_date text,
    session_id uuid,
    votes integer DEFAULT 0,
    group_name text
);


--
-- Name: retro_meeting_worth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_meeting_worth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    vote text NOT NULL,
    session_id uuid NOT NULL,
    session_date date DEFAULT CURRENT_DATE NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: retro_moods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_moods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    mood text NOT NULL,
    avatar_url text,
    session_date text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    session_id uuid
);


--
-- Name: retro_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    current_phase integer DEFAULT 0,
    team_id text,
    title text,
    pdf_url text
);


--
-- Name: retro_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: standups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    meeting_id uuid,
    yesterday text,
    today text,
    blockers text,
    created_at timestamp without time zone DEFAULT now(),
    employee_name text,
    mood text DEFAULT 'good'::text,
    ticket_number text,
    due_date date,
    presented boolean DEFAULT false,
    standup_date date DEFAULT CURRENT_DATE NOT NULL,
    yesterday_tickets jsonb DEFAULT '[]'::jsonb,
    today_tickets jsonb DEFAULT '[]'::jsonb,
    blocker_tickets jsonb DEFAULT '[]'::jsonb
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: retro_items retro_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_items
    ADD CONSTRAINT retro_items_pkey PRIMARY KEY (id);


--
-- Name: retro_meeting_worth retro_meeting_worth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_meeting_worth
    ADD CONSTRAINT retro_meeting_worth_pkey PRIMARY KEY (id);


--
-- Name: retro_meeting_worth retro_meeting_worth_user_id_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_meeting_worth
    ADD CONSTRAINT retro_meeting_worth_user_id_session_id_key UNIQUE (user_id, session_id);


--
-- Name: retro_moods retro_moods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_moods
    ADD CONSTRAINT retro_moods_pkey PRIMARY KEY (id);


--
-- Name: retro_moods retro_moods_user_session; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_moods
    ADD CONSTRAINT retro_moods_user_session UNIQUE (user_id, session_id);


--
-- Name: retro_sessions retro_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_sessions
    ADD CONSTRAINT retro_sessions_pkey PRIMARY KEY (id);


--
-- Name: retro_votes retro_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_votes
    ADD CONSTRAINT retro_votes_pkey PRIMARY KEY (id);


--
-- Name: standups standups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standups
    ADD CONSTRAINT standups_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (entity_type, action);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor ON public.audit_logs USING btree (actor_id);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_time ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_retro_items_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retro_items_session ON public.retro_items USING btree (session_date, phase);


--
-- Name: idx_standups_standup_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standups_standup_date ON public.standups USING btree (standup_date);


--
-- Name: retro_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retro_sessions_status ON public.retro_sessions USING btree (status);


--
-- Name: retro_votes_session_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retro_votes_session_user ON public.retro_votes USING btree (session_id, user_id);


--
-- Name: retro_votes_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX retro_votes_unique ON public.retro_votes USING btree (session_id, user_id, item_id);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: employees employees_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: meetings meetings_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.employees(id);


--
-- Name: retro_votes retro_votes_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_votes
    ADD CONSTRAINT retro_votes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.retro_items(id) ON DELETE CASCADE;


--
-- Name: standups standups_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standups
    ADD CONSTRAINT standups_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id);


--
-- Name: standups standups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standups
    ADD CONSTRAINT standups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employees(id);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: retro_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retro_items ENABLE ROW LEVEL SECURITY;

--
-- Name: retro_meeting_worth; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retro_meeting_worth ENABLE ROW LEVEL SECURITY;

--
-- Name: retro_moods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retro_moods ENABLE ROW LEVEL SECURITY;

--
-- Name: retro_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retro_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: retro_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retro_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: standups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.standups ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

