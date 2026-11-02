-- TierStack step 2: member approval + admin. Run once in Supabase → SQL Editor.
-- Then run the LAST line with your own email (after you have signed up on the site).

alter table public.profiles add column if not exists status text not null default 'pending'
  check (status in ('pending','approved','rejected'));
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists decided_at timestamptz;

-- helpers (security definer so RLS policies can use them without recursion)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'approved' or is_admin from public.profiles where id = auth.uid()), false)
$$;

-- profiles: you read your own row; the admin reads everyone
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id or public.is_admin());

-- members may edit only these columns (never status or is_admin); profile rows are only created by the signup trigger
drop policy if exists "own profile write" on public.profiles;
revoke insert, delete on public.profiles from authenticated, anon;
revoke update on public.profiles from authenticated, anon;
grant update (name, tz, remind_time, telegram_chat_id) on public.profiles to authenticated;

-- only approved members (or the admin) can save a daily coach
drop policy if exists "own tracker insert" on public.trackers;
drop policy if exists "own tracker update" on public.trackers;
create policy "own tracker insert" on public.trackers for insert with check (auth.uid() = user_id and public.is_approved());
create policy "own tracker update" on public.trackers for update using (auth.uid() = user_id) with check (auth.uid() = user_id and public.is_approved());

-- admin action: approve / reject / back to pending
create or replace function public.set_member_status(member uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if new_status not in ('pending','approved','rejected') then raise exception 'bad status'; end if;
  update public.profiles set status = new_status, decided_at = now() where id = member;
end $$;
revoke execute on function public.set_member_status(uuid, text) from anon;

-- ▼ Make yourself admin: put the email you signed up with, then run this line.
update public.profiles set is_admin = true, status = 'approved' where email = 'YOUR_EMAIL_HERE';
