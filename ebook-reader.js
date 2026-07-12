const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const params = new URLSearchParams(window.location.search);
const INITIAL_NODE_ID = String(params.get("node") || "").trim();
const FONT_SIZE_KEY = "blog.ebookFontSize";

const state = {
  session: null,
  id: "",
  tree: [],
  posts: [],
  folders: [],
  activeFolderId: INITIAL_NODE_ID,
  activePosts: [],
  postIndex: 0,
  pageIndex: 0,
  pageCount: 1,
  pageStep: 0,
  fontSize: clampFontSize(Number.parseInt(localStorage.getItem(FONT_SIZE_KEY) || "18", 10)),
  pendingLastPage: false,
};

const els = {
  brandTitle: document.querySelector("[data-brand-title]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
  owner: document.querySelector("[data-ebook-owner]"),
  folderSelect: document.querySelector("[data-ebook-folder-select]"),
  folderList: document.querySelector("[data-ebook-folder-list]"),
  postList: document.querySelector("[data-ebook-post-list]"),
  folderPath: document.querySelector("[data-ebook-folder-path]"),
  title: document.querySelector("[data-ebook-title]"),
  stage: document.querySelector("[data-ebook-stage]"),
  content: document.querySelector("[data-ebook-content]"),
  prevPage: document.querySelector("[data-ebook-prev-page]"),
  nextPage: document.querySelector("[data-ebook-next-page]"),
  prevPost: document.querySelector("[data-ebook-prev-post]"),
  nextPost: document.querySelector("[data-ebook-next-post]"),
  progress: document.querySelector("[data-ebook-progress]"),
  position: document.querySelector("[data-ebook-position]"),
  fontDown: document.querySelector("[data-ebook-font-down]"),
  fontUp: document.querySelector("[data-ebook-font-up]"),
  fontSize: document.querySelector("[data-ebook-font-size]"),
  message: document.querySelector("[data-ebook-message]"),
};

function clampFontSize(value) {
  return Math.min(28, Math.max(12, Number(value) || 18));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeHtmlEntities(value = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value);
  return textarea.value;
}

function hasHtmlMarkup(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
}

function plainTextToHtml(value = "") {
  return (
    String(value || "")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("") || "<p></p>"
  );
}

function cleanHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());
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

function getPostHtml(post = {}) {
  const body = decodeHtmlEntities(post.body || "");
  return cleanHtml(hasHtmlMarkup(body) ? body : plainTextToHtml(body));
}

function getSessionId(session) {
  return window.blogSession?.getId?.(session) || "";
}

async function getFreshSession() {
  try {
    return (await window.blogSession?.refresh?.()) || state.session;
  } catch {
    return state.session;
  }
}

async function requestRest(path, token, options = {}, retry = true) {
  const session = await getFreshSession();
  const requestToken = session?.access_token || token || SUPABASE_ANON_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${requestToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || "데이터를 불러오지 못했습니다.";
    if (retry && /jwt expired|invalid jwt|expired/i.test(message)) {
      await window.blogSession?.refresh?.();
      return requestRest(path, token, options, false);
    }
    throw new Error(message);
  }
  return payload;
}

function normalizeTreeNode(node = {}) {
  const type = node.type === "folder" ? "folder" : "category";
  return {
    id: node.id || `${type}-${Math.random().toString(16).slice(2)}`,
    type,
    label: String(node.label || (type === "folder" ? "폴더" : "카테고리")).trim(),
    filterCategory: type === "category" ? node.filterCategory || node.label || "전체" : "",
    children: Array.isArray(node.children) ? node.children.map(normalizeTreeNode) : [],
  };
}

function normalizePost(post = {}) {
  return {
    id: String(post.id || ""),
    title: post.title || "제목 없는 글",
    body: post.body || "",
    category: post.category || "전체",
    folder_id: post.folder_id || "",
    folder_name: post.folder_name || post.folder || "",
    folder_path: post.folder_path || "",
    published: post.published !== false,
    published_at: post.published_at || post.created_at || "",
    created_at: post.created_at || post.published_at || "",
    author: post.author || "",
    login_id: post.login_id || "",
    user_id: post.user_id || "",
  };
}

