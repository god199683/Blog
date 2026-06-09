const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_NODE_ID = "all";
const BLOG_PAGE_SIZE_OPTIONS = Object.freeze([5, 10, 20, 30, 40, 50]);
const BLOG_DEFAULT_PAGE_SIZE = 5;
const BLOG_PENDING_FOCUS_KEY = "blog.pendingPostFocus";
const BLOG_PARAMS = new URLSearchParams(window.location.search);
const PUBLIC_BLOG_ID = String(BLOG_PARAMS.get("user") || "").trim();
const INITIAL_BLOG_NODE_ID = String(BLOG_PARAMS.get("node") || ALL_NODE_ID).trim() || ALL_NODE_ID;
const INITIAL_BLOG_POST_ID = String(BLOG_PARAMS.get("post") || readPendingPostFocus()).trim();

function readPendingPostFocus() {
  try {
    const raw = window.sessionStorage?.getItem(BLOG_PENDING_FOCUS_KEY) || "";
    if (!raw) return "";
    const payload = JSON.parse(raw);
    const isFresh = Date.now() - Number(payload?.at || 0) < 5 * 60 * 1000;
    return isFresh ? String(payload?.postId || "").trim() : "";
  } catch {
    return "";
  }
}

function clearPendingPostFocus() {
  try {
    window.sessionStorage?.removeItem(BLOG_PENDING_FOCUS_KEY);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

const state = {
  session: null,
  id: "",
  publicMode: Boolean(PUBLIC_BLOG_ID),
  posts: [],
  tree: [],
  trashItems: [],
  activeNodeId: INITIAL_BLOG_NODE_ID,
  selectionMode: false,
  selectedNodeIds: new Set(),
  collapsedNodeIds: new Set(),
  titleSortDirection: "asc",
  featurePostId: INITIAL_BLOG_POST_ID,
  pendingFocusPostId: INITIAL_BLOG_POST_ID,
  currentScopePosts: [],
  currentScopeTitle: "전체보기",
  listPage: 1,
  miniPage: 1,
  listPageSize: BLOG_DEFAULT_PAGE_SIZE,
  miniPageSize: BLOG_DEFAULT_PAGE_SIZE,
  postSelectionMode: false,
  selectedPostIds: new Set(),
  postBulkBusy: false,
  importLocationOptions: [],
  pendingImportLocationKey: "",
};

document.body.classList.toggle("is-public-blog-view", state.publicMode);

const els = {
  title: document.querySelector("[data-blog-title]"),
  brandTitle: document.querySelector("[data-brand-title]"),
  owner: document.querySelector("[data-blog-owner]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
  profileTitle: document.querySelector("[data-profile-title]"),
  profileId: document.querySelector("[data-profile-id]"),
  count: document.querySelector("[data-blog-count]"),
  postList: document.querySelector("[data-post-list]"),
  boardTitle: document.querySelector("[data-board-title]"),
  tree: document.querySelector("[data-blog-tree]"),
  all: document.querySelector("[data-tree-all]"),
  toolsToggle: document.querySelector("[data-tree-tools-toggle]"),
  tools: document.querySelector("[data-tree-tools]"),
  importInput: document.querySelector("[data-file-import]"),
  searchForm: document.querySelector("[data-blog-search-form]"),
  searchInput: document.querySelector("[data-blog-search-input]"),
  visitorTotalPosts: document.querySelector("[data-visitor-total-posts]"),
  visitorVisiblePosts: document.querySelector("[data-visitor-visible-posts]"),
  featureCard: document.querySelector("[data-feature-card]"),
  miniList: document.querySelector("[data-blog-mini-list]"),
  scrollTop: document.querySelector("[data-scroll-top]"),
  scrollBottom: document.querySelector("[data-scroll-bottom]"),
  titleSort: document.querySelector("[data-title-sort]"),
  latestSort: document.querySelector("[data-latest-sort]"),
  postSelectMode: document.querySelector("[data-post-select-mode]"),
  postSelectAll: document.querySelector("[data-post-select-all]"),
  postVisibilityToggle: document.querySelector("[data-post-visibility-toggle]"),
  postDeleteSelected: document.querySelector("[data-post-delete-selected]"),
  postMoveSelected: document.querySelector("[data-post-move-selected]"),
  writeButton: document.querySelector(".blog-write-button"),
  importLocationDialog: document.querySelector("[data-import-location-dialog]"),
  importLocationTitle: document.querySelector("[data-import-location-title]"),
  importLocationOptions: document.querySelector("[data-import-location-options]"),
  importLocationConfirm: document.querySelector("[data-import-location-confirm]"),
  importLocationCancel: document.querySelector("[data-import-location-cancel]"),
  importLocationClose: document.querySelector("[data-import-location-close]"),
};

let importLocationResolver = null;
const listToggle = document.querySelector("[data-list-toggle]");
const blogBoard = document.querySelector("[data-blog-board]");
const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
const blogLayout = document.querySelector(".blog-body-layout");
const sidePanel = document.querySelector(".blog-side-panel");

function isPostListOpen() {
  return Boolean(blogBoard && !blogBoard.classList.contains("is-list-collapsed"));
}

function syncPostBoardToolbar() {
  const isOpen = isPostListOpen();
  if (listToggle) {
    listToggle.textContent = isOpen ? "목록닫기" : "목록열기";
    listToggle.setAttribute("aria-expanded", String(isOpen));
  }

  [els.postSelectMode, els.postSelectAll, els.postVisibilityToggle, els.postDeleteSelected, els.postMoveSelected].forEach((button) => {
    if (button) button.hidden = !isOpen;
  });
}

function getCurrentBlogReturnHref({ postId = "" } = {}) {
  const params = new URLSearchParams();
  if (state.publicMode && state.id) {
    params.set("user", state.id);
  }
  if (state.activeNodeId && state.activeNodeId !== ALL_NODE_ID) {
    params.set("node", state.activeNodeId);
  }
  if (postId) {
    params.set("post", postId);
  }
  const query = params.toString();
  return `./my-blog.html${query ? `?${query}` : ""}`;
}

function getWriteEditorHref() {
  const params = new URLSearchParams();
  params.set("mode", "new");
  if (state.activeNodeId && state.activeNodeId !== ALL_NODE_ID) {
    params.set("node", state.activeNodeId);
  }
  params.set("return", getCurrentBlogReturnHref());
  return `./editor.html?${params.toString()}`;
}

function syncWriteButtonHref() {
  if (!els.writeButton || state.publicMode) return;
  els.writeButton.href = getWriteEditorHref();
}

function setPostListOpen(isOpen) {
  if (!blogBoard) return;
  blogBoard.classList.toggle("is-list-collapsed", !isOpen);
  if (!isOpen && state.postSelectionMode) {
    state.postSelectionMode = false;
    state.selectedPostIds.clear();
  }
  syncPostBoardToolbar();
  syncPostBulkButtons();
}

function setSidebarCollapsed(isCollapsed) {
  if (!blogLayout || !sidePanel || !sidebarToggle) return;
  blogLayout.classList.toggle("is-sidebar-collapsed", isCollapsed);
  sidePanel.classList.toggle("is-sidebar-collapsed", isCollapsed);
  sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
  sidebarToggle.setAttribute("aria-label", isCollapsed ? "사이드바 펼치기" : "사이드바 접기");
}

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

async function getFreshBlogSession() {
  const fresh = await window.blogSession?.refresh?.();
  if (fresh?.access_token) {
    state.session = fresh;
    return fresh;
  }
  return state.session;
}

function renderBlog(id, profile = null) {
  const title = profile?.blog_title || `${id}'s Blog`;
  if (els.title) els.title.textContent = title;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.profileTitle) els.profileTitle.textContent = title;
  if (els.profileId) els.profileId.textContent = `@${id}`;
  if (els.owner) {
    els.owner.textContent = state.publicMode ? `${id} 계정의 공개 블로그입니다.` : `${id} 계정의 개인 블로그입니다.`;
  }
  els.initials.forEach((initial) => {
    initial.textContent = id.slice(0, 1).toUpperCase();
  });
  document.title = `${title} | 블로그 홈`;
}

function setOwnerControlsVisible(visible) {
  const toolsPanel = document.querySelector("[data-tree-tools]");
  if (!visible && toolsPanel) toolsPanel.hidden = true;
  [
    els.writeButton,
    document.querySelector("[data-owner-only-link]"),
    document.querySelector(".blog-profile-tool"),
    document.querySelector("[data-file-import]"),
    document.querySelector(".blog-trash-link"),
  ]
    .filter(Boolean)
    .forEach((item) => {
      item.hidden = !visible;
    });

  if (visible) {
    syncPostBoardToolbar();
  } else {
    [els.postSelectMode, els.postSelectAll, els.postVisibilityToggle, els.postDeleteSelected, els.postMoveSelected].forEach((button) => {
      if (button) button.hidden = true;
    });
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeFileName(value = "blog") {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "blog";
}

function getFileExtension(name = "") {
  return String(name).split(".").pop().toLowerCase();
}

function getFileStem(name = "") {
  return String(name).replace(/\.[^.]+$/, "").trim() || "불러온 글";
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

function getPathLabel(path = []) {
  return path
    .map((node) => node?.label || "")
    .filter(Boolean)
    .join(" / ");
}

function getTreeCategoryLabel(category = "") {
  const value = String(category || "").trim();
  if (!value || value === "전체") return "전체";

  const categoryNode = state.tree.find(
    (node) => node.type === "category" && (node.filterCategory === value || node.label === value)
  );
  return categoryNode?.label || value;
}

function findPostFolderNode(post = {}) {
  if (post.folder_id) {
    return findNode(state.tree, post.folder_id);
  }

  const folderName = String(post.folder_name || post.folder || "").trim();
  if (!folderName) return null;

  function walk(nodes = [], path = [], category = "") {
    for (const node of nodes) {
      const nextCategory = node.type === "category" ? node.filterCategory || node.label : category;
      const nextPath = [...path, node];
      const categoryMatches = !post.category || post.category === "전체" || post.category === nextCategory;

      if (node.type === "folder" && node.label === folderName && categoryMatches) {
        return { node, parent: path[path.length - 1] || null, path: nextPath };
      }

      const found = walk(node.children || [], nextPath, nextCategory);
      if (found) return found;
    }
    return null;
  }

  return walk(state.tree);
}

function getPostLocationLabel(post = {}) {
  const folderNode = findPostFolderNode(post);
  if (folderNode) return getPathLabel(folderNode.path);

  if (post.folder_path) return post.folder_path;

  const categoryLabel = getTreeCategoryLabel(post.category);
  const folderName = post.folder_name || post.folder || "";
  if (folderName) return categoryLabel && categoryLabel !== "전체" ? `${categoryLabel} / ${folderName}` : folderName;

  return categoryLabel || "전체";
}

function normalizeSearchValue(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\\/|·>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTokens(keyword = "") {
  return normalizeSearchValue(keyword).split(" ").filter(Boolean);
}

function getPostSearchText(post = {}) {
  return normalizeSearchValue(
    [
      post.title,
      post.excerpt,
      htmlToPlainText(post.body || ""),
      getPostLocationLabel(post),
      post.category,
      post.folder_name,
      post.folder_path,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function postMatchesSearch(post = {}, tokens = []) {
  if (tokens.length === 0) return true;
  const searchText = getPostSearchText(post);
  return tokens.every((token) => searchText.includes(token));
}

function getPostViewHref(post = {}) {
  const params = new URLSearchParams();
  params.set("id", post.id || "");
  if (state.publicMode && state.id) {
    params.set("from", "public-blog");
    params.set("user", state.id);
  } else {
    params.set("from", "my-blog");
  }
  if (state.activeNodeId && state.activeNodeId !== ALL_NODE_ID) {
    params.set("node", state.activeNodeId);
  }
  params.set("return", getCurrentBlogReturnHref({ postId: post.id || "" }));
  return `./viewer.html?${params.toString()}`;
}

function getPostId(post = {}) {
  return String(post.id || "");
}

function getPostEditHref(post = {}) {
  const params = new URLSearchParams();
  params.set("post", post.id || "");
  if (state.activeNodeId && state.activeNodeId !== ALL_NODE_ID) {
    params.set("node", state.activeNodeId);
  }
  params.set("return", getCurrentBlogReturnHref({ postId: post.id || "" }));
  return `./editor.html?${params.toString()}`;
}

function getFirstImageFromHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html);
  const image = template.content.querySelector("img[src]");
  const source = image?.getAttribute("src") || "";
  if (!source || source.trim().toLowerCase().startsWith("javascript:")) return "";
  return source;
}

function getPostExcerpt(post = {}, limit = 120) {
  const text = htmlToPlainText(post.body || "");
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function getPostMediaSource(post = {}) {
  return post.cover_image || getFirstImageFromHtml(post.body || "");
}

function getPostSortTime(post = {}) {
  const time = Date.parse(post.published_at || post.created_at || "");
  return Number.isFinite(time) ? time : 0;
}

function getTitleSortedPosts(posts = []) {
  if (state.titleSortDirection !== "asc" && state.titleSortDirection !== "desc") {
    return posts
      .map((post, index) => ({ post, index }))
      .sort((a, b) => {
        const timeDiff = getPostSortTime(b.post) - getPostSortTime(a.post);
        return timeDiff || a.index - b.index;
      })
      .map((item) => item.post);
  }

  const direction = state.titleSortDirection === "desc" ? -1 : 1;
  return posts
    .map((post, index) => ({ post, index }))
    .sort((a, b) => {
      const left = a.post.title || "제목 없는 글";
      const right = b.post.title || "제목 없는 글";
      const titleDiff = left.localeCompare(right, "ko", {
        numeric: true,
        sensitivity: "base",
      });
      return titleDiff ? titleDiff * direction : a.index - b.index;
    })
    .map((item) => item.post);
}

function normalizeBlogPageSize(value) {
  const size = Number(value);
  return BLOG_PAGE_SIZE_OPTIONS.includes(size) ? size : BLOG_DEFAULT_PAGE_SIZE;
}

function renderBlogPageSizeOptions(selectedSize) {
  const currentSize = normalizeBlogPageSize(selectedSize);
  return BLOG_PAGE_SIZE_OPTIONS.map(
    (size) => `<option value="${size}" ${size === currentSize ? "selected" : ""}>${size}개</option>`
  ).join("");
}

function clampPage(page, totalItems, pageSize = BLOG_DEFAULT_PAGE_SIZE) {
  const size = normalizeBlogPageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  return Math.min(Math.max(Number(page) || 1, 1), totalPages);
}

function getPagedPosts(posts = [], page, pageSize = BLOG_DEFAULT_PAGE_SIZE) {
  const size = normalizeBlogPageSize(pageSize);
  const currentPage = clampPage(page, posts.length, size);
  const start = (currentPage - 1) * size;
  return {
    page: currentPage,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(posts.length / size)),
    posts: posts.slice(start, start + size),
  };
}

function resetPostPages() {
  state.listPage = 1;
  state.miniPage = 1;
}

function getCurrentSortedScopePosts() {
  return getTitleSortedPosts(state.currentScopePosts);
}

function syncPagesToPost(postId) {
  const targetId = String(postId || "");
  if (!targetId) return;
  const index = getCurrentSortedScopePosts().findIndex((post) => getPostId(post) === targetId);
  if (index < 0) return;
  state.listPage = Math.floor(index / normalizeBlogPageSize(state.listPageSize)) + 1;
  state.miniPage = Math.floor(index / normalizeBlogPageSize(state.miniPageSize)) + 1;
}

function getCurrentPagePosts() {
  return getPagedPosts(getCurrentSortedScopePosts(), state.listPage, state.listPageSize).posts;
}

function getTitleSortLabel() {
  return state.titleSortDirection === "asc" ? "제목 내림차순 정렬" : "제목 오름차순 정렬";
}

function getLatestSortLabel() {
  return state.titleSortDirection === "none" ? "최신글 정렬 적용됨" : "최신글 정렬";
}

function syncTitleSortButton() {
  const direction = state.titleSortDirection || "none";
  const label = getTitleSortLabel();
  [els.titleSort, ...document.querySelectorAll("[data-mini-title-sort]")]
    .filter(Boolean)
    .forEach((button) => {
      button.dataset.sortDirection = direction;
      button.setAttribute("aria-label", label);
      button.title = label;
    });
  const latestLabel = getLatestSortLabel();
  [els.latestSort, ...document.querySelectorAll("[data-mini-latest-sort]")]
    .filter(Boolean)
    .forEach((button) => {
      button.classList.toggle("is-active", direction === "none");
      button.setAttribute("aria-label", latestLabel);
      button.title = latestLabel;
    });
}

function toggleTitleSort() {
  state.titleSortDirection = state.titleSortDirection === "asc" ? "desc" : "asc";
  if (els.searchInput?.value.trim()) {
    applyBlogSearch(els.searchInput.value);
  } else {
    renderActivePosts();
  }
}

function setLatestSort() {
  state.titleSortDirection = "none";
  if (els.searchInput?.value.trim()) {
    applyBlogSearch(els.searchInput.value);
  } else {
    renderActivePosts();
  }
}

function belongsToUser(post, session, id) {
  return (
    post.user_id === session?.user?.id ||
    String(post.login_id || "").toLowerCase() === id.toLowerCase() ||
    String(post.author || "").toLowerCase() === id.toLowerCase()
  );
}

function createNode(type, label) {
  const id = `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    type,
    label,
    filterCategory: type === "category" ? label : "",
    children: [],
  };
}

function cloneNode(node) {
  return {
    id: node.id,
    type: node.type === "category" ? "category" : "folder",
    label: node.label || (node.type === "category" ? "카테고리" : "폴더"),
    filterCategory: node.type === "category" ? node.filterCategory || node.label || "카테고리" : "",
    children: Array.isArray(node.children) ? node.children.map(cloneNode) : [],
  };
}

function createTrashId(prefix = "trash") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTrashPost(post = {}) {
  return {
    id: post.id || "",
    title: post.title || "제목 없는 글",
    category: post.category || "전체",
    folder: post.folder || "",
    folder_id: post.folder_id || "",
    folder_name: post.folder_name || "",
    folder_path: post.folder_path || "",
    user_id: post.user_id || "",
    login_id: post.login_id || "",
    body: post.body || "",
    cover_image: post.cover_image || "",
    author: post.author || "",
    reading_time: post.reading_time || "",
    published: post.published !== false,
    published_at: post.published_at || post.created_at || "",
    created_at: post.created_at || "",
  };
}

function normalizeTrashItem(item = {}) {
  return {
    id: item.id || createTrashId(),
    kind: item.kind === "post" ? "post" : "node",
    label: item.label || item.node?.label || item.posts?.[0]?.title || "삭제된 항목",
    deletedAt: item.deletedAt || new Date().toISOString(),
    node: item.node ? cloneNode(item.node) : null,
    posts: Array.isArray(item.posts) ? item.posts.map(normalizeTrashPost) : [],
  };
}

function normalizeTrashItems(items = []) {
  return Array.isArray(items) ? items.map(normalizeTrashItem) : [];
}

function getTrashPostIdSet(items = state.trashItems) {
  const ids = new Set();
  items.forEach((item) => {
    (item.posts || []).forEach((post) => {
      if (post.id) ids.add(String(post.id));
    });
  });
  return ids;
}

function filterPostsOutsideTrash(posts = []) {
  const trashPostIds = getTrashPostIdSet();
  return posts.filter((post) => !trashPostIds.has(String(post.id)));
}

function normalizeTree(tree) {
  return Array.isArray(tree)
    ? tree
        .filter((node) => node && node.id !== ALL_NODE_ID)
        .map(cloneNode)
    : [];
}

function findNode(nodes, id, parent = null, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];
    if (node.id === id) return { node, parent, path: nextPath };
    const found = findNode(node.children || [], id, node, nextPath);
    if (found) return found;
  }
  return null;
}

function findParentCategory(path = []) {
  return [...path].reverse().find((node) => node.type === "category") || null;
}

function normalizeActiveNodeId() {
  if (state.activeNodeId === ALL_NODE_ID) return;
  if (!findNode(state.tree, state.activeNodeId)) {
    state.activeNodeId = ALL_NODE_ID;
  }
}

function getActiveTreeMeta() {
  if (state.activeNodeId === ALL_NODE_ID) {
    return { title: "전체보기", posts: state.posts, folders: [] };
  }

  const found = findNode(state.tree, state.activeNodeId);
  if (!found) return { title: "전체보기", posts: state.posts, folders: [] };
  const folders = (found.node.children || []).filter((node) => node.type === "folder");

  if (found.node.type === "category") {
    const category = found.node.filterCategory || found.node.label;
    const childFolderIds = new Set();
    folders.forEach((folder) => collectNodeFolderIds(folder, childFolderIds));
    return {
      title: found.node.label,
      folders,
      posts: state.posts.filter(
        (post) => (post.category || "전체") === category && (!post.folder_id || !childFolderIds.has(post.folder_id))
      ),
    };
  }

  return {
    title: found.node.label,
    folders,
    posts: state.posts.filter((post) => post.folder_id === found.node.id),
  };
}

function findCategoryNodeForPost(post = {}) {
  const category = String(post.category || "전체");

  function walk(nodes = []) {
    for (const node of nodes) {
      if (node.type === "category" && String(node.filterCategory || node.label || "전체") === category) {
        return node;
      }
      const found = walk(node.children || []);
      if (found) return found;
    }
    return null;
  }

  return walk(state.tree);
}

function resolvePostScopeNodeId(post = {}) {
  if (post.folder_id && findNode(state.tree, post.folder_id)) {
    return post.folder_id;
  }

  const folderMatch = findPostFolderNode(post);
  if (folderMatch?.node?.id) return folderMatch.node.id;

  const categoryNode = findCategoryNodeForPost(post);
  if (categoryNode?.id) return categoryNode.id;

  return ALL_NODE_ID;
}

function focusPendingPostFromUrl() {
  const targetId = String(state.pendingFocusPostId || "").trim();
  if (!targetId || state.posts.length === 0) return false;

  const post = state.posts.find((item) => getPostId(item) === targetId);
  if (!post) {
    state.pendingFocusPostId = "";
    clearPendingPostFocus();
    return false;
  }

  const activeMeta = getActiveTreeMeta();
  const alreadyVisible = activeMeta.posts?.some((item) => getPostId(item) === targetId);
  if (!alreadyVisible) {
    state.activeNodeId = resolvePostScopeNodeId(post);
    normalizeActiveNodeId();
    renderTree();
  }

  state.featurePostId = targetId;
  state.pendingFocusPostId = "";
  clearPendingPostFocus();
  syncWriteButtonHref();
  return true;
}

function promptName(message, fallback = "") {
  const value = window.prompt(message, fallback);
  return value ? value.trim().slice(0, 40) : "";
}

function updateCategoryDescendants(node) {
  if (node.type !== "category") return;
  node.filterCategory = node.label;
}

function collectSelectedIds() {
  return new Set(
    [...document.querySelectorAll("[data-tree-check]:checked")].map((input) => input.dataset.treeCheck)
  );
}

function removeSelectedNodes(nodes, selectedIds) {
  return nodes
    .filter((node) => !selectedIds.has(node.id))
    .map((node) => ({
      ...node,
      children: removeSelectedNodes(node.children || [], selectedIds),
    }));
}

function getTopLevelSelectedNodes(nodes, selectedIds, ancestorSelected = false) {
  return nodes.flatMap((node) => {
    const isSelected = selectedIds.has(node.id);
    const children = getTopLevelSelectedNodes(node.children || [], selectedIds, ancestorSelected || isSelected);
    return isSelected && !ancestorSelected ? [node] : children;
  });
}

function collectNodeFolderIds(node, ids = new Set()) {
  if (node.type === "folder") ids.add(node.id);
  (node.children || []).forEach((child) => collectNodeFolderIds(child, ids));
  return ids;
}

function getPostsForNode(node) {
  const folderIds = collectNodeFolderIds(node);
  return state.posts.filter((post) => {
    if (folderIds.has(post.folder_id)) return true;
    if (node.type !== "category") return false;
    const category = node.filterCategory || node.label || "전체";
    return (post.category || "전체") === category;
  });
}

function buildTrashItemsForNodes(nodes = []) {
  const usedPostIds = new Set();
  return nodes.map((node) => {
    const posts = getPostsForNode(node).filter((post) => {
      const key = String(post.id || "");
      if (!key || usedPostIds.has(key)) return false;
      usedPostIds.add(key);
      return true;
    });

    return {
      id: createTrashId(node.type),
      kind: "node",
      label: node.label || "삭제된 항목",
      deletedAt: new Date().toISOString(),
      node: cloneNode(node),
      posts: posts.map(normalizeTrashPost),
    };
  });
}

function buildTrashItemForPost(post = {}) {
  return {
    id: createTrashId("post"),
    kind: "post",
    label: post.title || "삭제된 글",
    deletedAt: new Date().toISOString(),
    node: null,
    posts: [normalizeTrashPost(post)],
  };
}

async function movePostToTrash(postId) {
  const post = state.posts.find((item) => String(item.id) === String(postId));
  if (!post) return;
  if (!window.confirm("선택한 글을 휴지통으로 이동할까요?")) return;

  state.trashItems = [buildTrashItemForPost(post), ...state.trashItems];
  state.posts = state.posts.filter((item) => String(item.id) !== String(postId));
  await saveTree();
  if (els.searchInput?.value.trim()) {
    applyBlogSearch(els.searchInput.value);
  } else {
    renderActivePosts();
  }
}

function clearPostSelection() {
  state.selectedPostIds.clear();
  syncPostBulkButtons();
}

function syncPostBulkButtons() {
  if (els.postSelectMode) {
    els.postSelectMode.classList.toggle("is-active", state.postSelectionMode);
    els.postSelectMode.setAttribute("aria-pressed", String(state.postSelectionMode));
  }

  const hasPostsOnPage = getCurrentPagePosts().length > 0;
  const hasSelectedPosts = state.selectedPostIds.size > 0;

  if (els.postSelectAll) {
    els.postSelectAll.disabled = !state.postSelectionMode || !hasPostsOnPage || state.postBulkBusy;
    const pageIds = getCurrentPagePosts().map(getPostId).filter(Boolean);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => state.selectedPostIds.has(id));
    const label = allSelected ? "현재 페이지 선택 해제" : "현재 페이지 전체 선택";
    els.postSelectAll.title = label;
    els.postSelectAll.setAttribute("aria-label", label);
  }
  if (els.postVisibilityToggle) {
    els.postVisibilityToggle.disabled = !state.postSelectionMode || !hasSelectedPosts || state.postBulkBusy;
    const selectedPosts = state.posts.filter((post) => state.selectedPostIds.has(getPostId(post)));
    const label = selectedPosts.some((post) => post.published === false) ? "선택 글 공개로 변경" : "선택 글 비공개로 변경";
    els.postVisibilityToggle.title = label;
    els.postVisibilityToggle.setAttribute("aria-label", label);
  }
  if (els.postDeleteSelected) {
    els.postDeleteSelected.disabled = !state.postSelectionMode || !hasSelectedPosts || state.postBulkBusy;
  }
  if (els.postMoveSelected) {
    els.postMoveSelected.disabled = !state.postSelectionMode || !hasSelectedPosts || state.postBulkBusy;
  }
}

function togglePostSelection(postId, forceValue = null) {
  const key = String(postId || "");
  if (!key) return;

  const shouldSelect = forceValue === null ? !state.selectedPostIds.has(key) : Boolean(forceValue);
  if (shouldSelect) {
    state.selectedPostIds.add(key);
  } else {
    state.selectedPostIds.delete(key);
  }
  if (!renderCurrentFolderAndPostRowsIfNeeded()) renderPosts(state.currentScopePosts);
}

function toggleCurrentPagePostSelection() {
  if (!state.postSelectionMode) return;
  const pageIds = getCurrentPagePosts().map(getPostId).filter(Boolean);
  if (pageIds.length === 0) return;

  const shouldSelectAll = pageIds.some((id) => !state.selectedPostIds.has(id));
  pageIds.forEach((id) => {
    if (shouldSelectAll) {
      state.selectedPostIds.add(id);
    } else {
      state.selectedPostIds.delete(id);
    }
  });
  if (!renderCurrentFolderAndPostRowsIfNeeded()) renderPosts(state.currentScopePosts);
}

async function updatePostVisibility(postId, published) {
  return requestRest(`posts?id=eq.${encodeURIComponent(postId)}`, state.session.access_token, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({ published }),
  });
}

async function toggleSelectedPostsVisibility() {
  if (!state.postSelectionMode || state.selectedPostIds.size === 0) return;
  if (!state.session?.access_token) {
    window.alert("로그인이 필요합니다.");
    return;
  }

  const selectedIds = [...state.selectedPostIds];
  const selectedPosts = state.posts.filter((post) => selectedIds.includes(getPostId(post)));
  if (selectedPosts.length === 0) return;

  const nextPublished = selectedPosts.some((post) => post.published === false);
  state.postBulkBusy = true;
  syncPostBulkButtons();

  try {
    await Promise.all(selectedPosts.map((post) => updatePostVisibility(getPostId(post), nextPublished)));
    state.posts = state.posts.map((post) =>
      selectedIds.includes(getPostId(post)) ? { ...post, published: nextPublished } : post
    );
    clearPostSelection();
    renderActivePosts();
  } catch (error) {
    window.alert(error.message || "공개 상태를 변경하지 못했습니다.");
  } finally {
    state.postBulkBusy = false;
    syncPostBulkButtons();
  }
}

async function moveSelectedPostsToTrash() {
  if (!state.postSelectionMode || state.selectedPostIds.size === 0) return;
  const selectedIds = [...state.selectedPostIds];
  const selectedPosts = state.posts.filter((post) => selectedIds.includes(getPostId(post)));
  if (selectedPosts.length === 0) return;
  if (!window.confirm("선택한 글을 휴지통으로 이동할까요?")) return;

  state.postBulkBusy = true;
  syncPostBulkButtons();

  try {
    state.trashItems = [...selectedPosts.map(buildTrashItemForPost), ...state.trashItems];
    state.posts = state.posts.filter((post) => !selectedIds.includes(getPostId(post)));
    state.selectedPostIds.clear();
    state.postSelectionMode = false;
    await saveTree();
    if (els.searchInput?.value.trim()) {
      applyBlogSearch(els.searchInput.value);
    } else {
      renderActivePosts();
    }
  } catch (error) {
    window.alert(error.message || "선택한 글을 삭제하지 못했습니다.");
  } finally {
    state.postBulkBusy = false;
    syncPostBulkButtons();
  }
}

function buildPostLocationPatch(location) {
  return {
    category: location?.category || "전체",
    folder: location?.folder?.label || null,
    folder_id: location?.folder?.id || null,
    folder_name: location?.folder?.label || null,
    folder_path: location?.folder?.path || null,
  };
}

async function moveSelectedPostsToLocation() {
  if (!state.postSelectionMode || state.selectedPostIds.size === 0) return;
  const selectedIds = [...state.selectedPostIds];
  const selectedPosts = state.posts.filter((post) => selectedIds.includes(getPostId(post)));
  if (selectedPosts.length === 0) return;

  const location = await openImportLocationDialog({
    title: "이동할 위치 선택",
    confirmLabel: "선택 후 이동",
  });
  if (!location) return;

  const session = await getFreshBlogSession();
  if (!session?.access_token) {
    window.alert("로그인이 필요합니다.");
    return;
  }

  const patch = buildPostLocationPatch(location);
  state.postBulkBusy = true;
  syncPostBulkButtons();

  try {
    await Promise.all(
      selectedIds.map((id) =>
        requestRest(`posts?id=eq.${encodeURIComponent(id)}`, session.access_token, {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(patch),
        })
      )
    );
    state.posts = state.posts.map((post) => (selectedIds.includes(getPostId(post)) ? { ...post, ...patch } : post));
    state.selectedPostIds.clear();
    state.postSelectionMode = false;
    renderActivePosts();
  } catch (error) {
    window.alert(error.message || "선택한 글을 이동하지 못했습니다.");
  } finally {
    state.postBulkBusy = false;
    syncPostBulkButtons();
  }
}

function syncTreeSelectionState() {
  syncWriteButtonHref();
  if (els.all) {
    if (state.activeNodeId === ALL_NODE_ID) {
      els.all.setAttribute("aria-current", "page");
    } else {
      els.all.removeAttribute("aria-current");
    }
  }
  els.tree?.querySelectorAll("[data-tree-node]").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.treeNode === state.activeNodeId);
  });
}

function renderTreeNode(node, depth = 0) {
  const hasChildren = (node.children || []).length > 0;
  const isCollapsed = state.collapsedNodeIds.has(node.id);
  const isChecked = state.selectedNodeIds.has(node.id);
  const children = hasChildren && !isCollapsed ? node.children.map((child) => renderTreeNode(child, depth + 1)).join("") : "";
  const rowClasses = [
    "blog-tree-row",
    state.selectionMode ? "has-check" : "",
    hasChildren ? "has-children" : "",
    isCollapsed ? "is-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <li>
      <div class="${rowClasses}" data-tree-node="${escapeHtml(node.id)}" style="--tree-depth:${depth}">
        ${
          state.selectionMode
            ? `<input class="blog-tree-check" type="checkbox" data-tree-check="${escapeHtml(node.id)}" ${isChecked ? "checked" : ""} aria-label="${escapeHtml(node.label)} 선택">`
            : ""
        }
        <button class="blog-tree-expander" type="button" data-tree-toggle="${escapeHtml(node.id)}" ${hasChildren ? `aria-expanded="${isCollapsed ? "false" : "true"}"` : "disabled"} aria-label="${escapeHtml(node.label)} 접기 펼치기">
          <span aria-hidden="true">${hasChildren ? (isCollapsed ? "+" : "-") : ""}</span>
        </button>
        <button class="blog-tree-label" type="button" data-tree-select="${escapeHtml(node.id)}">
          <span>${escapeHtml(node.label)}</span>
        </button>
        <span class="blog-tree-node-actions">
          <button type="button" data-tree-rename="${escapeHtml(node.id)}" title="이름 수정" aria-label="이름 수정">
            <span class="tree-action-icon tree-action-edit" aria-hidden="true"></span>
          </button>
          <button type="button" data-tree-add-folder="${escapeHtml(node.id)}" title="폴더 추가" aria-label="폴더 추가">
            <span class="tree-action-icon tree-action-folder" aria-hidden="true"></span>
          </button>
        </span>
      </div>
      ${children ? `<ul>${children}</ul>` : ""}
    </li>
  `;
}

function renderTree() {
  if (!els.tree) return;

  if (state.tree.length === 0) {
    els.tree.innerHTML = `<p class="blog-tree-empty">카테고리를 추가해주세요.</p>`;
    return;
  }

  els.tree.innerHTML = `<ul>${state.tree.map((node) => renderTreeNode(node)).join("")}</ul>`;
  syncTreeSelectionState();
}

function renderFeatureArea(posts = [], scopeTitle = "전체보기") {
  const visiblePosts = getTitleSortedPosts(posts);
  const selectedPost =
    visiblePosts.find((post) => getPostId(post) === state.featurePostId) || visiblePosts[0] || null;

  state.currentScopePosts = posts;
  state.currentScopeTitle = scopeTitle;
  state.featurePostId = selectedPost ? getPostId(selectedPost) : state.pendingFocusPostId || state.featurePostId || "";
  if (selectedPost) {
    syncPagesToPost(getPostId(selectedPost));
  }

  renderMiniList(visiblePosts, scopeTitle);
  if (!els.featureCard) return;

  if (!selectedPost) {
    els.featureCard.hidden = true;
    els.featureCard.innerHTML = "";
    els.featureCard.removeAttribute("data-feature-post-id");
    els.featureCard.removeAttribute("role");
    els.featureCard.removeAttribute("tabindex");
    els.featureCard.removeAttribute("aria-label");
    return;
  }

  const post = selectedPost;
  const title = post.title || "제목 없는 글";
  const location = getPostLocationLabel(post);
  const date = formatDate(post.published_at || post.created_at);
  const viewHref = getPostViewHref(post);
  const editHref = getPostEditHref(post);
  const mediaSource = getPostMediaSource(post);
  const excerpt = getPostExcerpt(post, 110);
  const initial = (state.id || "B").slice(0, 1).toUpperCase();
  const ownerLightActions = state.publicMode
    ? ""
    : `
      <a class="blog-feature-light-button" href="${editHref}">수정</a>
      <button class="blog-feature-light-button" type="button" data-feature-delete="${escapeHtml(post.id || "")}">삭제</button>
    `;
  const ownerTextActions = state.publicMode
    ? ""
    : `
      <a class="blog-feature-text-action" href="${editHref}">수정</a>
      <button class="blog-feature-text-action" type="button" data-feature-delete="${escapeHtml(post.id || "")}">삭제</button>
    `;

  els.featureCard.hidden = false;
  els.featureCard.dataset.featurePostId = getPostId(post);
  els.featureCard.setAttribute("role", "link");
  els.featureCard.setAttribute("tabindex", "0");
  els.featureCard.setAttribute("aria-label", `${title} 글 보기`);
  els.featureCard.innerHTML = `
    <div class="blog-feature-kicker">${escapeHtml(location)}</div>
    <a class="blog-feature-title" href="${viewHref}">${escapeHtml(title)}</a>
    <div class="blog-feature-meta">
      <span class="blog-feature-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <span class="blog-feature-author">${escapeHtml(state.id || post.author || "blog")}</span>
      <time datetime="${escapeHtml(post.published_at || post.created_at || "")}">${escapeHtml(date)}</time>
      <span>${escapeHtml(location)}</span>
      <a class="blog-feature-light-button" href="${editHref}">수정</a>
      <button class="blog-feature-light-button" type="button" data-feature-delete="${escapeHtml(post.id || "")}">삭제</button>
    </div>
    <a class="blog-feature-media" href="${viewHref}">
      ${
        mediaSource
          ? `<img src="${escapeHtml(mediaSource)}" alt="">`
          : `<span class="blog-feature-placeholder"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(excerpt || "본문 미리보기가 여기에 표시됩니다.")}</small></span>`
      }
    </a>
    <a class="blog-feature-caption" href="${viewHref}">${escapeHtml(title)}</a>
    <div class="blog-feature-actions" aria-label="글 기능">
      <a class="blog-feature-icon-action" href="${viewHref}" title="읽기" aria-label="읽기">
        <span class="feature-icon feature-icon-book" aria-hidden="true"></span>
      </a>
      <a class="blog-feature-text-action" href="${editHref}">수정</a>
      <button class="blog-feature-text-action" type="button" data-feature-delete="${escapeHtml(post.id || "")}">삭제</button>
    </div>
  `;
}

function renderMiniList(posts = [], scopeTitle = "전체보기") {
  if (!els.miniList) return;
  if (posts.length === 0) {
    els.miniList.hidden = true;
    els.miniList.innerHTML = "";
    return;
  }

  const title = scopeTitle === "전체보기" ? "전체 카테고리" : scopeTitle;
  const sortLabel = getTitleSortLabel();
  const pageMeta = getPagedPosts(posts, state.miniPage, state.miniPageSize);
  state.miniPage = pageMeta.page;
  els.miniList.hidden = false;
  els.miniList.innerHTML = `
    <div class="blog-mini-list-head">
      <strong>이 블로그 ${escapeHtml(title)} 글</strong>
      <span class="blog-mini-sort-actions">
        <button class="blog-title-sort blog-mini-title-sort blog-latest-sort ${state.titleSortDirection === "none" ? "is-active" : ""}" type="button" data-mini-latest-sort aria-label="최신글 정렬" title="최신글 정렬">
          <span class="board-action-icon board-action-latest" aria-hidden="true"></span>
        </button>
        <button class="blog-title-sort blog-mini-title-sort" type="button" data-mini-title-sort data-sort-direction="${escapeHtml(state.titleSortDirection || "none")}" aria-label="${escapeHtml(sortLabel)}" title="${escapeHtml(sortLabel)}">
          <span class="blog-title-sort-icon" aria-hidden="true"></span>
        </button>
      </span>
    </div>
    <div class="blog-mini-rows">
      ${pageMeta.posts
        .map(
          (post) => {
            const postId = getPostId(post);
            const isSelected = postId && postId === state.featurePostId;
            return `
            <button class="blog-mini-row ${isSelected ? "is-selected" : ""}" type="button" data-mini-post="${escapeHtml(postId)}" aria-pressed="${isSelected ? "true" : "false"}">
              <span>${escapeHtml(post.title || "제목 없는 글")}</span>
              <time>${escapeHtml(formatDate(post.published_at || post.created_at))}</time>
            </button>
          `;
          }
        )
        .join("")}
    </div>
    <div class="blog-mini-footer">
      <button type="button" data-mini-page="prev" ${pageMeta.page <= 1 ? "disabled" : ""}>이전</button>
      <span class="blog-page-state">${pageMeta.page} / ${pageMeta.totalPages}</span>
      <button type="button" data-mini-page="next" ${pageMeta.page >= pageMeta.totalPages ? "disabled" : ""}>다음</button>
      <label class="blog-page-size-control">
        <span class="sr-only">표시 개수</span>
        <select data-mini-page-size aria-label="표시 개수">
          ${renderBlogPageSizeOptions(state.miniPageSize)}
        </select>
      </label>
      <a href="#top">TOP</a>
    </div>
  `;
}

function renderActivePosts() {
  resetPostPages();
  clearPostSelection();
  const meta = getActiveTreeMeta();
  if (state.activeNodeId !== ALL_NODE_ID) {
    setPostListOpen(true);
  }
  syncWriteButtonHref();
  if (els.boardTitle) els.boardTitle.textContent = meta.title;
  if (meta.folders?.length > 0) {
    renderFolderRows(meta.folders, meta.title, meta.posts);
    return;
  }
  renderFeatureArea(meta.posts, meta.title);
  renderPosts(meta.posts);
}

function applyBlogSearch(keyword = "") {
  const trimmedKeyword = keyword.trim();
  const tokens = getSearchTokens(trimmedKeyword);
  if (tokens.length === 0) {
    renderActivePosts();
    return;
  }

  const results = state.posts.filter((post) => postMatchesSearch(post, tokens));
  resetPostPages();
  clearPostSelection();
  setPostListOpen(true);
  if (els.boardTitle) els.boardTitle.textContent = `검색: ${trimmedKeyword}`;
  renderFeatureArea(results, `검색 ${trimmedKeyword}`);
  renderPosts(results);
}

async function loadTree(session) {
  if (!session?.access_token || !session.user?.id) return [];
  const rows = await requestRest(
    `blog_trees?select=tree,tree_collapsed_ids,trash&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  state.collapsedNodeIds = new Set(Array.isArray(row?.tree_collapsed_ids) ? row.tree_collapsed_ids : []);
  state.trashItems = normalizeTrashItems(row?.trash);
  return normalizeTree(row?.tree);
}

async function saveTree() {
  if (!state.session?.access_token || !state.session.user?.id) return;

  await requestRest("blog_trees?on_conflict=user_id", state.session.access_token, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: state.session.user.id,
      login_id: state.id,
      tree: state.tree,
      tree_collapsed_ids: [...state.collapsedNodeIds],
      trash: state.trashItems,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function addCategory() {
  const label = promptName("추가할 카테고리 이름을 입력해주세요.", "새 카테고리");
  if (!label) return;

  const node = createNode("category", label);
  state.tree.push(node);
  state.activeNodeId = node.id;
  await saveTree();
  renderTree();
  renderActivePosts();
}

async function addFolder(parentId) {
  const found = findNode(state.tree, parentId);
  if (!found) return;

  const label = promptName("추가할 폴더 이름을 입력해주세요.", "새 폴더");
  if (!label) return;

  found.node.children = Array.isArray(found.node.children) ? found.node.children : [];
  const folder = createNode("folder", label);
  found.node.children.push(folder);
  state.collapsedNodeIds.delete(found.node.id);
  state.activeNodeId = folder.id;
  await saveTree();
  renderTree();
  renderActivePosts();
}

async function renameNode(nodeId) {
  const found = findNode(state.tree, nodeId);
  if (!found) return;

  const row = els.tree?.querySelector(`[data-tree-node="${CSS.escape(nodeId)}"]`);
  const labelButton = row?.querySelector("[data-tree-select]");
  if (!row || !labelButton) return;

  const input = document.createElement("input");
  input.className = "blog-tree-rename-input";
  input.value = found.node.label;
  labelButton.replaceWith(input);
  input.focus();
  input.select();

  let isDone = false;
  async function finishRename(shouldSave) {
    if (isDone) return;
    isDone = true;
    const next = input.value.trim().slice(0, 40);
    if (shouldSave && next) {
      found.node.label = next;
      updateCategoryDescendants(found.node);
      await saveTree();
    }
    renderTree();
    renderActivePosts();
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finishRename(true);
    if (event.key === "Escape") finishRename(false);
  });
  input.addEventListener("blur", () => finishRename(true), { once: true });
}

async function deleteSelectedNodes() {
  state.selectedNodeIds = collectSelectedIds();
  if (state.selectedNodeIds.size === 0) {
    state.selectionMode = true;
    renderTree();
    window.alert("삭제할 카테고리나 폴더를 선택해주세요.");
    return;
  }

  if (!window.confirm("선택한 항목을 휴지통으로 이동할까요?")) return;

  const selectedNodes = getTopLevelSelectedNodes(state.tree, state.selectedNodeIds);
  const trashItems = buildTrashItemsForNodes(selectedNodes);
  state.tree = removeSelectedNodes(state.tree, state.selectedNodeIds);
  state.trashItems = [...trashItems, ...state.trashItems];
  state.posts = filterPostsOutsideTrash(state.posts);
  if (state.activeNodeId !== ALL_NODE_ID && !findNode(state.tree, state.activeNodeId)) {
    state.activeNodeId = ALL_NODE_ID;
  }
  state.selectedNodeIds.clear();
  state.selectionMode = false;
  await saveTree();
  renderTree();
  renderActivePosts();
}

function cleanImportedHtml(html = "") {
  const parsed = new DOMParser().parseFromString(String(html), "text/html");
  const template = document.createElement("template");
  template.innerHTML = parsed.body?.innerHTML || String(html);
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => {
    node.remove();
  });
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML.trim();
}

function textToHtml(text = "") {
  const normalized = String(text).replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function stripRtfToText(text = "") {
  return String(text)
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\[a-z]+\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html);
  template.content.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  template.content.querySelectorAll("p, div, h1, h2, h3, h4, li, tr").forEach((node) => {
    node.append(document.createTextNode("\n"));
  });
  return (template.content.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function getReadingTimeLabel(text = "") {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 350));
  return `${minutes}분 읽기`;
}

function getActiveLocationMeta() {
  const fallback = {
    category: "전체",
    folder: null,
  };
  if (state.activeNodeId === ALL_NODE_ID) return fallback;

  const found = findNode(state.tree, state.activeNodeId);
  if (!found) return fallback;

  if (found.node.type === "category") {
    return {
      category: found.node.filterCategory || found.node.label || "전체",
      folder: null,
    };
  }

  const categoryNode = findParentCategory(found.path);
  return {
    category: categoryNode?.filterCategory || categoryNode?.label || "전체",
    folder: {
      id: found.node.id,
      label: found.node.label,
      path: found.path.map((node) => node.label).filter(Boolean).join(" / "),
    },
  };
}

function collectImportLocationOptions() {
  const options = [
    {
      key: "all",
      type: "all",
      typeLabel: "전체",
      label: "전체",
      path: "전체",
      category: "전체",
      folder: null,
    },
  ];

  function walk(nodes = [], path = [], category = "") {
    nodes.forEach((node) => {
      if (node.id === ALL_NODE_ID) {
        walk(node.children || [], path, category);
        return;
      }

      const isCategory = node.type === "category";
      const nextCategory = isCategory ? node.filterCategory || node.label || "전체" : category;
      const nextPath = [...path, node.label || (isCategory ? "카테고리" : "폴더")];

      if (isCategory) {
        options.push({
          key: `category:${node.id}`,
          type: "category",
          typeLabel: "카테고리",
          label: node.label || "카테고리",
          path: nextPath.join(" / "),
          category: nextCategory,
          folder: null,
        });
      } else if (node.type === "folder") {
        options.push({
          key: `folder:${node.id}`,
          type: "folder",
          typeLabel: "폴더",
          label: node.label || "폴더",
          path: nextPath.join(" / "),
          category: nextCategory || "전체",
          folder: {
            id: node.id,
            label: node.label || "폴더",
            path: nextPath.join(" / "),
          },
        });
      }

      walk(node.children || [], nextPath, nextCategory);
    });
  }

  walk(state.tree);
  return options;
}

function getImportLocationKeyFromActiveNode() {
  if (state.activeNodeId === ALL_NODE_ID) return "all";
  const found = findNode(state.tree, state.activeNodeId);
  if (!found) return "all";
  return `${found.node.type === "category" ? "category" : "folder"}:${found.node.id}`;
}

function getImportLocationCategoryKey(option, options = state.importLocationOptions) {
  if (!option || option.type === "all") return "all";
  if (option.type === "category") return option.key;
  const categoryOption = options.find(
    (item) => item.type === "category" && item.category === option.category
  );
  return categoryOption?.key || "all";
}

function getActiveImportLocationCategoryKey(options = state.importLocationOptions) {
  const pending = options.find((option) => option.key === state.pendingImportLocationKey);
  return getImportLocationCategoryKey(pending, options);
}

function renderImportLocationOptions(selectedKey = "all") {
  if (!els.importLocationOptions) return;

  state.importLocationOptions = collectImportLocationOptions();
  state.pendingImportLocationKey = state.importLocationOptions.some((option) => option.key === selectedKey)
    ? selectedKey
    : "all";

  const activeCategoryKey = getActiveImportLocationCategoryKey();
  const categories = state.importLocationOptions.filter((option) => option.type === "all" || option.type === "category");
  const selectedCategory = state.importLocationOptions.find((option) => option.key === activeCategoryKey);
  const folders = state.importLocationOptions.filter(
    (option) =>
      option.type === "folder" &&
      activeCategoryKey !== "all" &&
      getImportLocationCategoryKey(option) === activeCategoryKey
  );

  const categorySaveOption =
    selectedCategory?.type === "category"
      ? `
        <button
          class="editor-location-option editor-location-folder-save${
            selectedCategory.key === state.pendingImportLocationKey ? " is-selected" : ""
          }"
          type="button"
          data-import-location-key="${escapeHtml(selectedCategory.key)}"
          aria-pressed="${selectedCategory.key === state.pendingImportLocationKey}"
        >
          <span>폴더 없음</span>
          <strong>${escapeHtml(selectedCategory.label)}</strong>
          <small>선택한 카테고리에 바로 저장</small>
        </button>
      `
      : "";

  const folderOptions = folders
    .map(
      (option) => `
        <button
          class="editor-location-option${option.key === state.pendingImportLocationKey ? " is-selected" : ""}"
          type="button"
          data-import-location-key="${escapeHtml(option.key)}"
          aria-pressed="${option.key === state.pendingImportLocationKey}"
        >
          <span>${escapeHtml(option.typeLabel)}</span>
          <strong>${escapeHtml(option.label)}</strong>
          <small>${escapeHtml(option.path)}</small>
        </button>
      `
    )
    .join("");

  els.importLocationOptions.innerHTML = `
    <section class="editor-location-column" aria-label="카테고리">
      <h3>카테고리</h3>
      <div class="editor-location-column-list">
        ${categories
          .map(
            (option) => `
              <button
                class="editor-location-option editor-location-category${
                  option.key === activeCategoryKey ? " is-active-category" : ""
                }${option.key === state.pendingImportLocationKey ? " is-selected" : ""}"
                type="button"
                data-import-location-key="${escapeHtml(option.key)}"
                aria-pressed="${option.key === state.pendingImportLocationKey}"
              >
                <span>${escapeHtml(option.typeLabel)}</span>
                <strong>${escapeHtml(option.label)}</strong>
                <small>${escapeHtml(option.path)}</small>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="editor-location-column" aria-label="폴더">
      <h3>폴더</h3>
      <div class="editor-location-column-list">
        ${
          [categorySaveOption, folderOptions].join("") ||
          `<p class="editor-location-empty">${
            activeCategoryKey === "all" ? "카테고리를 선택하면 폴더가 보입니다." : "폴더가 없습니다."
          }</p>`
        }
      </div>
    </section>
  `;

  if (els.importLocationConfirm) {
    els.importLocationConfirm.disabled = !state.pendingImportLocationKey;
  }
}

function getPendingImportLocation() {
  const option = state.importLocationOptions.find((item) => item.key === state.pendingImportLocationKey);
  if (!option || option.type === "all") return { category: "전체", folder: null };
  return {
    category: option.category || "전체",
    folder: option.folder || null,
  };
}

function closeImportLocationDialog(result = null) {
  if (els.importLocationDialog) els.importLocationDialog.hidden = true;
  if (importLocationResolver) {
    importLocationResolver(result);
    importLocationResolver = null;
  }
}

function openImportLocationDialog({
  title = "불러올 위치 선택",
  confirmLabel = "선택 후 불러오기",
} = {}) {
  if (!els.importLocationDialog || !els.importLocationOptions) {
    return Promise.resolve(getActiveLocationMeta());
  }

  renderImportLocationOptions(getImportLocationKeyFromActiveNode());
  if (els.importLocationTitle) els.importLocationTitle.textContent = title;
  if (els.importLocationConfirm) els.importLocationConfirm.textContent = confirmLabel;
  els.importLocationDialog.hidden = false;

  return new Promise((resolve) => {
    importLocationResolver = resolve;
    window.setTimeout(() => {
      els.importLocationOptions.querySelector(".is-selected")?.focus();
    }, 0);
  });
}

async function readFileAsHtml(file) {
  const extension = getFileExtension(file.name);

  if (extension === "docx") {
    if (!window.mammoth?.convertToHtml) {
      throw new Error("DOCX 불러오기 도구를 불러오지 못했습니다.");
    }
    const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return cleanImportedHtml(result.value);
  }

  const text = await file.text();
  if (extension === "html" || extension === "htm") return cleanImportedHtml(text);
  if (extension === "rtf") return textToHtml(stripRtfToText(text));
  return textToHtml(text);
}

async function insertImportedPost(payload) {
  const rows = await requestRest("posts", state.session.access_token, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function createImportedPostFromFile(file, location) {
  const body = await readFileAsHtml(file);
  const plainText = htmlToPlainText(body);
  if (!plainText) {
    throw new Error("내용이 비어 있습니다.");
  }

  return {
    title: getFileStem(file.name).slice(0, 120),
    body,
    category: location.category,
    author: state.id,
    login_id: state.id,
    user_id: state.session.user?.id,
    reading_time: getReadingTimeLabel(plainText),
    published: true,
    published_at: new Date().toISOString(),
    folder: location.folder?.label || null,
    folder_id: location.folder?.id || null,
    folder_name: location.folder?.label || null,
    folder_path: location.folder?.path || null,
  };
}

async function importFiles(files = []) {
  const fileList = [...files].filter(Boolean);
  if (fileList.length === 0) return;
  if (!state.session?.access_token) {
    window.alert("로그인이 필요합니다.");
    return;
  }

  const location = await openImportLocationDialog();
  if (!location) return;
  const errors = [];
  let importedCount = 0;

  for (const file of fileList) {
    try {
      const payload = await createImportedPostFromFile(file, location);
      await insertImportedPost(payload);
      importedCount += 1;
    } catch (error) {
      errors.push(`${file.name}: ${error.message || "불러오지 못했습니다."}`);
    }
  }

  try {
    state.posts = await fetchUserPosts(state.session, state.id);
  } catch {}
  renderActivePosts();

  if (errors.length > 0) {
    window.alert(`${importedCount}개의 파일을 불러왔습니다.\n\n${errors.join("\n")}`);
    return;
  }
  window.alert(`${importedCount}개의 파일을 불러왔습니다.`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getExportPosts() {
  return getActiveTreeMeta().posts;
}

function buildExportBaseName(posts, format) {
  const title = els.boardTitle?.textContent || "블로그";
  const suffix = posts.length === 1 ? posts[0].title || title : title;
  return `${sanitizeFileName(`${state.id || "blog"}-${suffix}`)}.${format}`;
}

function exportPostsAsText(posts) {
  const text = posts
    .map((post) =>
      [
        post.title || "제목 없는 글",
        getPostLocationLabel(post),
        formatDate(post.published_at || post.created_at),
        "",
        htmlToPlainText(post.body || ""),
      ].join("\n")
    )
    .join("\n\n---\n\n");
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), buildExportBaseName(posts, "txt"));
}

function exportPostsAsDocx(posts) {
  const docx = window.htmlDocx || window.htmlDocxJs;
  if (!docx?.asBlob) {
    window.alert("DOCX 내보내기 도구를 불러오지 못했습니다. TXT로 다시 내보내주세요.");
    return;
  }

  const body = posts
    .map(
      (post) => `
        <article>
          <h1>${escapeHtml(post.title || "제목 없는 글")}</h1>
          <p>${escapeHtml(getPostLocationLabel(post))} · ${escapeHtml(formatDate(post.published_at || post.created_at))}</p>
          ${cleanImportedHtml(post.body || "")}
        </article>
      `
    )
    .join("<hr>");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { color: #22364a; font-family: "Malgun Gothic", Arial, sans-serif; font-size: 11pt; line-height: 1.65; }
          h1 { color: #0f3f61; font-size: 18pt; margin: 0 0 12pt; }
          p { margin: 0 0 10pt; }
          hr { border: 0; border-top: 1px solid #cfe1f0; margin: 20pt 0; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `;
  downloadBlob(docx.asBlob(html), buildExportBaseName(posts, "docx"));
}

function exportActivePosts() {
  const posts = getExportPosts();
  if (posts.length === 0) {
    window.alert("내보낼 글이 없습니다.");
    return;
  }

  const format = window.prompt("내보낼 형식을 입력해주세요. txt 또는 docx", "txt")?.trim().toLowerCase();
  if (!format) return;
  if (format === "txt") {
    exportPostsAsText(posts);
    return;
  }
  if (format === "docx") {
    exportPostsAsDocx(posts);
    return;
  }
  window.alert("txt 또는 docx 형식만 입력해주세요.");
}

function renderPosts(posts = []) {
  const visiblePosts = getTitleSortedPosts(posts);
  const pageMeta = getPagedPosts(visiblePosts, state.listPage, state.listPageSize);
  state.listPage = pageMeta.page;
  syncTitleSortButton();
  if (els.count) els.count.textContent = `${posts.length}개의 글`;
  if (els.visitorTotalPosts) els.visitorTotalPosts.textContent = String(state.posts.length);
  if (els.visitorVisiblePosts) els.visitorVisiblePosts.textContent = String(posts.length);
  if (!els.postList) return;

  if (visiblePosts.length === 0) {
    els.postList.innerHTML = `
      <div class="blog-empty-row">
        <span>아직 작성된 글이 없습니다.</span>
        <span>0</span>
        <span>-</span>
        <span aria-hidden="true"></span>
      </div>
    `;
    syncPostBulkButtons();
    return;
  }

  els.postList.innerHTML =
    pageMeta.posts
    .map((post) => {
      const visibility = post.published === false ? "비공개" : "공개";
      const postId = getPostId(post);
      const isSelected = postId && postId === state.featurePostId;
      const isPostSelected = postId && state.selectedPostIds.has(postId);
      return `
        <div class="blog-post-row ${isSelected ? "is-selected" : ""} ${isPostSelected ? "is-post-selected" : ""}" data-post-row="${escapeHtml(postId)}" role="button" tabindex="0" aria-pressed="${state.postSelectionMode ? String(isPostSelected) : String(isSelected)}">
          <span class="blog-post-title-cell">
            ${
              state.postSelectionMode
                ? `<input class="blog-post-check" type="checkbox" data-post-check="${escapeHtml(postId)}" ${isPostSelected ? "checked" : ""} aria-label="${escapeHtml(post.title || "제목 없는 글")} 선택">`
                : ""
            }
            <span class="blog-post-title">
              ${escapeHtml(post.title || "제목 없는 글")}
            </span>
            <small>${escapeHtml(getPostLocationLabel(post))} · ${visibility}</small>
          </span>
          <span>0</span>
          <span>${formatDate(post.published_at || post.created_at)}</span>
          <span aria-hidden="true"></span>
        </div>
      `;
    })
    .join("") +
    `
      <div class="blog-list-footer">
        <button type="button" data-post-page="prev" ${pageMeta.page <= 1 ? "disabled" : ""}>이전</button>
        <span class="blog-page-state">${pageMeta.page} / ${pageMeta.totalPages}</span>
        <button type="button" data-post-page="next" ${pageMeta.page >= pageMeta.totalPages ? "disabled" : ""}>다음</button>
        <label class="blog-page-size-control">
          <span class="sr-only">표시 개수</span>
          <select data-post-page-size aria-label="표시 개수">
            ${renderBlogPageSizeOptions(state.listPageSize)}
          </select>
        </label>
      </div>
    `;
  syncPostBulkButtons();
}

function renderFolderRows(folders = [], scopeTitle = "", posts = []) {
  setPostListOpen(true);
  const visiblePosts = getTitleSortedPosts(posts);
  state.currentScopePosts = posts;
  state.currentScopeTitle = scopeTitle;
  syncTitleSortButton();
  if (els.count) {
    els.count.textContent = `${folders.length}개의 폴더${posts.length ? ` · ${posts.length}개의 글` : ""}`;
  }
  if (els.visitorTotalPosts) els.visitorTotalPosts.textContent = String(state.posts.length);
  if (els.visitorVisiblePosts) els.visitorVisiblePosts.textContent = String(posts.length);

  if (posts.length > 0) {
    renderFeatureArea(posts, scopeTitle);
  } else if (els.featureCard) {
    state.featurePostId = state.pendingFocusPostId || state.featurePostId || "";
    els.featureCard.hidden = true;
    els.featureCard.innerHTML = "";
    els.featureCard.removeAttribute("data-feature-post-id");
    els.featureCard.removeAttribute("role");
    els.featureCard.removeAttribute("tabindex");
    els.featureCard.removeAttribute("aria-label");
    if (els.miniList) {
      els.miniList.hidden = true;
      els.miniList.innerHTML = "";
    }
  }
  if (!els.postList) return;

  const pageMeta = getPagedPosts(visiblePosts, state.listPage, state.listPageSize);
  state.listPage = pageMeta.page;

  if (folders.length === 0 && visiblePosts.length === 0) {
    els.postList.innerHTML = `
      <div class="blog-empty-row">
        <span>표시할 폴더나 글이 없습니다.</span>
        <span>0</span>
        <span>-</span>
        <span aria-hidden="true"></span>
      </div>
    `;
    syncPostBulkButtons();
    return;
  }

  const folderRows = folders
    .map((folder) => {
      const postCount = getPostsForNode(folder).length;
      const hasChildFolders = (folder.children || []).some((child) => child.type === "folder");
      return `
        <div class="blog-post-row blog-folder-row" data-folder-row="${escapeHtml(folder.id)}" role="button" tabindex="0" aria-label="${escapeHtml(folder.label)} 폴더로 이동">
          <span class="blog-post-title-cell">
            <span class="blog-post-title">${escapeHtml(folder.label || "폴더")}</span>
            <small>${hasChildFolders ? "하위 폴더 있음" : `${postCount}개의 글`}</small>
          </span>
          <span>${postCount}</span>
          <span>폴더</span>
          <span aria-hidden="true"></span>
        </div>
      `;
    })
    .join("");

  const postRows = pageMeta.posts
    .map((post) => {
      const visibility = post.published === false ? "비공개" : "공개";
      const postId = getPostId(post);
      const isSelected = postId && postId === state.featurePostId;
      const isPostSelected = postId && state.selectedPostIds.has(postId);
      return `
        <div class="blog-post-row ${isSelected ? "is-selected" : ""} ${isPostSelected ? "is-post-selected" : ""}" data-post-row="${escapeHtml(postId)}" role="button" tabindex="0" aria-pressed="${state.postSelectionMode ? String(isPostSelected) : String(isSelected)}">
          <span class="blog-post-title-cell">
            ${
              state.postSelectionMode
                ? `<input class="blog-post-check" type="checkbox" data-post-check="${escapeHtml(postId)}" ${isPostSelected ? "checked" : ""} aria-label="${escapeHtml(post.title || "제목 없는 글")} 선택">`
                : ""
            }
            <span class="blog-post-title">
              ${escapeHtml(post.title || "제목 없는 글")}
            </span>
            <small>${escapeHtml(getPostLocationLabel(post))} · ${visibility}</small>
          </span>
          <span>0</span>
          <span>${formatDate(post.published_at || post.created_at)}</span>
          <span aria-hidden="true"></span>
        </div>
      `;
    })
    .join("");

  const footer =
    visiblePosts.length > 0
      ? `
      <div class="blog-list-footer">
        <button type="button" data-post-page="prev" ${pageMeta.page <= 1 ? "disabled" : ""}>이전</button>
        <span class="blog-page-state">${pageMeta.page} / ${pageMeta.totalPages}</span>
        <button type="button" data-post-page="next" ${pageMeta.page >= pageMeta.totalPages ? "disabled" : ""}>다음</button>
        <label class="blog-page-size-control">
          <span class="sr-only">표시 개수</span>
          <select data-post-page-size aria-label="표시 개수">
            ${renderBlogPageSizeOptions(state.listPageSize)}
          </select>
        </label>
      </div>
    `
      : "";

  els.postList.innerHTML = `${folderRows}${postRows}${footer}`;
  syncPostBulkButtons();
}

async function fetchUserPosts(session, id) {
  const rows = await requestRest(
    "posts?select=id,title,body,category,folder,folder_id,folder_name,folder_path,cover_image,reading_time,author,login_id,user_id,published,published_at,created_at&order=published_at.desc&limit=100",
    session.access_token
  );
  const posts = Array.isArray(rows) ? rows.filter((post) => belongsToUser(post, session, id)) : [];
  return filterPostsOutsideTrash(posts);
}

async function fetchPublicBlogPosts(id) {
  const rows = await requestRest(
    `posts?select=id,title,body,category,folder,folder_id,folder_name,folder_path,cover_image,reading_time,author,login_id,user_id,published,published_at,created_at&login_id=eq.${encodeURIComponent(id)}&published=eq.true&order=published_at.desc.nullslast,created_at.desc.nullslast&limit=100`,
    SUPABASE_ANON_KEY
  );
  return Array.isArray(rows) ? rows : [];
}

if (listToggle && blogBoard) {
  syncPostBoardToolbar();

  listToggle.addEventListener("click", () => {
    setPostListOpen(!isPostListOpen());
  });
}

function renderCurrentFolderAndPostRowsIfNeeded() {
  if (els.searchInput?.value.trim()) return false;
  const meta = getActiveTreeMeta();
  if (!meta.folders?.length) return false;
  if (els.boardTitle) els.boardTitle.textContent = meta.title;
  renderFolderRows(meta.folders, meta.title, meta.posts);
  return true;
}

function selectFeaturePost(postId) {
  if (!postId) return;
  const exists = state.currentScopePosts.some((post) => getPostId(post) === String(postId));
  if (!exists) return;

  state.featurePostId = String(postId);
  syncPagesToPost(postId);
  if (renderCurrentFolderAndPostRowsIfNeeded()) return;
  renderFeatureArea(state.currentScopePosts, state.currentScopeTitle);
  renderPosts(state.currentScopePosts);
}

function openFolderNode(folderId) {
  if (!folderId || !findNode(state.tree, folderId)) return;
  state.activeNodeId = folderId;
  if (els.searchInput) els.searchInput.value = "";
  renderActivePosts();
  syncTreeSelectionState();
}

function openFeaturePost() {
  if (!state.featurePostId) return;
  window.location.href = getPostViewHref({ id: state.featurePostId });
}

els.featureCard?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-feature-delete]");
  if (deleteButton) {
    event.preventDefault();
    await movePostToTrash(deleteButton.dataset.featureDelete);
    return;
  }

  if (event.target.closest("a, button")) return;
  openFeaturePost();
});

els.featureCard?.addEventListener("keydown", (event) => {
  if (event.target.closest("a, button")) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openFeaturePost();
});

els.postList?.addEventListener("click", (event) => {
  const folderRow = event.target.closest("[data-folder-row]");
  if (folderRow) {
    event.preventDefault();
    openFolderNode(folderRow.dataset.folderRow);
    return;
  }

  const pageButton = event.target.closest("[data-post-page]");
  if (pageButton) {
    event.preventDefault();
    state.listPage += pageButton.dataset.postPage === "next" ? 1 : -1;
    if (!renderCurrentFolderAndPostRowsIfNeeded()) renderPosts(state.currentScopePosts);
    return;
  }

  const checkbox = event.target.closest("[data-post-check]");
  if (checkbox) {
    event.stopPropagation();
    togglePostSelection(checkbox.dataset.postCheck, checkbox.checked);
    return;
  }

  const row = event.target.closest("[data-post-row]");
  if (!row) return;
  event.preventDefault();
  if (state.postSelectionMode) {
    togglePostSelection(row.dataset.postRow);
    return;
  }
  selectFeaturePost(row.dataset.postRow);
});

els.postList?.addEventListener("change", (event) => {
  const sizeSelect = event.target.closest("[data-post-page-size]");
  if (!sizeSelect) return;
  state.listPageSize = normalizeBlogPageSize(sizeSelect.value);
  state.listPage = 1;
  if (!renderCurrentFolderAndPostRowsIfNeeded()) renderPosts(state.currentScopePosts);
});

els.postList?.addEventListener("keydown", (event) => {
  const folderRow = event.target.closest("[data-folder-row]");
  if (folderRow && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openFolderNode(folderRow.dataset.folderRow);
    return;
  }

  const row = event.target.closest("[data-post-row]");
  if (!row || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  if (state.postSelectionMode) {
    togglePostSelection(row.dataset.postRow);
    return;
  }
  selectFeaturePost(row.dataset.postRow);
});

els.miniList?.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-mini-page]");
  if (pageButton) {
    event.preventDefault();
    state.miniPage += pageButton.dataset.miniPage === "next" ? 1 : -1;
    renderMiniList(getCurrentSortedScopePosts(), state.currentScopeTitle);
    return;
  }

  const sortButton = event.target.closest("[data-mini-title-sort]");
  if (sortButton) {
    event.preventDefault();
    toggleTitleSort();
    return;
  }

  const latestButton = event.target.closest("[data-mini-latest-sort]");
  if (latestButton) {
    event.preventDefault();
    setLatestSort();
    return;
  }

  const row = event.target.closest("[data-mini-post]");
  if (row) {
    event.preventDefault();
    selectFeaturePost(row.dataset.miniPost);
    return;
  }
});

els.miniList?.addEventListener("change", (event) => {
  const sizeSelect = event.target.closest("[data-mini-page-size]");
  if (!sizeSelect) return;
  state.miniPageSize = normalizeBlogPageSize(sizeSelect.value);
  state.miniPage = 1;
  renderMiniList(getCurrentSortedScopePosts(), state.currentScopeTitle);
});

els.scrollTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.scrollBottom?.addEventListener("click", () => {
  const bottom = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );
  window.scrollTo({ top: bottom, behavior: "smooth" });
});

els.titleSort?.addEventListener("click", () => {
  toggleTitleSort();
});

els.latestSort?.addEventListener("click", () => {
  setLatestSort();
});

els.postSelectMode?.addEventListener("click", () => {
  state.postSelectionMode = !state.postSelectionMode;
  clearPostSelection();
  if (!renderCurrentFolderAndPostRowsIfNeeded()) renderPosts(state.currentScopePosts);
});

els.postSelectAll?.addEventListener("click", () => {
  toggleCurrentPagePostSelection();
});

els.postVisibilityToggle?.addEventListener("click", () => {
  toggleSelectedPostsVisibility();
});

els.postDeleteSelected?.addEventListener("click", () => {
  moveSelectedPostsToTrash();
});

els.postMoveSelected?.addEventListener("click", () => {
  moveSelectedPostsToLocation();
});

sidebarToggle?.addEventListener("click", () => {
  const isCollapsed = sidePanel?.classList.contains("is-sidebar-collapsed") || false;
  setSidebarCollapsed(!isCollapsed);
});

els.toolsToggle?.addEventListener("click", () => {
  const willOpen = els.tools?.hidden;
  if (els.tools) els.tools.hidden = !willOpen;
  els.toolsToggle.setAttribute("aria-expanded", String(Boolean(willOpen)));
});

els.tools?.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-tree-action]")?.dataset.treeAction;
  if (!action) return;

  if (action === "add-category") {
    await addCategory();
    return;
  }

  if (action === "toggle-selection") {
    state.selectionMode = !state.selectionMode;
    state.selectedNodeIds.clear();
    event.target.closest("[data-tree-action]")?.classList.toggle("is-active", state.selectionMode);
    renderTree();
    return;
  }

  if (action === "delete-selected") {
    await deleteSelectedNodes();
    els.tools.querySelector('[data-tree-action="toggle-selection"]')?.classList.toggle("is-active", state.selectionMode);
    return;
  }

  if (action === "import-files") {
    els.importInput?.click();
    return;
  }

  if (action === "export-files") {
    exportActivePosts();
  }
});

els.importInput?.addEventListener("change", async (event) => {
  const files = event.target.files ? [...event.target.files] : [];
  event.target.value = "";
  await importFiles(files);
});

els.importLocationOptions?.addEventListener("click", (event) => {
  const optionButton = event.target.closest("[data-import-location-key]");
  if (!optionButton) return;

  state.pendingImportLocationKey = optionButton.dataset.importLocationKey;
  renderImportLocationOptions(state.pendingImportLocationKey);
  if (els.importLocationConfirm) els.importLocationConfirm.disabled = false;
});

els.importLocationConfirm?.addEventListener("click", () => {
  closeImportLocationDialog(getPendingImportLocation());
});

els.importLocationCancel?.addEventListener("click", () => closeImportLocationDialog(null));
els.importLocationClose?.addEventListener("click", () => closeImportLocationDialog(null));

els.importLocationDialog?.addEventListener("click", (event) => {
  if (event.target === els.importLocationDialog) {
    closeImportLocationDialog(null);
  }
});

els.all?.addEventListener("click", () => {
  state.activeNodeId = ALL_NODE_ID;
  if (els.searchInput) els.searchInput.value = "";
  renderActivePosts();
  syncTreeSelectionState();
});

els.searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  applyBlogSearch(els.searchInput?.value || "");
});

els.searchInput?.addEventListener("input", () => {
  const keyword = els.searchInput.value || "";
  if (!keyword.trim()) {
    renderActivePosts();
    return;
  }
  applyBlogSearch(keyword);
});

els.tree?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-tree-check]");
  if (!checkbox) return;
  state.selectedNodeIds = collectSelectedIds();
});

