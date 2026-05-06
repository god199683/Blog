# Blog

GitHub Pages에서 바로 배포할 수 있는 공개 블로그 홈입니다.

## 구성

- `index.html`: 홈 화면 구조
- `styles.css`: 반응형 스타일
- `app.js`: Supabase 공개 글 로딩, 검색, 주제 필터, 글 미리보기

## Supabase 연결

홈은 아래 순서로 공개 글을 가져옵니다.

1. `posts` 테이블
2. `articles` 테이블
3. 기본 샘플 콘텐츠

브라우저에 노출되는 키는 사용자가 제공한 Supabase anon key입니다. `service_role` 키는 절대 프론트엔드에 넣지 마세요.

권장 컬럼:

```sql
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  body text,
  category text default '일상',
  author text default 'Blog',
  cover_image text,
  reading_time text,
  published boolean default true,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Public posts are readable"
on public.posts
for select
to anon, authenticated
using (published = true);
```

## GitHub Pages 배포

저장소 설정의 Pages에서 Source를 `Deploy from a branch`, Branch를 `main`, Folder를 `/ (root)`로 선택하면 됩니다.
