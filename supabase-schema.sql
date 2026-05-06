create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  folder_id uuid,
  author_name text default '작성자',
  title text not null,
  slug text not null,
  excerpt text default '',
  category text default '일상',
  tags text[] default '{}',
  cover_url text default '',
  content text not null,
  published boolean default true,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.posts add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists folder_id uuid;
alter table public.posts add column if not exists author_name text default '작성자';
alter table public.posts add column if not exists deleted_at timestamptz;
alter table public.posts alter column slug set not null;
alter table public.posts drop constraint if exists posts_slug_key;
create unique index if not exists posts_owner_slug_idx on public.posts(owner_id, slug);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '작성자',
  blog_title text not null default '나의 하늘색 블로그',
  bio text not null default '오늘의 생각을 차분히 기록합니다.',
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  unique(owner_id, name)
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.folders add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists deleted_at timestamptz;
alter table public.folders add column if not exists deleted_at timestamptz;
create index if not exists posts_deleted_at_idx on public.posts(deleted_at);
create index if not exists categories_deleted_at_idx on public.categories(deleted_at);
create index if not exists folders_deleted_at_idx on public.folders(deleted_at);
create index if not exists folders_category_id_idx on public.folders(category_id);

alter table public.posts drop constraint if exists posts_folder_id_fkey;
alter table public.posts
  add constraint posts_folder_id_fkey foreign key (folder_id) references public.folders(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.folders enable row level security;

drop policy if exists "Public can read published posts" on public.posts;
drop policy if exists "Authenticated users can read public and own posts" on public.posts;
drop policy if exists "Users can create own posts" on public.posts;
drop policy if exists "Users can update own posts" on public.posts;
drop policy if exists "Users can delete own posts" on public.posts;
drop policy if exists "Public can read profiles" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Users can read own categories" on public.categories;
drop policy if exists "Users can create own categories" on public.categories;
drop policy if exists "Users can update own categories" on public.categories;
drop policy if exists "Users can delete own categories" on public.categories;
drop policy if exists "Public can read folders" on public.folders;
drop policy if exists "Users can read own folders" on public.folders;
drop policy if exists "Users can create own folders" on public.folders;
drop policy if exists "Users can update own folders" on public.folders;
drop policy if exists "Users can delete own folders" on public.folders;

create policy "Public can read published posts"
on public.posts for select
using (published = true and deleted_at is null);

create policy "Authenticated users can read public and own posts"
on public.posts for select
to authenticated
using ((published = true and deleted_at is null) or owner_id = auth.uid());

create policy "Users can create own posts"
on public.posts for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Users can update own posts"
on public.posts for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can delete own posts"
on public.posts for delete
to authenticated
using (owner_id = auth.uid());

create policy "Public can read profiles"
on public.profiles for select
using (true);

create policy "Users can create own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Public can read categories"
on public.categories for select
using (deleted_at is null);

create policy "Users can read own categories"
on public.categories for select
to authenticated
using (owner_id = auth.uid());

create policy "Users can create own categories"
on public.categories for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Users can update own categories"
on public.categories for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can delete own categories"
on public.categories for delete
to authenticated
using (owner_id = auth.uid());

create policy "Public can read folders"
on public.folders for select
using (deleted_at is null);

create policy "Users can read own folders"
on public.folders for select
to authenticated
using (owner_id = auth.uid());

create policy "Users can create own folders"
on public.folders for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Users can update own folders"
on public.folders for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can delete own folders"
on public.folders for delete
to authenticated
using (owner_id = auth.uid());
