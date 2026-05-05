create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text default '',
  category text default '일상',
  tags text[] default '{}',
  cover_url text default '',
  content text not null,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

alter table public.posts enable row level security;

drop policy if exists "Public can read published posts" on public.posts;
drop policy if exists "Authenticated users can read all posts" on public.posts;
drop policy if exists "Authenticated users can create posts" on public.posts;
drop policy if exists "Authenticated users can update posts" on public.posts;
drop policy if exists "Authenticated users can delete posts" on public.posts;

create policy "Public can read published posts"
on public.posts for select
using (published = true);

create policy "Authenticated users can read all posts"
on public.posts for select
to authenticated
using (true);

create policy "Authenticated users can create posts"
on public.posts for insert
to authenticated
with check (true);

create policy "Authenticated users can update posts"
on public.posts for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete posts"
on public.posts for delete
to authenticated
using (true);
