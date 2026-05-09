const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const els = {
  title: document.querySelector("[data-blog-title]"),
  brandTitle: document.querySelector("[data-brand-title]"),
  owner: document.querySelector("[data-blog-owner]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
  profileTitle: document.querySelector("[data-profile-title]"),
  profileId: document.querySelector("[data-profile-id]"),
  count: document.querySelector("[data-blog-count]"),
  postList: document.querySelector("[data-post-list]"),
};

async function requestRest(path, token, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "블로그 정보를 불러오지 못했습니다.");
  return payload;
}

function renderBlog(id, profile = null) {
  const title = profile?.blog_title || `${id}'s Blog`;
  if (els.title) els.title.textContent = title;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.profileTitle) els.profileTitle.textContent = title;
  if (els.profileId) els.profileId.textContent = `@${id}`;
  if (els.owner) els.owner.textContent = `${id} 계정의 개인 블로그입니다.`;
  els.initials.forEach((initial) => {
    initial.textContent = id.slice(0, 1).toUpperCase();
  });
  document.title = `${title} | 블로그 홈`;
}

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

function belongsToUser(post, session, id) {
  return (
    post.user_id === session?.user?.id ||
    String(post.login_id || "").toLowerCase() === id.toLowerCase() ||
    String(post.author || "").toLowerCase() === id.toLowerCase()
  );
}

function renderPosts(posts = []) {
  if (els.count) els.count.textContent = `${posts.length}개의 글`;
  if (!els.postList) return;

  if (posts.length === 0) {
    els.postList.innerHTML = `
      <div class="blog-empty-row">
        <span>아직 작성된 글이 없습니다.</span>
        <span>0</span>
        <span>-</span>
      </div>
    `;
    return;
  }

  els.postList.innerHTML = posts
    .map((post) => {
      const visibility = post.published === false ? "비공개" : "공개";
      return `
        <div class="blog-post-row">
          <span>
            <a class="blog-post-title" href="./editor.html?post=${encodeURIComponent(post.id)}">
              ${escapeHtml(post.title || "제목 없는 글")}
            </a>
            <small>${escapeHtml(post.category || "전체")} · ${visibility}</small>
          </span>
          <span>0</span>
          <span>${formatDate(post.published_at || post.created_at)}</span>
        </div>
      `;
    })
    .join("");
}

async function fetchUserPosts(session, id) {
  const rows = await requestRest(
    "posts?select=id,title,category,author,login_id,user_id,published,published_at,created_at&order=published_at.desc&limit=100",
    session.access_token
  );
  return Array.isArray(rows) ? rows.filter((post) => belongsToUser(post, session, id)) : [];
}

const listToggle = document.querySelector("[data-list-toggle]");
const blogBoard = document.querySelector("[data-blog-board]");

if (listToggle && blogBoard) {
  listToggle.addEventListener("click", () => {
    const isCollapsed = blogBoard.classList.toggle("is-list-collapsed");
    listToggle.textContent = isCollapsed ? "목록열기" : "목록닫기";
    listToggle.setAttribute("aria-expanded", String(!isCollapsed));
  });
  listToggle.setAttribute("aria-expanded", "true");
}

async function ensureBlogProfile(session, id) {
  if (!session?.access_token || !session.user?.id) return null;

  await requestRest("blog_profiles?on_conflict=user_id", session.access_token, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      login_id: id,
      blog_title: `${id}'s Blog`,
      updated_at: new Date().toISOString(),
    }),
  });

  const rows = await requestRest(
    `blog_profiles?select=login_id,blog_title&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  return Array.isArray(rows) ? rows[0] : null;
}

window.blogSession?.ready.then(async (session) => {
  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }

  renderBlog(id);
  renderPosts([]);
  try {
    const profile = await ensureBlogProfile(session, id);
    renderBlog(id, profile);
  } catch {
    renderBlog(id);
  }

  try {
    renderPosts(await fetchUserPosts(session, id));
  } catch {
    renderPosts([]);
  }
});
