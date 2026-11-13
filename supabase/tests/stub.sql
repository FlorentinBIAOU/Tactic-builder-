-- Minimal stand-in for the Supabase environment so the migrations can run on
-- a plain Postgres (CI). Mirrors what the mobile app's 0001 provides.
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists storage;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
end $$;
grant usage on schema public, auth, storage to authenticated, anon, service_role;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create table if not exists public.profiles (
  id uuid primary key, email text, full_name text,
  streak int default 0, coins int default 0, xp int default 0,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists own_select on public.profiles;
create policy own_select on public.profiles for select using (auth.uid() = id);
drop policy if exists own_update on public.profiles;
create policy own_update on public.profiles for update using (auth.uid() = id);
drop policy if exists own_insert on public.profiles;
create policy own_insert on public.profiles for insert with check (auth.uid() = id);
create or replace function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
create table if not exists public.lesson_completions (user_id uuid, lesson_id text, quiz_perfect boolean, quiz_correct boolean, created_at timestamptz default now());
create table if not exists public.mission_claims (user_id uuid, mission_id text, created_at timestamptz default now());
