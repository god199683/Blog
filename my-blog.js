const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_FILTER = "all";

const state = {
  id: "",
  posts: [],
  activeFilter: ALL_FILTER,
  error: "",
};

const els = {
  main: document.querySelector("[data-my-blog-main]"),
  sidebar: document.querySelector("[data-sidebar]"),
  toggle: document.querySelector("[data-sidebar-toggle]"),
  nav: document.querySelector("#my-sidebar-nav"),
  title: document.querySelector("#my-post-title"),
  status: document.querySelector("#my-post-status"),
  count: document.querySelector("#my-post-count"),
  list: document.querySelector("#my-post-list"),
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

function getSession() {
  return window.blogSession?.read?.() || null;
}

function getSessionId(session) {
  return window.blogSession?.getId?.(session) || "";
}

function normalizePost(raw, index) {
  const title = raw.title || raw.name || "제목 없는 글";
  const excerpt = raw.excerpt || raw.summary || raw.description || raw.subtitle || "";
  const category = raw.category || raw.topic || raw.tag || "일반";
  const publishedAt = raw.published_at || raw.created_at || raw.date || "";

  return {
    id: raw.id || raw.slug || `post-${index}`,
    title,
    excerpt,
    category,
    author: raw.author || raw.author_name || raw.writer || "",
    published_at: publishedAt,
    reading_time: raw.reading_time || raw.read_time || "",
  };
}

function belongsToAccount(raw, id) {
  const normalizedId = id.toLowerCase();
  return [raw.author, raw.author_name, raw.writer, raw.login_id, raw.user_id, raw.owner_id]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === normalizedId);
}

function isPublicPost(raw) {
  if (raw.published === false) return false;
  if (raw.is_published === false) return false;
  if (String(raw.status || "").toLowerCase() === "draft") return false;
  return true;
}

async function fetchPosts() {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("limit", "100");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error("");
  }

  return response.json();
}

function getFilters() {
  const categories = [...new Set(state.posts.map((post) => post.category).filter(Boolean))];
  return [
    { id: ALL_FILTER, label: "전체", count: state.posts.length },
    ...categories.map((category) => ({
      id: category,
      label: category,
      count: state.posts.filter((post) => post.category === category).length,
    })),
  ];
}

function getFilteredPosts() {
  if (state.activeFilter === ALL_FILTER) return state.posts;
  return state.posts.filter((post) => post.category === state.activeFilter);
}

function renderSidebar() {
  const filters = getFilters();
  els.nav.innerHTML = filters
    .map((filter) => {
      const isActive = filter.id === state.activeFilter;
      const shortLabel = filter.label.slice(0, 1).toUpperCase();
      return `
        <button class="sidebar-filter ${isActive ? "is-active" : ""}"
          type="button"
          data-filter="${escapeHtml(filter.id)}"
          title="${escapeHtml(filter.label)}">
          <span class="sidebar-filter-key">${escapeHtml(shortLabel)}</span>
          <span class="sidebar-filter-label">${escapeHtml(filter.label)}</span>
          <span class="sidebar-filter-count">${filter.count}</span>
        </button>
      `;
    })
    .join("");
}

function renderList() {
  const posts = getFilteredPosts();
  els.count.textContent = `${posts.length}개 글`;

  if (!state.id) {
    els.status.innerHTML = `<a href="./login.html">로그인 후 내 블로그를 사용할 수 있습니다.</a>`;
    els.list.innerHTML = "";
    return;
  }

  els.status.textContent = state.error || "";

  if (posts.length === 0) {
    els.list.innerHTML = `
      <div class="empty-state">
        <h3>표시할 글이 없습니다</h3>
      </div>
    `;
    return;
  }

  els.list.innerHTML = posts
    .map(
      (post) => `
        <article class="my-post-item">
          <div>
            <p class="meta-line">${escapeHtml(post.category)} · ${formatDate(post.published_at)}</p>
            <h3>${escapeHtml(post.title)}</h3>
            ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}
          </div>
          ${post.reading_time ? `<span class="tag">${escapeHtml(post.reading_time)}</span>` : ""}
        </article>
      `
    )
    .join("");
}

function render() {
  renderSidebar();
  renderList();
}

function toggleSidebar() {
  const collapsed = !els.main.classList.contains("is-sidebar-collapsed");
  els.main.classList.toggle("is-sidebar-collapsed", collapsed);
  els.toggle.setAttribute("aria-expanded", String(!collapsed));
  els.toggle.setAttribute("aria-label", collapsed ? "사이드바 펼치기" : "사이드바 접기");
  els.toggle.textContent = collapsed ? "›" : "‹";
}

async function initMyBlog() {
  const session = getSession();
  state.id = getSessionId(session);

  if (state.id) {
    els.title.textContent = "내 글 목록";
  } else {
    els.title.textContent = "로그인이 필요합니다";
  }

  try {
    const rows = state.id ? await fetchPosts() : [];
    state.posts = rows
      .filter(isPublicPost)
      .filter((post) => belongsToAccount(post, state.id))
      .map(normalizePost)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  } catch (error) {
    state.error = error.message;
    state.posts = [];
  }

  render();
}

els.toggle.addEventListener("click", toggleSidebar);

els.nav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.activeFilter = button.dataset.filter;
  render();
});

initMyBlog();