function belongsToUser(post, session, id) {
  return (
    post.user_id === session?.user?.id ||
    String(post.login_id || "").toLowerCase() === String(id || "").toLowerCase() ||
    String(post.author || "").toLowerCase() === String(id || "").toLowerCase()
  );
}

function normalizeTrashPostIds(items = []) {
  const ids = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    (Array.isArray(item?.posts) ? item.posts : []).forEach((post) => {
      if (post?.id) ids.add(String(post.id));
    });
  });
  return ids;
}

function findNode(nodes = [], nodeId, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];
    if (node.id === nodeId) return { node, path: nextPath };
    const found = findNode(node.children || [], nodeId, nextPath);
    if (found) return found;
  }
  return null;
}

function collectFolderIds(node = {}, ids = new Set()) {
  if (node.type === "folder") ids.add(node.id);
  (node.children || []).forEach((child) => collectFolderIds(child, ids));
  return ids;
}

function getPathLabel(path = []) {
  return path
    .map((node) => node?.label || "")
    .filter(Boolean)
    .join(" / ");
}

function getFolderPosts(folderId) {
  const found = findNode(state.tree, folderId);
  if (!found) return [];
  const folderIds = collectFolderIds(found.node);
  return state.posts
    .filter((post) => folderIds.has(post.folder_id))
    .sort((a, b) => {
      const titleDiff = String(a.title || "").localeCompare(String(b.title || ""), "ko", {
        numeric: true,
        sensitivity: "base",
      });
      if (titleDiff) return titleDiff;
      return String(a.published_at || a.created_at || "").localeCompare(String(b.published_at || b.created_at || ""));
    });
}

function collectFolderOptions() {
  const folders = [];

  function walk(nodes = [], path = []) {
    nodes.forEach((node) => {
      const nextPath = [...path, node];
      if (node.type === "folder") {
        const posts = getFolderPosts(node.id);
        if (posts.length > 0) {
          folders.push({
            id: node.id,
            label: node.label,
            path: getPathLabel(nextPath),
            count: posts.length,
          });
        }
      }
      walk(node.children || [], nextPath);
    });
  }

  walk(state.tree);
  return folders;
}

async function loadTreeAndPosts(session) {
  const [treeRows, postRows] = await Promise.all([
    requestRest(`blog_trees?select=tree,trash&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`, session.access_token),
    requestRest(
      "posts?select=id,title,body,category,folder,folder_id,folder_name,folder_path,author,login_id,user_id,published,published_at,created_at&order=title.asc&limit=1000",
      session.access_token
    ),
  ]);
  const treeRow = Array.isArray(treeRows) ? treeRows[0] : null;
  const trashIds = normalizeTrashPostIds(treeRow?.trash);
  state.tree = Array.isArray(treeRow?.tree) ? treeRow.tree.map(normalizeTreeNode) : [];
  state.posts = (Array.isArray(postRows) ? postRows : [])
    .map(normalizePost)
    .filter((post) => belongsToUser(post, session, state.id))
    .filter((post) => !trashIds.has(post.id));
}

function setMessage(message = "") {
  if (els.message) els.message.textContent = message;
}

function syncIdentity() {
  const title = `${state.id}'s Blog`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.owner) els.owner.textContent = `@${state.id}`;
  els.initials.forEach((item) => {
    item.textContent = (state.id || "B").slice(0, 1).toUpperCase();
  });
}

