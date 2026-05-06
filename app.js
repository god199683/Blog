const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const FALLBACK_POSTS = [
  {
    id: "fallback-1",
    title: "작게 시작하는 기록의 힘",
    excerpt: "매일 남기는 짧은 문장이 어떻게 프로젝트와 일상을 더 선명하게 만드는지 정리했습니다.",
    category: "라이프",
    author: "Blog Team",
    published_at: "2026-05-07",
    reading_time: "4분",
    cover_image:
      "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-2",
    title: "좋은 홈 피드가 갖춰야 할 것",
    excerpt: "처음 방문한 사람도 방향을 잃지 않도록 검색, 주제, 추천 글을 한 화면에 배치하는 방법입니다.",
    category: "디자인",
    author: "Editor",
    published_at: "2026-05-06",
    reading_time: "6분",
    cover_image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-3",
    title: "Supabase로 공개 글 가져오기",
    excerpt: "공개 읽기 정책만 열어 둔 테이블에서 글 목록을 가져오고, 실패할 때도 화면을 유지하는 패턴입니다.",
    category: "개발",
    author: "Developer",
    published_at: "2026-05-05",
    reading_time: "5분",
    cover_image:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-4",
    title: "블로그 글감 보관함 만들기",
    excerpt: "떠오른 생각을 흘려보내지 않기 위해 제목, 한 줄 요약, 참고 링크만 먼저 남기는 방식입니다.",
    category: "생산성",
    author: "Note Keeper",
    published_at: "2026-05-04",
    reading_time: "3분",
    cover_image:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-5",
    title: "읽기 좋은 카드 레이아웃",
    excerpt: "이미지, 제목, 요약, 작성자 정보를 일정한 리듬으로 보여 주면 글 목록을 빠르게 훑을 수 있습니다.",
    category: "디자인",
    author: "UI Lab",
    published_at: "2026-05-03",
    reading_time: "4분",
    cover_image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-6",
    title: "공개 페이지의 기본 보안",
    excerpt: "브라우저에 노출되는 키와 노출되면 안 되는 키를 구분하고, RLS 정책을 먼저 생각합니다.",
    category: "개발",
    author: "Security Notes",
    published_at: "2026-05-02",
    reading_time: "7분",
    cover_image:
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
  },
];

const state = {
  posts: [],
  activeTopic: "전체",
  query: "",
  source: "loading",
};

