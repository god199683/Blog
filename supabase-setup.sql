create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  body text,
  category text default 'General',
  author text default 'Blog',
  cover_image text,
  reading_time text,
  published boolean default true,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists excerpt text;
alter table public.posts add column if not exists body text;
alter table public.posts add column if not exists category text default 'General';
alter table public.posts add column if not exists author text default 'Blog';
alter table public.posts add column if not exists cover_image text;
alter table public.posts add column if not exists reading_time text;
alter table public.posts add column if not exists published boolean default true;
alter table public.posts add column if not exists published_at timestamptz default now();
alter table public.posts add column if not exists created_at timestamptz default now();

alter table public.posts enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table public.posts to anon, authenticated;

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
