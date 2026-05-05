# Sky Blog

하늘색과 흰색을 기반으로 만든 정적 블로그입니다. GitHub Pages에 바로 배포할 수 있고, Supabase를 연결하면 글 목록과 발행 데이터를 `posts` 테이블에서 관리합니다.

## 구성

- `index.html`: 앱 진입점
- `styles.css`: 하늘색/흰색 테마와 반응형 레이아웃
- `app.js`: 글 목록, 상세 보기, 검색, 카테고리, 에디터, Supabase 연동
- `config.js`: 블로그 이름과 Supabase URL/anon key 설정
- `supabase-schema.sql`: Supabase 테이블과 RLS 정책
- `.github/workflows/pages.yml`: GitHub Pages 배포 워크플로

## Supabase 설정

1. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
2. Supabase Project Settings > API에서 `anon public` key를 복사합니다.
3. `config.js`의 `supabaseAnonKey`에 넣거나, 사이트 우측 상단의 `로컬 모드` 버튼에서 저장합니다.
4. Authentication에서 작성자 계정을 만들고, 공개 회원가입은 꺼두는 것을 권장합니다.

`anon public` key는 브라우저에 공개되는 키입니다. 쓰기 권한은 RLS와 Supabase Auth 로그인으로 보호됩니다.

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
