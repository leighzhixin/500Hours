create table if not exists public.study_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_ref text not null,
  study_date date not null,
  language text not null check (language in ('en', 'ja')),
  activity text not null,
  minutes integer not null check (minutes > 0 and minutes <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_ref)
);

create index if not exists study_entries_user_date_idx
  on public.study_entries (user_id, study_date desc, created_at desc);

alter table public.study_entries enable row level security;

drop policy if exists "Users can read their study entries" on public.study_entries;
create policy "Users can read their study entries"
  on public.study_entries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their study entries" on public.study_entries;
create policy "Users can insert their study entries"
  on public.study_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their study entries" on public.study_entries;
create policy "Users can update their study entries"
  on public.study_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their study entries" on public.study_entries;
create policy "Users can delete their study entries"
  on public.study_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.study_entries from anon;
grant select, insert, update, delete on public.study_entries to authenticated;
