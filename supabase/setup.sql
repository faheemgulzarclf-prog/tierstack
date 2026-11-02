-- TierStack: run this once in Supabase → SQL Editor → New query → Run.
-- Creates the profile + tracker tables. Row Level Security means every
-- trader can only read and change their own rows.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  tz          text,                 -- e.g. Asia/Karachi (for the morning message)
  remind_time text,                 -- e.g. 08:30
  telegram_chat_id text,            -- filled in Phase 2
  created_at  timestamptz not null default now()
);

create table if not exists public.trackers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.trackers enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile write"  on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile write"  on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own tracker read"   on public.trackers;
drop policy if exists "own tracker insert" on public.trackers;
drop policy if exists "own tracker update" on public.trackers;
drop policy if exists "own tracker delete" on public.trackers;
create policy "own tracker read"   on public.trackers for select using (auth.uid() = user_id);
create policy "own tracker insert" on public.trackers for insert with check (auth.uid() = user_id);
create policy "own tracker update" on public.trackers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tracker delete" on public.trackers for delete using (auth.uid() = user_id);

-- New signup → profile row with the name they typed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, tz)
  values (new.id, new.raw_user_meta_data->>'name', new.email, new.raw_user_meta_data->>'tz')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