function renderFolders() {
  state.folders = collectFolderOptions();
  if (!els.folderSelect || !els.folderList) return;

  if (state.folders.length === 0) {
    els.folderSelect.innerHTML = `<option value="">글이 있는 폴더가 없습니다</option>`;
    els.folderList.innerHTML = `<p class="ebook-empty">글이 들어 있는 폴더가 아직 없습니다.</p>`;
    return;
  }

  if (!state.folders.some((folder) => folder.id === state.activeFolderId)) {
    state.activeFolderId = state.folders[0].id;
  }

  els.folderSelect.innerHTML = state.folders
    .map(
      (folder) =>
        `<option value="${escapeHtml(folder.id)}" ${folder.id === state.activeFolderId ? "selected" : ""}>${escapeHtml(folder.path)} (${folder.count})</option>`
    )
    .join("");

  els.folderList.innerHTML = state.folders
    .map(
      (folder) => `
        <button class="${folder.id === state.activeFolderId ? "is-active" : ""}" type="button" data-ebook-folder="${escapeHtml(folder.id)}">
          <strong>${escapeHtml(folder.label)}</strong>
          <span>${escapeHtml(folder.path)} · ${folder.count}개 글</span>
        </button>
      `
    )
    .join("");
}

function renderPostList() {
  if (!els.postList) return;
  if (state.activePosts.length === 0) {
    els.postList.innerHTML = `<p class="ebook-empty">선택한 폴더에 글이 없습니다.</p>`;
    return;
  }
  els.postList.innerHTML = `
    <strong>글 목록</strong>
    ${state.activePosts
      .map(
        (post, index) => `
          <button class="${index === state.postIndex ? "is-active" : ""}" type="button" data-ebook-post-index="${index}">
            <span>${escapeHtml(post.title)}</span>
          </button>
        `
      )
      .join("")}
  `;
}

function updateReaderFont() {
  state.fontSize = clampFontSize(state.fontSize);
  document.body.style.setProperty("--ebook-font-size", `${state.fontSize}px`);
  if (els.fontSize) els.fontSize.textContent = `${state.fontSize}px`;
  localStorage.setItem(FONT_SIZE_KEY, String(state.fontSize));
  schedulePagination(true);
}

function clearPagination() {
  state.pageIndex = 0;
  state.pageCount = 1;
  state.pageStep = 0;
  if (els.content) els.content.style.transform = "translateX(0)";
}

function updatePagination() {
  if (!els.content) return;
  const surface = els.content.closest(".ebook-page-surface");
  const width = Math.max(1, surface?.clientWidth || els.content.clientWidth || 1);
  const gap = 48;
  state.pageStep = width + gap;
  els.content.style.columnWidth = `${width}px`;
  els.content.style.columnGap = `${gap}px`;
  state.pageCount = Math.max(1, Math.ceil(Math.max(els.content.scrollWidth, width) / state.pageStep));
  if (state.pendingLastPage) {
    state.pageIndex = state.pageCount - 1;
    state.pendingLastPage = false;
  }
  state.pageIndex = Math.min(Math.max(state.pageIndex, 0), state.pageCount - 1);
  els.content.style.transform = `translateX(${-state.pageIndex * state.pageStep}px)`;
  renderProgress();
}

function schedulePagination(resetPage = false) {
  if (resetPage) clearPagination();
  requestAnimationFrame(() => requestAnimationFrame(updatePagination));
}

function renderProgress() {
  const post = state.activePosts[state.postIndex] || null;
  const folder = state.folders.find((item) => item.id === state.activeFolderId);
  if (els.folderPath) els.folderPath.textContent = folder ? folder.path : "폴더를 선택해주세요.";
  if (els.title) els.title.textContent = post?.title || "책 뷰어";
  if (els.position) els.position.textContent = `${state.pageIndex + 1} / ${state.pageCount} · ${state.postIndex + 1} / ${Math.max(state.activePosts.length, 1)}`;
  if (els.progress) {
    els.progress.max = String(state.pageCount);
    els.progress.value = String(state.pageIndex + 1);
    els.progress.disabled = state.pageCount <= 1;
  }
  if (els.prevPage) els.prevPage.disabled = state.pageIndex <= 0 && state.postIndex <= 0;
  if (els.nextPage) els.nextPage.disabled = state.pageIndex >= state.pageCount - 1 && state.postIndex >= state.activePosts.length - 1;
  if (els.prevPost) els.prevPost.disabled = state.postIndex <= 0;
  if (els.nextPost) els.nextPost.disabled = state.postIndex >= state.activePosts.length - 1;
}

