const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const els = {
  feedList: document.querySelector(".feed-list"),
  feedEmpty: document.querySelector(".feed-empty"),
  publicProfiles: document.querySelector("[data-public-profiles]"),
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
  const loginId = raw.login_id || "";
  const author = loginId || raw.author || "blog";
  return {
    id: raw.id || "",
    title: raw.title || "제목 없는 글",
    excerpt: getPostExcerpt(raw),
    category: raw.category || "전체",
    author,
    loginId,
    userId: raw.user_id || "",
    publishedAt: raw.published_at || raw.created_at || "",
  };
}

async function fetchPublicPosts() {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set(
    "select",
    "id,title,excerpt,body,category,author,login_id,user_id,published,published_at,created_at"
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

function getCurrentLoginId(session) {
  return (
    window.blogSession?.getId?.(session) ||
    session?.id ||
    session?.user?.user_metadata?.login_id ||
    session?.user?.user_metadata?.username ||
    ""
  );
}

async function fetchPublicProfiles() {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_profiles`);
  endpoint.searchParams.set("select", "login_id,blog_title,updated_at,created_at");
  endpoint.searchParams.set("order", "login_id.asc");
  endpoint.searchParams.set("limit", "60");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data?.message || "계정 목록을 불러오지 못했습니다.");
  }

  return Array.isArray(data)
    ? data
        .map((profile) => ({
          id: String(profile.login_id || "").trim(),
          title: profile.blog_title || `${profile.login_id}'s Blog`,
          updatedAt: profile.updated_at || profile.created_at || "",
        }))
        .filter((profile) => profile.id)
    : [];
}

function buildPublicPostProfileMap(posts = []) {
  const counts = new Map();
  posts.forEach((post) => {
    const id = String(post.loginId || post.author || "").trim();
    if (!id) return;
    const current = counts.get(id) || {
      id,
      title: `${id}'s Blog`,
      count: 0,
      latestAt: "",
    };
    current.count += 1;
    if (!current.latestAt || Date.parse(post.publishedAt || "") > Date.parse(current.latestAt || "")) {
      current.latestAt = post.publishedAt || "";
    }
    counts.set(id, current);
  });
  return counts;
}

function getPublicProfiles(posts = [], profileRows = []) {
  const postProfiles = buildPublicPostProfileMap(posts);
  const profiles = new Map();

  profileRows.forEach((profile) => {
    const id = String(profile.id || "").trim();
    if (!id) return;
    const postMeta = postProfiles.get(id);
    profiles.set(id, {
      id,
      title: profile.title || postMeta?.title || `${id}'s Blog`,
      count: postMeta?.count || 0,
      latestAt: postMeta?.latestAt || profile.updatedAt || "",
    });
  });

  postProfiles.forEach((profile, id) => {
    if (!profiles.has(id)) profiles.set(id, profile);
  });

  return [...profiles.values()].sort((a, b) => {
    const timeDiff = Date.parse(b.latestAt || "") - Date.parse(a.latestAt || "");
    if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id, "ko", { numeric: true });
  });
}

function getPublicProfileHref(profile, session) {
  const currentId = getCurrentLoginId(session);
  if (currentId && currentId.toLowerCase() === profile.id.toLowerCase()) {
    return "./my-blog.html";
  }
  return `./my-blog.html?user=${encodeURIComponent(profile.id)}`;
}

function renderPublicProfiles(posts = [], profileRows = [], session = null) {
  if (!els.publicProfiles) return;
  const profiles = getPublicProfiles(posts, profileRows).slice(0, 18);
  if (profiles.length === 0) {
    els.publicProfiles.hidden = true;
    els.publicProfiles.innerHTML = "";
    return;
  }

  els.publicProfiles.hidden = false;
  els.publicProfiles.innerHTML = profiles
    .map((profile) => {
      const initial = profile.id.slice(0, 1).toUpperCase();
      return `
        <a class="public-profile-card" href="${escapeHtml(getPublicProfileHref(profile, session))}">
          <span class="public-profile-mark" aria-hidden="true">${escapeHtml(initial)}</span>
          <span>
            <strong>${escapeHtml(profile.title)}</strong>
            <small>@${escapeHtml(profile.id)} · 공개 글 ${profile.count}개</small>
          </span>
        </a>
      `;
    })
    .join("");
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
          <a class="feed-row" href="./viewer.html?id=${encodeURIComponent(post.id)}&from=home">
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
  const session = await Promise.resolve(window.blogSession?.ready).catch(() => null);
  try {
    renderEmpty("공개 글을 불러오는 중입니다.");
    const [posts, profiles] = await Promise.all([
      fetchPublicPosts(),
      fetchPublicProfiles().catch(() => []),
    ]);
    renderPublicProfiles(posts, profiles, session);
    renderPublicPosts(posts);
  } catch (error) {
    try {
      const profiles = await fetchPublicProfiles();
      renderPublicProfiles([], profiles, session);
    } catch {
      renderPublicProfiles([], [], session);
    }
    renderEmpty(error.message || "공개 글을 불러오지 못했습니다.");
  }
}

initPublicHome();
