# Blog

하늘색과 흰색을 기반으로 만든 정적 블로그입니다. GitHub Pages에 바로 배포할 수 있고, Supabase를 연결하면 홈은 계정별 블로그에서 공개 발행한 글만 모이는 공용 공간으로, 로그인한 사용자는 `내 블로그`를 따로 관리할 수 있습니다.

## 구성

- `index.html`: 앱 진입점
- `styles.css`: 하늘색/흰색 테마와 반응형 레이아웃
- `app.js`: 글 목록, 상세 보기, 검색, 카테고리, 에디터, Supabase 연동
- `config.js`: 블로그 이름과 Supabase URL/anon key 설정
- `supabase-schema.sql`: Supabase `posts`, `profiles` 테이블과 계정별 RLS 정책
- `.github/workflows/pages.yml`: GitHub Pages 배포 워크플로

## Supabase 설정

1. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
2. Supabase Project Settings > API에서 `anon public` key를 복사합니다.
3. `config.js`의 `supabaseAnonKey`에 넣거나, 사이트 우측 상단의 `로컬 모드` 버튼에서 저장합니다.
4. Authentication에서 가입 확인을 끄면 아이디/비밀번호 회원가입 직후 바로 로그인할 수 있습니다.

화면에서는 이메일 대신 아이디를 받지만, Supabase Auth 내부에는 `아이디@blog.local` 형태로 저장됩니다. `anon public` key는 브라우저에 공개되는 키입니다. 쓰기 권한은 RLS와 Supabase Auth 로그인으로 보호됩니다. 계정 소유자가 있는 공개 글만 홈에 표시되고, 비공개 글은 작성자 자신의 `내 블로그`에서만 관리됩니다.

## GitHub Pages 배포

1. GitHub 저장소에 push합니다.
2. 저장소 Settings > Pages에서 Source를 `GitHub Actions`로 선택합니다.
3. `main` 브랜치에 push하면 `.github/workflows/pages.yml`이 정적 파일을 배포합니다.

## 로컬 확인

정적 파일이므로 `index.html`을 브라우저로 열어 확인할 수 있습니다. Supabase 연동까지 확인하려면 로컬 서버를 쓰는 것이 편합니다.

```powershell
python -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 열면 됩니다.
