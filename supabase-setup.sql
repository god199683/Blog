create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  body text,
  category text default 'General',
  author text default 'Blog',
  login_id text,
  user_id uuid,
  cover_image text,
  folder text,
  folder_id text,
  folder_name text,
  folder_path text,
  reading_time text,
  published boolean default true,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.blog_trees (
  user_id uuid primary key,
  login_id text not null,
  tree jsonb not null default '[]'::jsonb,
  hidden_category_ids text[] not null default '{}',
  tree_collapsed_ids text[] not null default '{}',
  trash jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.password_hints (
  login_id text primary key,
  user_id uuid not null unique,
  hint text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint password_hints_hint_length check (char_length(hint) <= 160)
);

create table if not exists public.blog_profiles (
  user_id uuid primary key,
  login_id text not null unique,
  blog_title text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.account_security (
  user_id uuid primary key,
  login_id text not null,
  away_password_hash text,
  updated_at timestamptz default now()
);

alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists excerpt text;
alter table public.posts add column if not exists body text;
alter table public.posts add column if not exists category text default '전체';
alter table public.posts add column if not exists author text default 'Blog';
alter table public.posts add column if not exists login_id text;
alter table public.posts add column if not exists user_id uuid;
alter table public.posts add column if not exists cover_image text;
alter table public.posts add column if not exists folder text;
alter table public.posts add column if not exists folder_id text;
alter table public.posts add column if not exists folder_name text;
alter table public.posts add column if not exists folder_path text;
alter table public.posts add column if not exists reading_time text;
alter table public.posts add column if not exists published boolean default true;
alter table public.posts add column if not exists published_at timestamptz default now();
alter table public.posts add column if not exists created_at timestamptz default now();

alter table public.blog_trees add column if not exists user_id uuid;
alter table public.blog_trees add column if not exists login_id text;
alter table public.blog_trees add column if not exists tree jsonb not null default '[]'::jsonb;
alter table public.blog_trees add column if not exists hidden_category_ids text[] not null default '{}';
alter table public.blog_trees add column if not exists tree_collapsed_ids text[] not null default '{}';
alter table public.blog_trees add column if not exists trash jsonb not null default '[]'::jsonb;
alter table public.blog_trees add column if not exists updated_at timestamptz default now();

alter table public.password_hints add column if not exists login_id text;
alter table public.password_hints add column if not exists user_id uuid;
alter table public.password_hints add column if not exists hint text not null default '';
alter table public.password_hints add column if not exists created_at timestamptz default now();
alter table public.password_hints add column if not exists updated_at timestamptz default now();

alter table public.blog_profiles add column if not exists user_id uuid;
alter table public.blog_profiles add column if not exists login_id text;
alter table public.blog_profiles add column if not exists blog_title text;
alter table public.blog_profiles add column if not exists created_at timestamptz default now();
alter table public.blog_profiles add column if not exists updated_at timestamptz default now();

alter table public.account_security add column if not exists user_id uuid;
alter table public.account_security add column if not exists login_id text;
alter table public.account_security add column if not exists away_password_hash text;
alter table public.account_security add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.blog_trees'::regclass
      and contype = 'p'
  ) then
    alter table public.blog_trees add constraint blog_trees_pkey primary key (user_id);
  end if;
end
$$;

alter table public.posts enable row level security;
alter table public.blog_trees enable row level security;
alter table public.password_hints enable row level security;
alter table public.blog_profiles enable row level security;
alter table public.account_security enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table public.posts to anon, authenticated;
grant insert, update, delete on table public.posts to authenticated;
grant select, insert, update, delete on table public.blog_trees to authenticated;
grant select on table public.password_hints to anon, authenticated;
grant insert, update on table public.password_hints to authenticated;
grant select, insert, update on table public.blog_profiles to authenticated;
grant select, insert, update on table public.account_security to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Public posts are readable'
  ) then
    create policy "Public posts are readable"
    on public.posts
    for select
    to anon, authenticated
    using (published = true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_profiles'
      and policyname = 'Authenticated users can read own blog profile'
  ) then
    create policy "Authenticated users can read own blog profile"
    on public.blog_profiles
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_profiles'
      and policyname = 'Authenticated users can create own blog profile'
  ) then
    create policy "Authenticated users can create own blog profile"
    on public.blog_profiles
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_profiles'
      and policyname = 'Authenticated users can update own blog profile'
  ) then
    create policy "Authenticated users can update own blog profile"
    on public.blog_profiles
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_security'
      and policyname = 'Authenticated users can read own account security'
  ) then
    create policy "Authenticated users can read own account security"
    on public.account_security
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_security'
      and policyname = 'Authenticated users can create own account security'
  ) then
    create policy "Authenticated users can create own account security"
    on public.account_security
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_security'
      and policyname = 'Authenticated users can update own account security'
  ) then
    create policy "Authenticated users can update own account security"
    on public.account_security
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_trees'
      and policyname = 'Authenticated users can read own tree'
  ) then
    create policy "Authenticated users can read own tree"
    on public.blog_trees
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'password_hints'
      and policyname = 'Anyone can read password hints'
  ) then
    create policy "Anyone can read password hints"
    on public.password_hints
    for select
    to anon, authenticated
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'password_hints'
      and policyname = 'Authenticated users can create own password hint'
  ) then
    create policy "Authenticated users can create own password hint"
    on public.password_hints
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'password_hints'
      and policyname = 'Authenticated users can update own password hint'
  ) then
    create policy "Authenticated users can update own password hint"
    on public.password_hints
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_trees'
      and policyname = 'Authenticated users can create own tree'
  ) then
    create policy "Authenticated users can create own tree"
    on public.blog_trees
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_trees'
      and policyname = 'Authenticated users can update own tree'
  ) then
    create policy "Authenticated users can update own tree"
    on public.blog_trees
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_trees'
      and policyname = 'Authenticated users can delete own tree'
  ) then
    create policy "Authenticated users can delete own tree"
    on public.blog_trees
    for delete
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Authenticated users can read own posts'
  ) then
    create policy "Authenticated users can read own posts"
    on public.posts
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Authenticated users can create own posts'
  ) then
    create policy "Authenticated users can create own posts"
    on public.posts
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Authenticated users can update own posts'
  ) then
    create policy "Authenticated users can update own posts"
    on public.posts
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'Authenticated users can delete own posts'
  ) then
    create policy "Authenticated users can delete own posts"
    on public.posts
    for delete
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$$;
