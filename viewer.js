const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const params = new URLSearchParams(window.location.search);
const postId = params.get("id") || "";

const els = {
  title: document.querySelector("[data-viewer-title]"),
  location: document.querySelector("[data-viewer-location]"),
  body: document.querySelector("[data-viewer-body]"),
  message: document.querySelector("[data-viewer-message]"),
  back: document.querySelector("[data-viewer-back]"),
  edit: document.querySelector("[data-viewer-edit]"),
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSession() {
  return window.blogSession?.read?.() || null;
}

function getSessionId(session) {
  return window.blogSession?.getId?.(session) || "";
}

function cleanViewerHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || "").trim().toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) node.removeAttribute(attr.name);
    });
  });

  return template.innerHTML;
}

function getPostLocation(post) {
  if (post.folder_path) return post.folder_path;
  return [post.category || "전체", post.folder_name || post.folder || ""].filter(Boolean).join(" / ");
}

async function fetchPost() {
  if (!postId) {
    throw new Error("글 주소가 올바르지 않습니다.");
  }

  const session = getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("id", `eq.${postId}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || "글을 불러오지 못했습니다.";
    throw new Error(message);
  }

  const post = Array.isArray(data) ? data[0] : null;
  if (!post) throw new Error("글을 찾지 못했습니다.");
  return post;
}

async function initViewer() {
  try {
    const post = await fetchPost();
    const session = getSession();
    const loginId = getSessionId(session);
    const isOwner = [post.author, post.login_id, post.user_id]
      .filter(Boolean)
      .some((value) =>
        [loginId, session?.user?.id].filter(Boolean).some((id) => String(value).toLowerCase() === String(id).toLowerCase())
      );

    els.title.textContent = post.title || "제목 없는 글";
    els.location.textContent = getPostLocation(post);
    els.body.innerHTML = post.body ? cleanViewerHtml(post.body) : `<p>${escapeHtml(post.excerpt || "")}</p>`;
    els.edit.hidden = !isOwner;
  } catch (error) {
    els.title.textContent = "글을 불러오지 못했습니다";
    els.location.textContent = "";
    els.body.innerHTML = "";
    els.message.textContent = error.message;
  }
}

els.back.addEventListener("click", () => {
  window.location.href = "./my-blog.html";
});

els.edit.addEventListener("click", () => {
  if (!postId) return;
  window.location.href = `./editor.html?post=${encodeURIComponent(postId)}`;
});

Promise.resolve(window.blogSession?.ready).finally(initViewer);
