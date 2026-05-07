const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_TOPIC = "전체";
const DEFAULT_POST = {
  title: "제목 없는 글",
  excerpt: "요약이 아직 작성되지 않았습니다.",
  category: "일반",
  author: "Blog",
  published_at: "",
  reading_time: "",
  cover_image: "",
  body: "본문이 아직 작성되지 않았습니다.",
};

const INTERNAL_POSTS = [];

const state = {
  posts: [],
  activeTopic: ALL_TOPIC,
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

function cleanPostHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => {
    node.remove();
  });
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "style") {
        node.removeAttribute(attr.name);
      }
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML.trim();
}

function renderPostBody(body = "") {
  if (/<[a-z][\s\S]*>/i.test(body)) {
    return cleanPostHtml(body);
  }
  return `<p>${escapeHtml(body)}</p>`;
}

function normalizePost(raw, index) {
  const title = raw.title || raw.name || DEFAULT_POST.title;
  const excerpt =
    raw.excerpt || raw.summary || raw.description || raw.subtitle || DEFAULT_POST.excerpt;
  const category = raw.category || raw.topic || raw.tag || DEFAULT_POST.category;
  const publishedAt =
    raw.published_at || raw.created_at || raw.date || DEFAULT_POST.published_at;

  return {
    id: raw.id || raw.slug || `post-${index}`,
    title,
    excerpt,
    category,
    author: raw.author || raw.author_name || raw.writer || DEFAULT_POST.author,
    published_at: publishedAt,
    reading_time: raw.reading_time || raw.read_time || DEFAULT_POST.reading_time,
    cover_image:
      raw.cover_image || raw.image_url || raw.thumbnail_url || DEFAULT_POST.cover_image,
    body: raw.body || raw.content || excerpt || DEFAULT_POST.body,
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

  state.posts = INTERNAL_POSTS;
  state.source = "empty";
}

function getFilteredPosts() {
  const query = state.query.trim().toLowerCase();
  return state.posts.filter((post) => {
    const matchesTopic = state.activeTopic === ALL_TOPIC || post.category === state.activeTopic;
    const haystack = `${post.title} ${post.excerpt} ${post.category} ${post.author}`.toLowerCase();
    return matchesTopic && (!query || haystack.includes(query));
  });
}

function getTopics() {
  const topics = [...new Set(state.posts.map((post) => post.category).filter(Boolean))];
  return [ALL_TOPIC, ...topics];
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

function renderCover(post, className) {
  if (!post.cover_image) {
    return `<div class="${className} image-placeholder" aria-hidden="true"></div>`;
  }

  return `
    <div class="${className}">
      <img src="${escapeHtml(post.cover_image)}" alt="" loading="lazy">
    </div>
  `;
}

function renderFeatured(posts) {
  const post = posts[0] || state.posts[0];

  if (!post) {
    els.featured.innerHTML = `
      <div class="featured-empty">
        <p class="meta-line">Ready</p>
        <h2>아직 공개된 글이 없습니다</h2>
        <p>새 글이 등록되면 이곳에 가장 먼저 표시됩니다.</p>
      </div>
    `;
    return;
  }

  els.featured.innerHTML = `
    ${renderCover(post, "featured-media")}
    <div class="featured-body">
      <p class="meta-line">${escapeHtml(post.category)} · ${formatDate(post.published_at)}${post.reading_time ? ` · ${escapeHtml(post.reading_time)}` : ""}</p>
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
    els.grid.innerHTML = `
      <div class="empty-state">
        <p class="meta-line">Empty</p>
        <h3>저장된 글이 없습니다</h3>
      </div>
    `;
    return;
  }

  els.grid.innerHTML = posts
    .map(
      (post) => `
        <article class="post-card">
          ${renderCover(post, "post-image")}
          <div class="post-content">
            <div class="tag-row">
              <span class="tag">${escapeHtml(post.category)}</span>
              ${post.reading_time ? `<span class="tag">${escapeHtml(post.reading_time)}</span>` : ""}
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
  if (state.posts.length === 0) {
    els.dataStatus.textContent = "글 목록이 비어 있습니다";
    els.statusCopy.textContent =
      "내부 샘플 글을 삭제했습니다. 공개 글을 추가하면 홈 피드가 자동으로 채워집니다.";
    return;
  }

  els.dataStatus.textContent = "공개 피드 준비 완료";
  els.statusCopy.textContent = "새로 올라온 글을 최신 순서로 보여주고 있습니다.";
}

function renderReadingList() {
  if (state.posts.length === 0) {
    els.readingList.innerHTML = `<li>새 글을 기다리는 중입니다.</li>`;
    return;
  }

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
    ${renderCover(post, "dialog-cover")}
    <div class="dialog-body">
      <p class="meta-line">${escapeHtml(post.category)} · ${formatDate(post.published_at)} · ${escapeHtml(post.author)}</p>
      <h2>${escapeHtml(post.title)}</h2>
      ${renderPostBody(post.body)}
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