function renderCurrentPost({ lastPage = false } = {}) {
  const post = state.activePosts[state.postIndex] || null;
  if (!post) {
    if (els.content) els.content.innerHTML = `<p>선택한 폴더에 표시할 글이 없습니다.</p>`;
    renderProgress();
    return;
  }
  state.pendingLastPage = Boolean(lastPage);
  if (els.content) {
    els.content.innerHTML = `
      <header class="ebook-content-title">
        <h2>${escapeHtml(post.title)}</h2>
      </header>
      ${getPostHtml(post)}
    `;
  }
  renderPostList();
  schedulePagination(true);
}

function selectFolder(folderId) {
  if (!folderId) return;
  state.activeFolderId = folderId;
  state.activePosts = getFolderPosts(folderId);
  state.postIndex = 0;
  renderFolders();
  renderPostList();
  renderCurrentPost();
  const url = new URL(window.location.href);
  url.searchParams.set("node", folderId);
  history.replaceState(null, "", url);
}

function selectPost(index, options = {}) {
  if (index < 0 || index >= state.activePosts.length) return;
  state.postIndex = index;
  renderCurrentPost(options);
}

function nextPage() {
  if (state.pageIndex < state.pageCount - 1) {
    state.pageIndex += 1;
    updatePagination();
    return;
  }
  selectPost(state.postIndex + 1);
}

function prevPage() {
  if (state.pageIndex > 0) {
    state.pageIndex -= 1;
    updatePagination();
    return;
  }
  selectPost(state.postIndex - 1, { lastPage: true });
}

function bindEvents() {
  els.folderSelect?.addEventListener("change", (event) => selectFolder(event.target.value));
  els.folderList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ebook-folder]");
    if (button) selectFolder(button.dataset.ebookFolder);
  });
  els.postList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ebook-post-index]");
    if (button) selectPost(Number(button.dataset.ebookPostIndex) || 0);
  });
  els.prevPage?.addEventListener("click", prevPage);
  els.nextPage?.addEventListener("click", nextPage);
  els.prevPost?.addEventListener("click", () => selectPost(state.postIndex - 1));
  els.nextPost?.addEventListener("click", () => selectPost(state.postIndex + 1));
  els.fontDown?.addEventListener("click", () => {
    state.fontSize -= 1;
    updateReaderFont();
  });
  els.fontUp?.addEventListener("click", () => {
    state.fontSize += 1;
    updateReaderFont();
  });
  els.progress?.addEventListener("input", (event) => {
    state.pageIndex = Math.min(Math.max(Number(event.target.value) - 1, 0), state.pageCount - 1);
    updatePagination();
  });
  window.addEventListener("resize", () => schedulePagination(false));
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      nextPage();
    }
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      prevPage();
    }
  });
}

async function init() {
  bindEvents();
  updateReaderFont();
  const session = await window.blogSession?.ready;
  const id = getSessionId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }
  state.session = session;
  state.id = id;
  syncIdentity();
  setMessage("글과 폴더를 불러오는 중입니다.");

  try {
    await loadTreeAndPosts(session);
    renderFolders();
    if (state.folders.length > 0) {
      selectFolder(state.activeFolderId || state.folders[0].id);
      setMessage("");
    } else {
      renderProgress();
      setMessage("글이 들어 있는 폴더를 만든 뒤 다시 열어주세요.");
    }
  } catch (error) {
    setMessage(error.message || "책 뷰어를 불러오지 못했습니다.");
  }
}

document.fonts?.ready?.then(() => schedulePagination(false));
init();
