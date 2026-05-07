# Blog

GitHub Pages에서 바로 배포할 수 있는 공개 블로그 홈입니다.

## 구성

- `index.html`: 홈 화면 구조
- `styles.css`: 반응형 스타일
- `app.js`: Supabase 공개 글 로딩, 검색, 주제 필터, 글 미리보기

## Supabase 연결

홈은 아래 순서로 공개 글을 가져옵니다.

1. `posts` 테이블
2. 공개 글이 없으면 빈 피드 표시

브라우저에 노출되는 키는 사용자가 제공한 Supabase anon key입니다. `service_role` 키는 절대 프론트엔드에 넣지 마세요.

Supabase SQL Editor에서 `supabase-setup.sql`을 실행하면 아래 테이블, RLS, 권한이 함께 설정됩니다.

- `posts`: 게시글 저장
- `blog_trees`: 계정별 카테고리/폴더 트리 저장

현재처럼 `permission denied for table posts`가 뜨면 아래 권한이 빠진 상태입니다.

```sql
grant usage on schema public to anon, authenticated;
grant select on table public.posts to anon, authenticated;
```

## GitHub Pages 배포

저장소에는 GitHub Actions 기반 Pages 배포 워크플로우가 포함되어 있습니다. Pages 설정에서 Source가 `GitHub Actions`인지 확인하세요.