els.tree?.addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-tree-toggle]");
  if (toggle && !toggle.disabled) {
    const id = toggle.dataset.treeToggle;
    if (state.collapsedNodeIds.has(id)) {
      state.collapsedNodeIds.delete(id);
    } else {
      state.collapsedNodeIds.add(id);
    }
    await saveTree();
    renderTree();
    return;
  }

  const rename = event.target.closest("[data-tree-rename]");
  if (rename) {
    await renameNode(rename.dataset.treeRename);
    return;
  }

  const add = event.target.closest("[data-tree-add-folder]");
  if (add) {
    await addFolder(add.dataset.treeAddFolder);
    return;
  }

  const select = event.target.closest("[data-tree-select]");
  if (select) {
    state.activeNodeId = select.dataset.treeSelect;
    if (els.searchInput) els.searchInput.value = "";
    renderActivePosts();
    syncTreeSelectionState();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.importLocationDialog && !els.importLocationDialog.hidden) {
    closeImportLocationDialog(null);
  }
});

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
  if (state.publicMode) {
    state.session = session || null;
    state.id = PUBLIC_BLOG_ID;
    setOwnerControlsVisible(false);
    renderBlog(state.id);
    state.tree = [];
    renderTree();
    try {
      state.posts = await fetchPublicBlogPosts(state.id);
    } catch {
      state.posts = [];
    }
    focusPendingPostFromUrl();
    renderActivePosts();
    return;
  }

  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }

  setOwnerControlsVisible(true);
  state.session = session;
  state.id = id;
  renderBlog(id);
  renderTree();
  renderActivePosts();
  try {
    const profile = await ensureBlogProfile(session, id);
    renderBlog(id, profile);
  } catch {
    renderBlog(id);
  }

  try {
    state.tree = await loadTree(session);
  } catch {
    state.tree = [];
  }
  normalizeActiveNodeId();
  renderTree();

  try {
    state.posts = await fetchUserPosts(session, id);
  } catch {
    state.posts = [];
  }
  focusPendingPostFromUrl();
  renderActivePosts();
});
