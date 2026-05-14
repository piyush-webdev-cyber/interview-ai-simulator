create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  provider text not null,
  profile_picture text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login timestamptz
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by the owning user"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Profiles are insertable by the owning user"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Profiles are updatable by the owning user"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
