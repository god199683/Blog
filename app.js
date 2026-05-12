const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const els = {
  feedList: document.querySelector(".feed-list"),
  feedEmpty: document.querySelector(".feed-empty"),
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function getPlainTextFromHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;
  return (template.content.textContent || "").replace(/\s+/g, " ").trim();
}

function getPostExcerpt(post = {}) {
  const text = post.excerpt || getPlainTextFromHtml(post.body || "");
  return text.length > 92 ? `${text.slice(0, 92).trim()}...` : text;
}

function normalizePost(raw = {}) {
  return {
    id: raw.id || "",
    title: raw.title || "제목 없는 글",
    excerpt: getPostExcerpt(raw),
    category: raw.category || "전체",
    author: raw.login_id || raw.author || "블로그",
    publishedAt: raw.published_at || raw.created_at || "",
  };
}

async function fetchPublicPosts() {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set(
    "select",
    "id,title,excerpt,body,category,author,login_id,published,published_at,created_at"
  );
  endpoint.searchParams.set("published", "eq.true");
  endpoint.searchParams.set("order", "published_at.desc.nullslast,created_at.desc.nullslast");
  endpoint.searchParams.set("limit", "30");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.message || "공개 글을 불러오지 못했습니다.");
  }

  return Array.isArray(data) ? data.map(normalizePost) : [];
}

function renderEmpty(message = "공개된 글이 이곳에 표시됩니다.") {
  if (!els.feedList) return;
  const existingEmpty = els.feedList.querySelector(".feed-empty");
  if (existingEmpty) {
    existingEmpty.innerHTML = `<p>${escapeHtml(message)}</p>`;
    return;
  }
  els.feedList.insertAdjacentHTML("beforeend", `<div class="feed-empty"><p>${escapeHtml(message)}</p></div>`);
}

function renderPublicPosts(posts = []) {
  if (!els.feedList) return;

  els.feedList.querySelectorAll(".feed-row, .feed-empty").forEach((node) => node.remove());
  if (posts.length === 0) {
    renderEmpty("아직 공개된 글이 없습니다.");
    return;
  }

  els.feedList.insertAdjacentHTML(
    "beforeend",
    posts
      .map(
        (post) => `
          <a class="feed-row" href="./viewer.html?id=${encodeURIComponent(post.id)}">
            <span>
              <strong>${escapeHtml(post.title)}</strong>
              <small>${escapeHtml(post.category)} · ${escapeHtml(post.author)}${post.excerpt ? ` · ${escapeHtml(post.excerpt)}` : ""}</small>
            </span>
            <time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(formatDate(post.publishedAt))}</time>
          </a>
        `
      )
      .join("")
  );
}

async function initPublicHome() {
  try {
    renderEmpty("공개 글을 불러오는 중입니다.");
    const posts = await fetchPublicPosts();
    renderPublicPosts(posts);
  } catch (error) {
    renderEmpty(error.message || "공개 글을 불러오지 못했습니다.");
  }
}

initPublicHome();
