create table if not exists public.milestone_checks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  language text not null check (language in ('en', 'ja')),
  milestone_hours integer not null check (milestone_hours > 0),
  verified_at timestamptz not null default now(),
  primary key (user_id, language, milestone_hours)
);

alter table public.milestone_checks enable row level security;

drop policy if exists "Users can read their milestone checks" on public.milestone_checks;
create policy "Users can read their milestone checks"
  on public.milestone_checks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their milestone checks" on public.milestone_checks;
create policy "Users can insert their milestone checks"
  on public.milestone_checks for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their milestone checks" on public.milestone_checks;
create policy "Users can update their milestone checks"
  on public.milestone_checks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their milestone checks" on public.milestone_checks;
create policy "Users can delete their milestone checks"
  on public.milestone_checks for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.milestone_checks from anon;
grant select, insert, update, delete on public.milestone_checks to authenticated;
