--
-- PostgreSQL database dump
--

\restrict A5XkBglzzVQUTHBTriLy3cQma2cXggT3hxnMdiOKx6HCa1cFTw51b1k5PvX0WY0

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
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, name, email, role, created_at, teams, password_set) FROM stdin;
dde2dee5-c6ce-48db-9f27-ea9eccec75a7	Khyati Raghvani	khyati.raghvan@continuousvalidation.com	employee	2026-04-10 09:24:34.13372	{ai_ml}	t
12f6bc6c-620b-45ce-8b0d-6b900ff6c474	Nagesh Nama	nn@continuousintelligence.ai	super_admin	2026-04-13 17:26:45.735922	{}	t
1fb39987-a131-44f5-a51b-c4ff84e7af59	Sky Dayma	skydayma@gmail.com	employee	2026-03-08 08:02:49.688077	{marketing}	t
c7f5546e-cc0a-4213-875a-d63fd30085db	Akash Dayma	akash.dayma@continuousvalidation.com	super_admin	2026-03-07 14:32:11.569404	{}	t
92962aeb-64e3-4a3d-93f0-c356ddb1e508	Kunal Jejure	kunal.jejure@continuousvalidation.com	employee	2026-03-11 08:10:15.676695	{spt}	t
1964c95f-4cd6-4441-b1e9-0e413f7639f3	Rushi Patel	rushi@continuousvalidation.com	scrum_master	2026-03-16 13:34:10.06617	{spt}	t
4e2fc9d9-ce62-4167-a00d-86b6e41c18f3	Shruti Katkar	Shrutikatkar@continuousvalidation.com	employee	2026-03-16 13:44:47.055005	{marketing}	t
bf6198d9-9371-41d8-9010-579083f44399	Nabhesh Dayma	Nabhesh@continuousvalidation.com	employee	2026-03-08 07:57:40.222	{ai_ml}	t
080a391d-5ebb-47b6-81c2-0d5fb9227c6a	Chaitanya Vaidya	Chaitanya@continuousvalidation.com	employee	2026-04-10 09:08:17.317264	{it}	t
5b3dd85a-7f5a-49a5-b279-0d1d7058bd23	Devyanshi Joshi	devyanshi@continuousvalidation.com	employee	2026-04-10 09:06:38.496947	{spt}	t
c22c7388-bf9e-4da1-8300-0bba8e27653d	Neha Patil	neha.patil@continuousvalidation.com	employee	2026-04-10 08:53:54.822601	{marketing}	t
9d29eee0-c995-4c6f-84aa-5e667cfd59f0	Sandeep Mundhe	sandeep.mundhe@continuousvalidation.com	employee	2026-04-10 08:53:27.044189	{spt}	t
23d123df-4f6c-4d04-b023-b830ca741e5c	Mandar Parekh	mandar.parekh@continuousvalidation.com	employee	2026-03-17 12:30:21.37074	{ai_ml}	t
22c26c22-5d53-4206-8285-85dc72c223e0	Akshat Gaikar	akshat.gaikar@continuousvalidation.com	employee	2026-03-16 13:35:26.32666	{ai_ml}	t
2a3713e5-8d1f-4a3c-a107-69c384e04e61	Abhishek Shukla	abhishek.kumar@continuousvalidation.com	employee	2026-03-20 06:20:26.866078	{marketing}	t
2c89109c-198b-4da8-a4ad-ff4648845c25	Geetesh Talajia	geetesh@continuousvalidation.com	super_admin	2026-04-13 08:02:59.491418	{}	t
a63e4ed9-24e2-4a65-b0d0-227731b9bd20	Mansi Joshi	mansi@continuousvalidation.com	scrum_master	2026-04-14 17:07:48.458343	{ai_ml,spt}	t
cb9add6b-416d-40c6-adf0-bd576fca7fb5	Varun Nair	varun2@continuousvalidation.com	employee	2026-04-14 17:37:04.999549	{ai_ml}	t
a7c194fc-9f1b-4013-8413-9a89380a6a4a	Vaishnavi Kamath	vaishnavi@continuousvalidation.com	employee	2026-04-14 17:00:36.923028	{ai_ml}	t
e8175a9a-d7ed-44b0-abda-1e98787d5459	Yuval Mehta	yuval@continuousvalidation.com	employee	2026-04-14 17:00:03.871027	{ai_ml}	t
c5a855d7-ffd1-4019-bc84-ffde59e651af	Aryan Singh	aryan.singh@continuousvalidation.com	employee	2026-04-14 16:59:39.423795	{ai_ml}	t
d3ca8ef1-9dbf-45c4-9368-6f333fb29a5d	Pranshu Padia	pranshu@continuousvalidation.com	employee	2026-04-14 16:58:55.202265	{ai_ml}	t
8036464a-e8a1-4d4b-a249-b4d1e1c3bfec	Supriya HR	supriya@continuousvalidation.com	employee	2026-04-13 05:50:59.673853	{spt}	t
634cc3d7-a72e-4e76-9da2-4dd447a6c302	Hitendra Jawage	Hitendrajawage@continuousvalidation.com	employee	2026-04-10 14:33:39.33691	{ai_ml}	t
247864cd-9c69-4f28-8d37-84a3d6881511	Arnav Rathod	Arnavrathod@continuousvalidation.com	employee	2026-04-10 14:32:46.732058	{it}	t
4700d6c4-5e01-4be1-a0ae-0056df9cef27	Vaishnavi Patil	vaishnavi.patil@continuousvalidation.com	employee	2026-04-10 14:32:08.036534	{ai_ml}	t
\.


--
-- PostgreSQL database dump complete
--

\unrestrict A5XkBglzzVQUTHBTriLy3cQma2cXggT3hxnMdiOKx6HCa1cFTw51b1k5PvX0WY0