const els = {
  featured: document.querySelector("#featured-card"),
  tabs: document.querySelector("#topic-tabs"),
  grid: document.querySelector("#post-grid"),
  resultCount: document.querySelector("#result-count"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  dataStatus: document.querySelector("#data-status"),
  statusCopy: document.querySelector("#status-copy"),
  readingList: document.querySelector("#reading-list"),
  dialog: document.querySelector("#post-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
  dialogClose: document.querySelector("#dialog-close"),
  year: document.querySelector("#year"),
};

function formatDate(value) {
  if (!value) return "날짜 미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePost(raw, index) {
  const fallback = FALLBACK_POSTS[index % FALLBACK_POSTS.length];
  const title = raw.title || raw.name || fallback.title;
  const excerpt = raw.excerpt || raw.summary || raw.description || raw.subtitle || fallback.excerpt;
  const category = raw.category || raw.topic || raw.tag || fallback.category;
  const publishedAt = raw.published_at || raw.created_at || raw.date || fallback.published_at;

  return {
    id: raw.id || raw.slug || `post-${index}`,
    title,
    excerpt,
    category,
    author: raw.author || raw.author_name || raw.writer || fallback.author,
    published_at: publishedAt,
    reading_time: raw.reading_time || raw.read_time || fallback.reading_time,
    cover_image: raw.cover_image || raw.image_url || raw.thumbnail_url || fallback.cover_image,
    body: raw.body || raw.content || excerpt,
    slug: raw.slug || raw.id || "",
  };
}

function isPublicPost(raw) {
  if (raw.published === false) return false;
  if (raw.is_published === false) return false;
  if (String(raw.status || "").toLowerCase() === "draft") return false;
  return true;
}

async function fetchTable(tableName) {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/${tableName}`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("limit", "24");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`${tableName} request failed: ${response.status}`);
  }

  return response.json();
}

async function loadPosts() {
  for (const table of ["posts", "articles"]) {
    try {
      const rows = await fetchTable(table);
      if (Array.isArray(rows) && rows.length > 0) {
        state.posts = rows
          .filter(isPublicPost)
          .map(normalizePost)
          .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        state.source = table;
        return;
      }
    } catch (error) {
      console.info(error.message);
    }
  }

  state.posts = FALLBACK_POSTS;
  state.source = "fallback";
}

function getFilteredPosts() {
  const query = state.query.trim().toLowerCase();
  return state.posts.filter((post) => {
    const matchesTopic = state.activeTopic === "전체" || post.category === state.activeTopic;
    const haystack = `${post.title} ${post.excerpt} ${post.category} ${post.author}`.toLowerCase();
    return matchesTopic && (!query || haystack.includes(query));
  });
}

function getTopics() {
  const topics = [...new Set(state.posts.map((post) => post.category).filter(Boolean))];
  return ["전체", ...topics];
}

function renderTabs() {
  els.tabs.innerHTML = getTopics()
    .map(
      (topic) => `
        <button class="topic-tab ${topic === state.activeTopic ? "is-active" : ""}"
          type="button"
          data-topic="${escapeHtml(topic)}">
          ${escapeHtml(topic)}
        </button>
      `
    )
    .join("");
}

function renderFeatured(posts) {
  const post = posts[0] || state.posts[0];
  if (!post) return;

  els.featured.innerHTML = `
    <div class="featured-media">
      <img src="${escapeHtml(post.cover_image)}" alt="" loading="eager">
    </div>
    <div class="featured-body">
      <p class="meta-line">${escapeHtml(post.category)} · ${formatDate(post.published_at)} · ${escapeHtml(post.reading_time)}</p>
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.excerpt)}</p>
      <button class="post-button" type="button" data-open="${escapeHtml(post.id)}">읽어보기</button>
    </div>
  `;
}

function renderPosts() {
  const posts = getFilteredPosts();
  els.resultCount.textContent = `${posts.length}개 글`;
  renderFeatured(posts);

  if (posts.length === 0) {
    els.grid.innerHTML = `<div class="empty-state">검색 조건에 맞는 글이 없습니다.</div>`;
    return;
  }

  els.grid.innerHTML = posts
    .map(
      (post) => `
        <article class="post-card">
          <div class="post-image">
            <img src="${escapeHtml(post.cover_image)}" alt="" loading="lazy">
          </div>
          <div class="post-content">
            <div class="tag-row">
              <span class="tag">${escapeHtml(post.category)}</span>
              <span class="tag">${escapeHtml(post.reading_time)}</span>
            </div>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt)}</p>
            <div class="post-footer">
              <span class="author">${escapeHtml(post.author)}</span>
              <button class="post-button" type="button" data-open="${escapeHtml(post.id)}">열기</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderStatus() {
  if (state.source === "fallback") {
    els.dataStatus.textContent = "추천 글 표시 중";
    els.statusCopy.textContent =
      "아직 공개된 글이 없어 홈에서 바로 읽을 수 있는 기본 글을 보여주고 있습니다.";
    return;
  }

  els.dataStatus.textContent = "공개 피드 준비 완료";
  els.statusCopy.textContent = "새로 올라온 글을 최신 순서로 보여주고 있습니다.";
}

function renderReadingList() {
  els.readingList.innerHTML = state.posts
    .slice(0, 4)
    .map((post) => `<li>${escapeHtml(post.title)}</li>`)
    .join("");
}

function render() {
  renderTabs();
  renderPosts();
  renderStatus();
  renderReadingList();
}

function openPost(id) {
  const post = state.posts.find((item) => String(item.id) === String(id));
  if (!post) return;

  els.dialogContent.innerHTML = `
    <div class="dialog-cover">
      <img src="${escapeHtml(post.cover_image)}" alt="">
    </div>
    <div class="dialog-body">
      <p class="meta-line">${escapeHtml(post.category)} · ${formatDate(post.published_at)} · ${escapeHtml(post.author)}</p>
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.body)}</p>
    </div>
  `;
  els.dialog.showModal();
}

els.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = els.searchInput.value;
  renderPosts();
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderPosts();
});

els.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-topic]");
  if (!button) return;
  state.activeTopic = button.dataset.topic;
  render();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open]");
  if (!button) return;
  openPost(button.dataset.open);
});

els.dialogClose.addEventListener("click", () => els.dialog.close());

els.dialog.addEventListener("click", (event) => {
  if (event.target === els.dialog) {
    els.dialog.close();
  }
});

els.year.textContent = new Date().getFullYear();

loadPosts().then(render);
