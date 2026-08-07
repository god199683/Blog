const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const FONT_SIZE_KEY = "blog.ebookFontSize";
const BOOKMARK_KEY_PREFIX = "blog.ebookBookmark.";
const BOOKMARK_COOKIE_PREFIX = "blog_ebook_bookmark_";
const SIDEBAR_COLLAPSED_KEY = "blog.ebookSidebarCollapsed";
const OPACITY_KEY = "blog.ebookToolbarOpacity";
const SWIPE_MIN_DISTANCE = 48;
const SWIPE_DOMINANCE_RATIO = 1.25;

const state = {
  session: null,
  id: "",
  tree: [],
  posts: [],
  folders: [],
  activeFolderId: "",
  activePosts: [],
  postIndex: 0,
  pageIndex: 0,
  pageCount: 1,
  pageStep: 0,
  fontSize: clampFontSize(Number.parseInt(localStorage.getItem(FONT_SIZE_KEY) || "18", 10)),
  pendingLastPage: false,
  pendingPageIndex: null,
  bookmark: null,
  remoteBookmarkSupported: true,
  sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
  opacity: Math.min(100, Math.max(35, Number(localStorage.getItem(OPACITY_KEY)) || 100)),
};

let swipeState = null;

const els = {
  brandTitle: document.querySelector("[data-brand-title]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
  owner: document.querySelector("[data-ebook-owner]"),
  back: document.querySelector("[data-ebook-back]"),
  sidebarToggle: document.querySelector("[data-ebook-sidebar-toggle]"),
  folderOpen: document.querySelector("[data-ebook-folder-open]"),
  write: document.querySelector("[data-ebook-write]"),
  opacityControl: document.querySelector("[data-ebook-opacity-control]"),
  opacityToggle: document.querySelector("[data-ebook-opacity-toggle]"),
  opacityPopover: document.querySelector("[data-ebook-opacity-popover]"),
  opacityInput: document.querySelector("[data-ebook-opacity]"),
  opacityValue: document.querySelector("[data-ebook-opacity-value]"),
  folderDialog: document.querySelector("[data-ebook-folder-dialog]"),
  folderClose: document.querySelector("[data-ebook-folder-close]"),
  folderSelect: document.querySelector("[data-ebook-folder-select]"),
  folderList: document.querySelector("[data-ebook-folder-list]"),
  selectedFolder: document.querySelector("[data-ebook-selected-folder]"),
  selectedFolderName: document.querySelector("[data-ebook-selected-folder-name]"),
  selectedFolderPath: document.querySelector("[data-ebook-selected-folder-path]"),
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
  bookmark: document.querySelector("[data-ebook-bookmark]"),
  message: document.querySelector("[data-ebook-message]"),
};

function clampFontSize(value) {
  return Math.min(28, Math.max(12, Number(value) || 18));
}

function applyReaderOpacity(value = state.opacity) {
  state.opacity = Math.min(100, Math.max(35, Number(value) || 100));
  document.documentElement.style.setProperty("--ebook-toolbar-opacity", String(state.opacity / 100));
  if (els.opacityInput) els.opacityInput.value = String(state.opacity);
  if (els.opacityValue) els.opacityValue.value = `${state.opacity}%`;
  localStorage.setItem(OPACITY_KEY, String(state.opacity));
}

function setOpacityPopover(open) {
  if (!els.opacityPopover || !els.opacityToggle) return;
  els.opacityPopover.hidden = !open;
  els.opacityToggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("is-ebook-opacity-open", open);
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

function readerNodeHasVisibleContent(node) {
  if (!(node instanceof HTMLElement)) return false;
  const text = String(node.textContent || "").replace(/[\u00a0\u200b]/g, "").trim();
  return Boolean(text || node.querySelector("img, video, audio, table, canvas, svg, iframe, hr, pre, code"));
}

function markReaderEmptyBlock(node) {
  node.removeAttribute("style");
  node.removeAttribute("class");
  node.removeAttribute("width");
  node.removeAttribute("height");
  node.dataset.readerEmptyBlock = "true";
  node.innerHTML = "<br>";
}

function getReadableTextWithBreaks(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll("br").forEach((breakNode) => {
    breakNode.replaceWith("\n");
  });
  return String(clone.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function splitReadableText(text = "") {
  const normalized = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  const sentences =
    normalized.match(/[^.!?。！？…]+(?:[.!?。！？…]+(?:["'”’」』]+)?|$)/g) || [normalized];
  const parts = [];
  let chunk = "";

  sentences.forEach((sentence) => {
    const next = sentence.trim();
    if (!next) return;
    const candidate = chunk ? `${chunk} ${next}` : next;
    if (chunk && candidate.length > 180) {
      parts.push(chunk);
      chunk = next;
      return;
    }
    chunk = candidate;
  });

  if (chunk) parts.push(chunk);
  if (parts.length > 1 || normalized.length <= 220) return parts.length ? parts : [normalized];

  const fallbackParts = [];
  let fallbackChunk = "";
  normalized.split(/\s+/).forEach((word) => {
    if (!word) return;
    const candidate = fallbackChunk ? `${fallbackChunk} ${word}` : word;
    if (fallbackChunk && candidate.length > 180) {
      fallbackParts.push(fallbackChunk);
      fallbackChunk = word;
      return;
    }
    fallbackChunk = candidate;
  });
  if (fallbackChunk) fallbackParts.push(fallbackChunk);
  return fallbackParts.length > 1 ? fallbackParts : [normalized];
}

function normalizeEbookReadableBlocks(fragment) {
  fragment.querySelectorAll("p, div, blockquote").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (!readerNodeHasVisibleContent(node)) return;
    if (node.closest(".ebook-content-title")) return;
    if (node.querySelector("p, div, blockquote, ul, ol, table, img, video, audio, pre, code, hr")) return;

    const text = getReadableTextWithBreaks(node);
    if (text.length < 260 && !/\n/.test(text)) return;

    const parts = splitReadableText(text);
    if (parts.length <= 1) return;

    const tagName = node.tagName.toLowerCase() === "blockquote" ? "blockquote" : "p";
    const replacement = parts.map((part) => {
      const paragraph = document.createElement(tagName);
      paragraph.textContent = part;
      return paragraph;
    });
    node.replaceWith(...replacement);
  });
}

function normalizeReaderFragment(fragment) {
  fragment.querySelectorAll("*").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;

    const writingMode = node.style.getPropertyValue("writing-mode");
    if (/vertical|sideways/i.test(writingMode)) {
      node.style.removeProperty("writing-mode");
      node.style.removeProperty("text-orientation");
      node.style.removeProperty("transform");
    }

    if (!readerNodeHasVisibleContent(node)) {
      node.style.removeProperty("background");
      node.style.removeProperty("background-color");
      node.style.removeProperty("box-shadow");
      node.style.removeProperty("border");
    }
  });

  fragment.querySelectorAll("p, div, li, blockquote").forEach((node) => {
    if (node instanceof HTMLElement && !readerNodeHasVisibleContent(node)) {
      markReaderEmptyBlock(node);
    }
  });

  fragment.querySelectorAll("span").forEach((node) => {
    if (node instanceof HTMLElement && !readerNodeHasVisibleContent(node)) {
      node.remove();
    }
  });

  normalizeEbookReadableBlocks(fragment);
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
  normalizeReaderFragment(template.content);
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

function isMissingBookmarkColumnError(error) {
  return /ebook_bookmark|column|schema cache|could not find/i.test(String(error?.message || error || ""));
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

function getPathLabel(path = []) {
  return path
    .map((node) => node?.label || "")
    .filter(Boolean)
    .join(" / ");
}

function sortPostsForReading(posts = []) {
  return [...posts]
    .sort((a, b) => {
      const titleDiff = String(a.title || "").localeCompare(String(b.title || ""), "ko", {
        numeric: true,
        sensitivity: "base",
      });
      if (titleDiff) return titleDiff;
      return String(a.published_at || a.created_at || "").localeCompare(String(b.published_at || b.created_at || ""));
    });
}

function getDirectFolderPosts(folderId) {
  return sortPostsForReading(state.posts.filter((post) => post.folder_id === folderId));
}

function collectFolderPostsInReadingOrder(node = {}, posts = []) {
  if (node.type === "folder") {
    posts.push(...getDirectFolderPosts(node.id));
  }
  (node.children || []).forEach((child) => collectFolderPostsInReadingOrder(child, posts));
  return posts;
}

function getFolderSubtreePosts(folderId) {
  const found = findNode(state.tree, folderId);
  if (!found) return [];
  return collectFolderPostsInReadingOrder(found.node);
}

function getReadingFolderNodes(folderId) {
  const found = findNode(state.tree, folderId);
  if (!found) return [];
  const parent = found.path[found.path.length - 2] || null;
  const siblings = Array.isArray(parent?.children) ? parent.children : state.tree;
  const startIndex = siblings.findIndex((node) => node.id === folderId);
  if (startIndex < 0) return [found.node];
  return siblings.slice(startIndex).filter((node) => node.type === "folder");
}

function getFolderPosts(folderId) {
  return getReadingFolderNodes(folderId).reduce((posts, folder) => collectFolderPostsInReadingOrder(folder, posts), []);
}

function getFolderPathById(folderId) {
  const found = findNode(state.tree, folderId);
  return found ? getPathLabel(found.path) : "";
}

function getPostFolderPath(post = {}) {
  return post.folder_path || getFolderPathById(post.folder_id) || getActiveFolder()?.path || "";
}

function getBlogReturnHref() {
  const params = new URLSearchParams();
  if (state.activeFolderId) params.set("node", state.activeFolderId);
  const query = params.toString();
  return `./my-blog.html${query ? `?${query}` : ""}`;
}

function getEbookReturnHref() {
  const params = new URLSearchParams();
  if (state.activeFolderId) params.set("node", state.activeFolderId);
  const post = state.activePosts[state.postIndex] || null;
  if (post?.id) params.set("post", post.id);
  if (state.pageIndex > 0) params.set("page", String(state.pageIndex + 1));
  const query = params.toString();
  return `./ebook-reader.html${query ? `?${query}` : ""}`;
}

function getWriteEditorHref() {
  const params = new URLSearchParams();
  params.set("mode", "new");
  if (state.activeFolderId) params.set("node", state.activeFolderId);
  params.set("return", getEbookReturnHref());
  return `./editor.html?${params.toString()}`;
}

function syncWriteButton() {
  if (!els.write) return;
  const visible = Boolean(state.id);
  els.write.hidden = !visible;
  els.write.disabled = !visible;
}

function collectFolderOptions() {
  const folders = [];

  function walk(nodes = [], path = []) {
    nodes.forEach((node) => {
      const nextPath = [...path, node];
      if (node.type === "folder") {
        const posts = getFolderSubtreePosts(node.id);
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
  const treePathWithBookmark = `blog_trees?select=tree,trash,ebook_bookmark&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`;
  const treePath = `blog_trees?select=tree,trash&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`;
  const treeRequest = requestRest(treePathWithBookmark, session.access_token).catch((error) => {
    if (!isMissingBookmarkColumnError(error)) throw error;
    state.remoteBookmarkSupported = false;
    return requestRest(treePath, session.access_token);
  });
  const [treeRows, postRows] = await Promise.all([
    treeRequest,
    requestRest(
      "posts?select=id,title,body,category,folder,folder_id,folder_name,folder_path,author,login_id,user_id,published,published_at,created_at&order=title.asc&limit=1000",
      session.access_token
    ),
  ]);
  const treeRow = Array.isArray(treeRows) ? treeRows[0] : null;
  const trashIds = normalizeTrashPostIds(treeRow?.trash);
  state.tree = Array.isArray(treeRow?.tree) ? treeRow.tree.map(normalizeTreeNode) : [];
  syncBookmarkFromRemote(treeRow?.ebook_bookmark);
  state.posts = (Array.isArray(postRows) ? postRows : [])
    .map(normalizePost)
    .filter((post) => belongsToUser(post, session, state.id))
    .filter((post) => !trashIds.has(post.id));
}

function setMessage(message = "") {
  if (els.message) els.message.textContent = message;
}

function syncIdentity() {
  const title = state.id ? `${state.id}'s Blog` : "Blog";
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.owner) els.owner.textContent = state.id ? `@${state.id}` : "@guest";
  els.initials.forEach((item) => {
    item.textContent = (state.id || "B").slice(0, 1).toUpperCase();
  });
}

function applySidebarCollapsed() {
  document.body.classList.toggle("is-ebook-sidebar-collapsed", state.sidebarCollapsed);
  if (els.sidebarToggle) {
    els.sidebarToggle.textContent = state.sidebarCollapsed ? "›" : "‹";
    els.sidebarToggle.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
    els.sidebarToggle.setAttribute("aria-label", state.sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기");
  }
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(state.sidebarCollapsed));
  } catch {
    // Local storage can be blocked in some WebViews.
  }
  schedulePagination(false);
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  applySidebarCollapsed();
}

function getBookmarkKey() {
  return `${BOOKMARK_KEY_PREFIX}${state.id || "guest"}`;
}

function getBookmarkCookieName() {
  const id = String(state.id || "guest").replace(/[^a-z0-9_-]/gi, "_").slice(0, 48) || "guest";
  return `${BOOKMARK_COOKIE_PREFIX}${id}`;
}

function readBookmarkCookie() {
  try {
    const name = `${getBookmarkCookieName()}=`;
    const raw = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(name));
    if (!raw) return null;

    const bookmark = JSON.parse(decodeURIComponent(raw.slice(name.length)));
    return bookmark?.folderId && bookmark?.postId ? bookmark : null;
  } catch {
    return null;
  }
}

function writeBookmarkCookie(bookmark) {
  try {
    const name = getBookmarkCookieName();
    const sameSite = location.protocol === "https:" ? "; SameSite=Lax; Secure" : "; SameSite=Lax";
    if (!bookmark) {
      document.cookie = `${name}=; Max-Age=0; Path=/${sameSite}`;
      return;
    }
    const value = encodeURIComponent(JSON.stringify(bookmark));
    document.cookie = `${name}=${value}; Max-Age=31536000; Path=/${sameSite}`;
  } catch {
    // Cookie access can also be restricted in some embedded browsers.
  }
}

function normalizeBookmark(value) {
  let bookmark = value;
  if (typeof bookmark === "string") {
    try {
      bookmark = JSON.parse(bookmark);
    } catch {
      return null;
    }
  }
  if (!bookmark || typeof bookmark !== "object" || !bookmark.folderId || !bookmark.postId) return null;
  return {
    folderId: String(bookmark.folderId),
    postId: String(bookmark.postId),
    pageIndex: Math.max(0, Number.parseInt(bookmark.pageIndex || 0, 10) || 0),
    savedAt: bookmark.savedAt || new Date().toISOString(),
  };
}

function readLocalBookmark() {
  try {
    const bookmark = normalizeBookmark(JSON.parse(localStorage.getItem(getBookmarkKey()) || "null"));
    if (bookmark) return bookmark;
  } catch {
    // Local storage can be blocked or reset in some WebViews; cookie backup keeps the bookmark visible.
  }
  return normalizeBookmark(readBookmarkCookie());
}

function writeLocalBookmark(bookmark) {
  const normalized = normalizeBookmark(bookmark);
  state.bookmark = normalized;
  try {
    if (normalized) {
      localStorage.setItem(getBookmarkKey(), JSON.stringify(normalized));
    } else {
      localStorage.removeItem(getBookmarkKey());
    }
  } catch {
    // Local storage can be blocked in some WebViews.
  }
  writeBookmarkCookie(normalized);
}

function syncBookmarkFromRemote(remoteBookmark) {
  if (remoteBookmark !== undefined && remoteBookmark !== null) {
    const remote = normalizeBookmark(remoteBookmark);
    state.bookmark = remote;
    writeLocalBookmark(remote);
    return;
  }

  const remote = normalizeBookmark(remoteBookmark);
  const local = readLocalBookmark();
  const bookmark = remote || local;
  state.bookmark = bookmark;
  if (bookmark) writeLocalBookmark(bookmark);
  if (!remote && local && state.remoteBookmarkSupported) {
    saveBookmarkRemote(local).catch(() => {});
  }
}

async function saveBookmarkRemote(bookmark) {
  if (!state.remoteBookmarkSupported) return false;
  const session = await getFreshSession();
  const userId = session?.user?.id;
  if (!session?.access_token || !userId || !state.id) return false;

  const normalized = normalizeBookmark(bookmark);
  const payload = {
    ebook_bookmark: normalized || { cleared: true, savedAt: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  };

  try {
    const updated = await requestRest(`blog_trees?user_id=eq.${encodeURIComponent(userId)}`, session.access_token, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    if (Array.isArray(updated) && updated.length > 0) return true;

    await requestRest("blog_trees", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        login_id: state.id,
        tree: state.tree || [],
        trash: [],
        ...payload,
      }),
    });
    return true;
  } catch (error) {
    if (isMissingBookmarkColumnError(error)) {
      state.remoteBookmarkSupported = false;
      return false;
    }
    throw error;
  }
}

async function writeBookmark(bookmark) {
  const normalized = normalizeBookmark(bookmark);
  writeLocalBookmark(normalized);
  await saveBookmarkRemote(normalized);
}

function getCurrentBookmark() {
  const post = state.activePosts[state.postIndex] || null;
  if (!state.activeFolderId || !post?.id) return null;
  return {
    folderId: state.activeFolderId,
    postId: post.id,
    pageIndex: Math.max(0, state.pageIndex),
    savedAt: new Date().toISOString(),
  };
}

function isCurrentBookmark() {
  const current = getCurrentBookmark();
  return Boolean(
    current &&
      state.bookmark &&
      state.bookmark.folderId === current.folderId &&
      state.bookmark.postId === current.postId &&
      Number(state.bookmark.pageIndex || 0) === Number(current.pageIndex || 0)
  );
}

function getPostBookmark(post = {}) {
  if (!post?.id || !state.bookmark) return null;
  if (state.bookmark.folderId !== state.activeFolderId) return null;
  return state.bookmark.postId === post.id ? state.bookmark : null;
}

function syncBookmarkButton() {
  if (!els.bookmark) return;
  const hasCurrent = Boolean(getCurrentBookmark());
  const active = isCurrentBookmark();
  els.bookmark.disabled = !hasCurrent;
  els.bookmark.setAttribute("aria-pressed", String(active));
  els.bookmark.textContent = active ? "북마크 해제" : "북마크";
}

function toggleBookmark() {
  if (isCurrentBookmark()) {
    writeBookmark(null);
    setMessage("북마크를 해제했습니다.");
    renderPostList();
    syncBookmarkButton();
    return;
  }
  const current = getCurrentBookmark();
  if (!current) return;
  writeBookmark(current);
  setMessage("북마크를 저장했습니다.");
  renderPostList();
  syncBookmarkButton();
}

function getActiveFolder() {
  return state.folders.find((item) => item.id === state.activeFolderId) || null;
}

function renderSelectedFolder() {
  const folder = getActiveFolder();
  if (els.selectedFolderName) {
    els.selectedFolderName.textContent = folder?.label || "폴더를 선택해주세요";
  }
  if (els.selectedFolderPath) {
    els.selectedFolderPath.textContent = folder ? `${folder.path} · ${folder.count}개 글` : "";
  }
}

function renderFolders() {
  state.folders = collectFolderOptions();
  if (!els.folderSelect || !els.folderList) return;
  syncWriteButton();

  if (state.folders.length === 0) {
    els.folderSelect.innerHTML = `<option value="">글이 있는 폴더가 없습니다</option>`;
    els.folderList.innerHTML = `<p class="ebook-empty">글이 들어 있는 폴더가 아직 없습니다.</p>`;
    renderSelectedFolder();
    syncBookmarkButton();
    return;
  }

  if (state.activeFolderId && !state.folders.some((folder) => folder.id === state.activeFolderId)) {
    state.activeFolderId = "";
  }

  els.folderSelect.innerHTML = `
    <option value="" ${state.activeFolderId ? "" : "selected"}>폴더를 선택해주세요</option>
    ${state.folders
      .map(
        (folder) =>
          `<option value="${escapeHtml(folder.id)}" ${folder.id === state.activeFolderId ? "selected" : ""}>${escapeHtml(folder.path)} (${folder.count})</option>`
      )
      .join("")}
  `;

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
  renderSelectedFolder();
  syncBookmarkButton();
}

function renderPostList() {
  if (!els.postList) return;
  if (!state.activeFolderId) {
    els.postList.innerHTML = `<p class="ebook-empty">폴더를 선택하면 글 목록이 표시됩니다.</p>`;
    return;
  }
  if (state.activePosts.length === 0) {
    els.postList.innerHTML = `<p class="ebook-empty">선택한 폴더에 글이 없습니다.</p>`;
    return;
  }
  els.postList.innerHTML = `
    <strong>글 목록</strong>
    ${state.activePosts
      .map(
        (post, index) => {
          const bookmark = getPostBookmark(post);
          const classes = [index === state.postIndex ? "is-active" : "", bookmark ? "has-bookmark" : ""]
            .filter(Boolean)
            .join(" ");
          const bookmarkPage = Math.max(1, Number(bookmark?.pageIndex || 0) + 1);
          return `
          <button class="${classes}" type="button" data-ebook-post-index="${index}">
            <span class="ebook-post-title">${escapeHtml(post.title)}</span>
            ${bookmark ? `<span class="ebook-bookmark-marker" aria-label="북마크 ${bookmarkPage}페이지">북마크 ${bookmarkPage}p</span>` : ""}
          </button>
        `;
        }
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
  if (els.content) els.content.style.transform = "translate3d(0, 0, 0)";
}

function resetPaginationMeasureStyles() {
  if (!els.content) return;
  els.content.style.transform = "translate3d(0, 0, 0)";
  els.content.style.width = "";
  els.content.style.columnWidth = "";
  els.content.style.columnGap = "";
}

function updatePagination() {
  if (!els.content) return;
  const surface = els.content.closest(".ebook-page-surface");
  resetPaginationMeasureStyles();
  const width = Math.max(1, Math.floor(els.content.clientWidth || surface?.clientWidth || 1));
  const gap = Math.min(48, Math.max(28, Math.round(width * 0.06)));
  state.pageStep = width + gap;
  els.content.style.width = `${width}px`;
  els.content.style.columnWidth = `${width}px`;
  els.content.style.columnGap = `${gap}px`;
  const scrollWidth = Math.max(els.content.scrollWidth, width);
  state.pageCount = Math.max(1, Math.ceil((scrollWidth + gap) / state.pageStep));
  if (Number.isFinite(state.pendingPageIndex)) {
    state.pageIndex = Math.max(0, Math.floor(state.pendingPageIndex));
    state.pendingPageIndex = null;
    state.pendingLastPage = false;
  } else if (state.pendingLastPage) {
    state.pageIndex = state.pageCount - 1;
    state.pendingLastPage = false;
  }
  state.pageIndex = Math.min(Math.max(state.pageIndex, 0), state.pageCount - 1);
  els.content.style.transform = `translate3d(${-state.pageIndex * state.pageStep}px, 0, 0)`;
  renderProgress();
}

function schedulePagination(resetPage = false) {
  if (resetPage) clearPagination();
  requestAnimationFrame(() => requestAnimationFrame(updatePagination));
}

function renderProgress() {
  const post = state.activePosts[state.postIndex] || null;
  const folder = getActiveFolder();
  if (els.folderPath) els.folderPath.textContent = post ? getPostFolderPath(post) : folder ? folder.path : "폴더를 선택해주세요.";
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
  syncWriteButton();
  syncBookmarkButton();
}

function enhanceEbookContentTypography() {
  if (!els.content) return;

  els.content.querySelectorAll("p, div, li").forEach((node) => {
    if (node.closest(".ebook-content-title")) return;
    const text = String(node.textContent || "").trim();
    if (!text) return;

    if (/^[\u201c\u2018"'「『]/.test(text) && [...text].length >= 28) {
      node.classList.add("ebook-dialogue-line");
    }
  });
}

function enhanceEbookContentTypography() {
  if (!els.content) return;

  els.content.querySelectorAll("p, div, li").forEach((node) => {
    if (node.closest(".ebook-content-title")) return;
    node.classList.remove("ebook-dialogue-line");
    const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;

    if (/^[\s"'`\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f\u300a\u300b\u3008\u3009\[]/.test(text) && [...text].length >= 28) {
      node.classList.add("ebook-dialogue-line");
    }
  });
}

function renderCurrentPost({ lastPage = false } = {}) {
  const post = state.activePosts[state.postIndex] || null;
  if (!post) {
    if (els.content) {
      els.content.innerHTML = `<p>${state.activeFolderId ? "선택한 폴더에 표시할 글이 없습니다." : "폴더를 선택하면 글을 이어 읽을 수 있습니다."}</p>`;
    }
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
    enhanceEbookContentTypography();
    els.content.querySelectorAll("img").forEach((image) => {
      if (!image.complete) {
        image.addEventListener("load", () => schedulePagination(false), { once: true });
        image.addEventListener("error", () => schedulePagination(false), { once: true });
      }
    });
  }
  renderPostList();
  schedulePagination(true);
}

function clearFolderSelection({ updateUrl = true } = {}) {
  state.activeFolderId = "";
  state.activePosts = [];
  state.postIndex = 0;
  state.pendingPageIndex = null;
  state.pendingLastPage = false;
  clearPagination();
  renderFolders();
  renderPostList();
  renderCurrentPost();
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.delete("node");
    history.replaceState(null, "", url);
  }
}

function selectFolder(folderId, options = {}) {
  if (!folderId) {
    clearFolderSelection();
    return;
  }
  state.activeFolderId = folderId;
  state.activePosts = getFolderPosts(folderId);
  const postIndex = options.postId ? state.activePosts.findIndex((post) => post.id === options.postId) : -1;
  state.postIndex = postIndex >= 0 ? postIndex : 0;
  if (Number.isFinite(options.pageIndex)) {
    state.pendingPageIndex = Number(options.pageIndex);
  }
  renderFolders();
  renderPostList();
  renderCurrentPost();
  const url = new URL(window.location.href);
  url.searchParams.set("node", folderId);
  history.replaceState(null, "", url);
  if (options.closeDialog !== false) closeFolderDialog();
}

function selectPost(index, options = {}) {
  if (index < 0 || index >= state.activePosts.length) return;
  state.postIndex = index;
  if (options.restoreBookmark) {
    const bookmark = getPostBookmark(state.activePosts[index]);
    if (bookmark) {
      state.pendingPageIndex = Number(bookmark.pageIndex || 0);
    }
  }
  if (Number.isFinite(options.pageIndex)) {
    state.pendingPageIndex = Number(options.pageIndex);
  }
  renderCurrentPost(options);
}

function restoreReaderLocationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const folderId = params.get("node") || params.get("folder") || "";
  if (!folderId || !state.folders.some((folder) => folder.id === folderId)) return false;

  const postId = params.get("post") || "";
  const pageNumber = Number.parseInt(params.get("page") || "", 10);
  selectFolder(folderId, {
    postId,
    pageIndex: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber - 1 : undefined,
    closeDialog: false,
  });
  return true;
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

function shouldIgnoreSwipeTarget(target) {
  return Boolean(target?.closest?.("a, button, input, select, textarea, dialog, [contenteditable='true']"));
}

function startSwipe(event) {
  if (event.touches.length !== 1 || shouldIgnoreSwipeTarget(event.target)) {
    swipeState = null;
    return;
  }
  const touch = event.touches[0];
  swipeState = {
    x: touch.clientX,
    y: touch.clientY,
    horizontal: false,
  };
}

function moveSwipe(event) {
  if (!swipeState || event.touches.length !== 1) return;
  const touch = event.touches[0];
  const dx = touch.clientX - swipeState.x;
  const dy = touch.clientY - swipeState.y;
  if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE_RATIO) {
    swipeState.horizontal = true;
    event.preventDefault();
  }
}

function endSwipe(event) {
  if (!swipeState) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeState.x;
  const dy = touch.clientY - swipeState.y;
  const isSwipe = swipeState.horizontal && Math.abs(dx) >= SWIPE_MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE_RATIO;
  swipeState = null;
  if (!isSwipe) return;
  if (dx < 0) {
    nextPage();
  } else {
    prevPage();
  }
}

function cancelSwipe() {
  swipeState = null;
}

function openFolderDialog() {
  if (!els.folderDialog) return;
  if (typeof els.folderDialog.showModal === "function") {
    if (!els.folderDialog.open) els.folderDialog.showModal();
    return;
  }
  els.folderDialog.setAttribute("open", "");
}

function closeFolderDialog() {
  if (!els.folderDialog) return;
  if (typeof els.folderDialog.close === "function") {
    if (els.folderDialog.open) els.folderDialog.close();
    return;
  }
  els.folderDialog.removeAttribute("open");
}

function goBack() {
  if (state.activeFolderId) {
    window.location.href = getBlogReturnHref();
    return;
  }
  window.location.href = state.id ? "./my-blog.html" : "./";
}

let scrollToolboxFrame = 0;

function syncScrollToolbox() {
  scrollToolboxFrame = 0;
  document.body.classList.toggle("is-ebook-scrolled", window.scrollY > 56);
}

function scheduleScrollToolbox() {
  if (scrollToolboxFrame) return;
  scrollToolboxFrame = requestAnimationFrame(syncScrollToolbox);
}

async function toggleBookmark() {
  if (isCurrentBookmark()) {
    try {
      await writeBookmark(null);
      setMessage("북마크를 해제했습니다.");
    } catch (error) {
      setMessage(error.message || "북마크를 해제하지 못했습니다.");
    }
    renderPostList();
    syncBookmarkButton();
    return;
  }

  const current = getCurrentBookmark();
  if (!current) return;
  try {
    await writeBookmark(current);
    setMessage("북마크를 저장했습니다.");
  } catch (error) {
    setMessage(error.message || "북마크를 저장하지 못했습니다.");
  }
  renderPostList();
  syncBookmarkButton();
}

async function openWriteEditor() {
  const session = await getFreshSession();
  const id = getSessionId(session);
  if (!id) {
    state.id = "";
    syncWriteButton();
    window.location.href = "./login.html";
    return;
  }
  state.session = session;
  state.id = id;
  syncWriteButton();
  window.location.href = getWriteEditorHref();
}

function bindEvents() {
  els.back?.addEventListener("click", goBack);
  els.sidebarToggle?.addEventListener("click", toggleSidebar);
  els.folderOpen?.addEventListener("click", openFolderDialog);
  els.write?.addEventListener("click", openWriteEditor);
  els.opacityToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpacityPopover(els.opacityPopover?.hidden !== false);
  });
  els.opacityInput?.addEventListener("input", (event) => applyReaderOpacity(event.target.value));
  document.addEventListener("click", (event) => {
    if (!els.opacityControl?.contains(event.target)) setOpacityPopover(false);
  });
  els.folderClose?.addEventListener("click", closeFolderDialog);
  els.folderDialog?.addEventListener("click", (event) => {
    if (event.target === els.folderDialog) closeFolderDialog();
  });
  els.folderSelect?.addEventListener("change", (event) => selectFolder(event.target.value));
  els.folderList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ebook-folder]");
    if (button) selectFolder(button.dataset.ebookFolder);
  });
  els.postList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ebook-post-index]");
    if (button) selectPost(Number(button.dataset.ebookPostIndex) || 0, { restoreBookmark: true });
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
  els.bookmark?.addEventListener("click", toggleBookmark);
  els.progress?.addEventListener("input", (event) => {
    state.pageIndex = Math.min(Math.max(Number(event.target.value) - 1, 0), state.pageCount - 1);
    updatePagination();
  });
  els.stage?.addEventListener("touchstart", startSwipe, { passive: true });
  els.stage?.addEventListener("touchmove", moveSwipe, { passive: false });
  els.stage?.addEventListener("touchend", endSwipe, { passive: true });
  els.stage?.addEventListener("touchcancel", cancelSwipe, { passive: true });
  window.addEventListener("resize", () => schedulePagination(false));
  window.addEventListener("scroll", scheduleScrollToolbox, { passive: true });
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
  syncScrollToolbox();
  applySidebarCollapsed();
  applyReaderOpacity();
  updateReaderFont();
  const session = await window.blogSession?.ready;
  const id = getSessionId(session);
  if (!id) {
    state.session = null;
    state.id = "";
    syncIdentity();
    syncWriteButton();
    renderFolders();
    renderPostList();
    renderCurrentPost();
    setMessage("로그인 후 책 뷰어를 사용할 수 있습니다.");
    return;
  }
  state.session = session;
  state.id = id;
  syncIdentity();
  syncWriteButton();
  state.bookmark = readLocalBookmark();
  setMessage("글과 폴더를 불러오는 중입니다.");

  try {
    await loadTreeAndPosts(session);
    renderFolders();
    if (state.folders.length > 0) {
      if (restoreReaderLocationFromUrl()) {
        setMessage("");
        return;
      }
      renderPostList();
      renderCurrentPost();
      setMessage("폴더를 선택해주세요.");
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
