const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const els = {
  title: document.querySelector("#account-title"),
  lede: document.querySelector("#account-lede"),
  name: document.querySelector("#account-name"),
  status: document.querySelector("#account-status"),
  count: document.querySelector("#account-count"),
  posts: document.querySelector("#account-posts"),
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
    cover_image: raw.cover_image || raw.image_url || raw.thumbnail_url || "",
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
    throw new Error("글을 불러오지 못했습니다.");
  }

  return response.json();
}

function renderCover(post) {
  if (!post.cover_image) {
    return `<div class="post-image image-placeholder" aria-hidden="true"></div>`;
  }

  return `
    <div class="post-image">
      <img src="${escapeHtml(post.cover_image)}" alt="" loading="lazy">
    </div>
  `;
}

function renderPosts(posts) {
  els.count.textContent = `${posts.length}개 글`;

  if (posts.length === 0) {
    els.posts.innerHTML = `
      <div class="empty-state">
        <p class="meta-line">Empty</p>
        <h3>이 계정의 글이 없습니다</h3>
      </div>
    `;
    return;
  }

  els.posts.innerHTML = posts
    .map(
      (post) => `
        <article class="post-card">
          ${renderCover(post)}
          <div class="post-content">
            <div class="tag-row">
              <span class="tag">${escapeHtml(post.category)}</span>
              ${post.reading_time ? `<span class="tag">${escapeHtml(post.reading_time)}</span>` : ""}
            </div>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt)}</p>
            <div class="post-footer">
              <span class="author">${formatDate(post.published_at)}</span>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

async function initMyBlog() {
  const session = getSession();
  const id = getSessionId(session);

  if (!id) {
    els.title.textContent = "로그인이 필요합니다";
    els.lede.textContent = "계정별 블로그 홈은 로그인 후 사용할 수 있습니다.";
    els.name.textContent = "방문자";
    els.status.innerHTML = `<a href="./login.html">로그인하러 가기</a>`;
    renderPosts([]);
    return;
  }

  els.title.textContent = `${id}의 블로그 홈`;
  els.lede.textContent = "이 계정으로 작성한 공개 글을 모아 보여줍니다.";
  els.name.textContent = id;
  els.status.textContent = `${id} 님의 개인 블로그 홈입니다.`;

  try {
    const rows = await fetchPosts();
    const posts = rows
      .filter(isPublicPost)
      .filter((post) => belongsToAccount(post, id))
      .map(normalizePost)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

    renderPosts(posts);
  } catch (error) {
    els.status.textContent = error.message;
    renderPosts([]);
  }
}

initMyBlog();
