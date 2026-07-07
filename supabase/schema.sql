-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Messages
create table if not exists public.messages (
  id bigserial primary key,
  room text not null,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

drop policy if exists "Messages are viewable by everyone" on public.messages;
create policy "Messages are viewable by everyone"
  on public.messages for select
  using (true);

drop policy if exists "Signed-in users can post messages" on public.messages;
create policy "Signed-in users can post messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Reports
create table if not exists public.reports (
  id bigserial primary key,
  message_id bigint references public.messages(id) on delete cascade,
  reported_by uuid references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz default now()
);

alter table public.reports enable row level security;

drop policy if exists "Users can view their own reports" on public.reports;
create policy "Users can view their own reports"
  on public.reports for select
  using (auth.uid() = reported_by);

drop policy if exists "Signed-in users can file reports" on public.reports;
create policy "Signed-in users can file reports"
  on public.reports for insert
  with check (auth.uid() = reported_by);

-- Blocks
create table if not exists public.blocks (
  id bigserial primary key,
  blocker_id uuid references auth.users(id) on delete cascade,
  blocked_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "Users can view their own block list" on public.blocks;
create policy "Users can view their own block list"
  on public.blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can add to their own block list" on public.blocks;
create policy "Users can add to their own block list"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "Users can remove from their own block list" on public.blocks;
create policy "Users can remove from their own block list"
  on public.blocks for delete
  using (auth.uid() = blocker_id);
