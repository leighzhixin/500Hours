-- Normalize policies created by the early dashboard setup so this migration is
-- safe to run after either the legacy policy names or the repository names.
alter table public.study_entries enable row level security;

drop policy if exists "Users can read own study entries" on public.study_entries;
drop policy if exists "Users can insert own study entries" on public.study_entries;
drop policy if exists "Users can update own study entries" on public.study_entries;
drop policy if exists "Users can delete own study entries" on public.study_entries;

drop policy if exists "Users can read their study entries" on public.study_entries;
drop policy if exists "Users can insert their study entries" on public.study_entries;
drop policy if exists "Users can update their study entries" on public.study_entries;
drop policy if exists "Users can delete their study entries" on public.study_entries;

create policy "Users can read their study entries"
  on public.study_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their study entries"
  on public.study_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their study entries"
  on public.study_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their study entries"
  on public.study_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.study_entries from anon;
grant select, insert, update, delete on table public.study_entries to authenticated;
