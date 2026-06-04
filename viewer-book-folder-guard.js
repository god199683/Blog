(() => {
  const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

  const params = new URLSearchParams(window.location.search);
  const currentPostId = params.get("id") || "";
  const viewerNode = String(params.get("node") || "").trim();
  const viewerTarget = params.get("target") === "materials" || params.has("material") ? "materials" : "posts";
  if (viewerTarget !== "posts" || !currentPostId) return;

  let currentPost = null;
  const postCache = new Map();

  function getToken() {
    return window.blogSession?.read?.()?.access_token || SUPABASE_ANON_KEY;
  }

  function normalize(value = "") {
    return String(value || "").trim();
  }

  async function fetchPost(id) {
    const key = String(id || "");
    if (!key) return null;
    if (postCache.has(key)) return postCache.get(key);

    const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
    endpoint.searchParams.set("select", "id,title,category,folder,folder_id,folder_name,folder_path,login_id,user_id,author");
    endpoint.searchParams.set("id", `eq.${key}`);
    endpoint.searchParams.set("limit", "1");

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${getToken()}`,
      },
    });
    const data = await response.json().catch(() => []);
    const post = response.ok && Array.isArray(data) ? data[0] || null : null;
    postCache.set(key, post);
    return post;
  }

  function getFolderScope(post = {}) {
    const category = normalize(post.category) || "전체";
    const folderId = normalize(post.folder_id);
    const folderPath = normalize(post.folder_path);
    const folderName = normalize(post.folder_name || post.folder);
    return {
      category,
      folderId,
      folderPath,
      folderName,
      hasFolder: Boolean(folderId || folderPath || folderName),
    };
  }

  function isSameFolder(targetPost) {
    if (!currentPost || !targetPost) return false;

    const source = getFolderScope(currentPost);
    const target = getFolderScope(targetPost);

    // When opened from a folder node, do not allow moving to a post assigned to another folder id.
    if (viewerNode && viewerNode !== "all" && source.folderId === viewerNode) {
      return target.folderId === viewerNode;
    }

    // If the current post has a folder id, it is the strongest folder boundary.
    if (source.folderId) return target.folderId === source.folderId;

    // Folder path is the next safest boundary.
    if (source.folderPath) return target.folderPath === source.folderPath;

    // Folder names can repeat across categories, so include category.
    if (source.folderName) {
      return target.category === source.category && target.folderName === source.folderName;
    }

    // If the current post is not in a folder, only allow other no-folder posts in the same category.
    return !target.hasFolder && target.category === source.category;
  }

  function setButtonBlocked(button, blocked) {
    if (!button) return;
    button.disabled = blocked;
    button.classList.toggle("is-scope-blocked", blocked);
    if (blocked) {
      button.dataset.scopeBlocked = "true";
      button.title = "현재 폴더의 마지막 글입니다.";
    } else if (button.dataset.scopeBlocked) {
      delete button.dataset.scopeBlocked;
      button.removeAttribute("title");
    }
  }

  async function protectButton(button) {
    const targetId = button?.dataset?.postId || "";
    if (!button || !targetId) return;
    const targetPost = await fetchPost(targetId);
    setButtonBlocked(button, !isSameFolder(targetPost));
  }

  async function protectNavigation() {
    if (!currentPost) currentPost = await fetchPost(currentPostId);
    if (!currentPost) return;

    await Promise.all([
      protectButton(document.querySelector("[data-viewer-prev]")),
      protectButton(document.querySelector("[data-viewer-next]")),
      protectButton(document.querySelector("[data-viewer-prev-side]")),
      protectButton(document.querySelector("[data-viewer-next-side]")),
    ]);
  }

  function interceptBlockedNavigation(event) {
    const button = event.target.closest?.("[data-viewer-prev], [data-viewer-next], [data-viewer-prev-side], [data-viewer-next-side]");
    if (!button || !button.dataset.scopeBlocked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function init() {
    document.addEventListener("click", interceptBlockedNavigation, true);
    const root = document.querySelector("[data-viewer-book-nav]") || document.body;
    const observer = new MutationObserver(() => protectNavigation());
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-post-id", "disabled"] });
    protectNavigation();
    setInterval(protectNavigation, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
