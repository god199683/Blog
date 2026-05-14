const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const params = new URLSearchParams(window.location.search);
const viewerTarget = params.get("target") === "materials" || params.has("material") ? "materials" : "posts";
const materialId = params.get("material") || (viewerTarget === "materials" ? params.get("id") || "" : "");
const postId = viewerTarget === "materials" ? materialId : params.get("id") || "";
let bookMode = params.get("book") === "1";
let readerFontSize = Number.parseInt(localStorage.getItem("blog.readerFontSize") || "18", 10);
let readerTheme = localStorage.getItem("blog.readerTheme") || "sky";
let readerWidth = localStorage.getItem("blog.readerWidth") || "standard";
let readerLineHeight = localStorage.getItem("blog.readerLineHeight") || "normal";
let currentPost = null;
let sameFolderPosts = [];
let bookPageIndex = 0;
let bookPageCount = 1;
let bookPageStep = 0;
let pendingBookPage = params.get("page") || "";
let paginationFrame = 0;
let wheelTurnLockedUntil = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

const els = {
  title: document.querySelector("[data-viewer-title]"),
  location: document.querySelector("[data-viewer-location]"),
  body: document.querySelector("[data-viewer-body]"),
  message: document.querySelector("[data-viewer-message]"),
  back: document.querySelector("[data-viewer-back]"),
  edit: document.querySelector("[data-viewer-edit]"),
  bookToggle: document.querySelector("[data-viewer-book-toggle]"),
  readerControls: document.querySelector("[data-viewer-reader-controls]"),
  themeSelect: document.querySelector("[data-viewer-theme]"),
  widthSelect: document.querySelector("[data-viewer-width]"),
  lineHeightSelect: document.querySelector("[data-viewer-line-height]"),
  fontDown: document.querySelector("[data-viewer-font-down]"),
  fontUp: document.querySelector("[data-viewer-font-up]"),
  fontSize: document.querySelector("[data-viewer-font-size]"),
  bookClose: document.querySelector("[data-viewer-book-close]"),
  bookNav: document.querySelector("[data-viewer-book-nav]"),
  first: document.querySelector("[data-viewer-first]"),
  prev: document.querySelector("[data-viewer-prev]"),
  next: document.querySelector("[data-viewer-next]"),
  last: document.querySelector("[data-viewer-last]"),
  prevSide: document.querySelector("[data-viewer-prev-side]"),
  nextSide: document.querySelector("[data-viewer-next-side]"),
  progress: document.querySelector("[data-viewer-progress]"),
  position: document.querySelector("[data-viewer-book-position]"),
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

function decodeHtmlEntities(value = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value);
  return textarea.value;
}

function hasHtmlMarkup(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
}

function plainTextToViewerHtml(value = "") {
  return String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("") || "<p></p>";
}

function normalizeMaterialBody(value = "") {
  const decoded = decodeHtmlEntities(value);
  return hasHtmlMarkup(decoded) ? decoded : plainTextToViewerHtml(decoded);
}

function getPostLocation(post) {
  if (post.folder_path) return post.folder_path;
  return [post.category || "전체", post.folder_name || post.folder || ""].filter(Boolean).join(" / ");
}

function normalizePostId(post) {
  return String(post?.id || "");
}

function getBookContent() {
  return els.body.querySelector("[data-viewer-page-content]");
}

function getPostSortTime(post) {
  const time = Date.parse(post?.published_at || post?.created_at || "");
  return Number.isFinite(time) ? time : 0;
}

function sortPostsForBook(posts) {
  return [...posts].sort((a, b) => {
    const titleDiff = String(a.title || "제목 없는 글").localeCompare(String(b.title || "제목 없는 글"), "ko", {
      numeric: true,
      sensitivity: "base",
    });
    if (titleDiff !== 0) return titleDiff;
    return getPostSortTime(a) - getPostSortTime(b);
  });
}

function normalizeScopeText(value = "") {
  return String(value || "").trim();
}

function getReaderCategory(post = {}) {
  return normalizeScopeText(post.category) || "전체";
}

function getReaderFolderKeys(post = {}) {
  const category = getReaderCategory(post);
  const folderId = normalizeScopeText(post.folder_id);
  const folderPath = normalizeScopeText(post.folder_path);
  const folderName = normalizeScopeText(post.folder_name || post.folder);
  return [
    folderId ? `id:${folderId}` : "",
    folderPath ? `path:${folderPath}` : "",
    folderName ? `name:${category}:${folderName}` : "",
  ].filter(Boolean);
}

function isSameBookScope(post, sourcePost) {
  const sourceFolderKeys = getReaderFolderKeys(sourcePost);
  if (sourceFolderKeys.length > 0) {
    const postFolderKeys = new Set(getReaderFolderKeys(post));
    return sourceFolderKeys.some((key) => postFolderKeys.has(key));
  }

  return getReaderCategory(post) === getReaderCategory(sourcePost);
}

function getPostOwnerFilter(post) {
  if (post.user_id) return ["user_id", post.user_id];
  if (post.login_id) return ["login_id", post.login_id];
  if (post.author) return ["author", post.author];
  return null;
}

function buildViewerUrl(nextPostId, useBookMode = bookMode, pageTarget = "") {
  const nextParams = new URLSearchParams();
  if (viewerTarget === "materials") {
    nextParams.set("target", "materials");
    nextParams.set("material", nextPostId);
  } else {
    nextParams.set("id", nextPostId);
  }
  if (useBookMode) {
    nextParams.set("book", "1");
    if (pageTarget) nextParams.set("page", pageTarget);
  }
  return `./viewer.html?${nextParams.toString()}`;
}

function syncBookModeUrl() {
  if (!postId) return;
  const pageTarget = bookMode && bookPageIndex > 0 ? String(bookPageIndex + 1) : "";
  const nextUrl = buildViewerUrl(postId, bookMode, pageTarget);
  window.history.replaceState(null, "", nextUrl);
}

function clampReaderFontSize(size) {
  return Math.min(28, Math.max(14, Number.parseInt(size, 10) || 18));
}

function pickReaderOption(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function syncReaderControls() {
  readerFontSize = clampReaderFontSize(readerFontSize);
  readerTheme = pickReaderOption(readerTheme, ["sky"], "sky");
  readerWidth = pickReaderOption(readerWidth, ["narrow", "standard", "wide"], "standard");
  readerLineHeight = pickReaderOption(readerLineHeight, ["compact", "normal", "relaxed"], "normal");

  document.body.style.setProperty("--reader-font-size", `${readerFontSize}px`);
  document.body.style.setProperty(
    "--reader-max-width",
    {
      narrow: "760px",
      standard: "920px",
      wide: "1120px",
    }[readerWidth]
  );
  document.body.style.setProperty(
    "--reader-line-height",
    {
      compact: "1.72",
      normal: "1.88",
      relaxed: "2.08",
    }[readerLineHeight]
  );
  document.body.dataset.readerTheme = readerTheme;
  document.body.dataset.readerWidth = readerWidth;
  document.body.dataset.readerLineHeight = readerLineHeight;
  els.fontSize.textContent = `${readerFontSize}px`;
  els.themeSelect.value = readerTheme;
  els.widthSelect.value = readerWidth;
  if (els.lineHeightSelect) els.lineHeightSelect.value = readerLineHeight;
  localStorage.setItem("blog.readerFontSize", String(readerFontSize));
  localStorage.setItem("blog.readerTheme", readerTheme);
  localStorage.setItem("blog.readerWidth", readerWidth);
  localStorage.setItem("blog.readerLineHeight", readerLineHeight);
}

function updateBookModeUi() {
  document.documentElement.classList.toggle("is-book-mode", bookMode);
  document.body.classList.toggle("is-book-mode", bookMode);
  els.bookToggle.textContent = bookMode ? "일반 보기" : "책 읽기";
  els.bookToggle.setAttribute("aria-pressed", String(bookMode));
  els.readerControls.hidden = !bookMode;
  els.bookNav.hidden = !bookMode;
  syncReaderControls();
}

function closeBookMode() {
  bookMode = false;
  clearBookPagination();
  syncBookModeUrl();
  updateBookModeUi();
}

function changeReaderFontSize(delta) {
  readerFontSize = clampReaderFontSize(readerFontSize + delta);
  syncReaderControls();
  scheduleBookPagination();
}

function renderPostBody(post) {
  const content = post.body ? cleanViewerHtml(post.body) : `<p>${escapeHtml(post.excerpt || "")}</p>`;
  els.body.innerHTML = `<div class="viewer-page-content" data-viewer-page-content>${content}</div>`;
}

function getBookSiblings() {
  const currentIndex = sameFolderPosts.findIndex((post) => normalizePostId(post) === normalizePostId(currentPost));
  return {
    currentIndex,
    prevPost: currentIndex > 0 ? sameFolderPosts[currentIndex - 1] : null,
    nextPost: currentIndex >= 0 && currentIndex < sameFolderPosts.length - 1 ? sameFolderPosts[currentIndex + 1] : null,
  };
}

function clearBookPagination() {
  if (paginationFrame) {
    window.cancelAnimationFrame(paginationFrame);
    paginationFrame = 0;
  }

  const content = getBookContent();
  if (content) {
    content.style.removeProperty("width");
    content.style.removeProperty("height");
    content.style.removeProperty("column-width");
    content.style.removeProperty("column-gap");
    content.style.removeProperty("transform");
  }

  bookPageIndex = 0;
  bookPageCount = 1;
  bookPageStep = 0;
}

function applyPendingBookPage() {
  if (!pendingBookPage) return;

  if (pendingBookPage === "last") {
    bookPageIndex = Math.max(0, bookPageCount - 1);
  } else {
    const pageNumber = Number.parseInt(pendingBookPage, 10);
    if (Number.isFinite(pageNumber)) {
      bookPageIndex = Math.min(Math.max(pageNumber - 1, 0), Math.max(0, bookPageCount - 1));
    }
  }

  pendingBookPage = "";
}

function applyBookPageOffset() {
  const content = getBookContent();
  if (!content) return;

  const offset = bookPageIndex * bookPageStep;
  content.style.transform = `translate3d(-${offset}px, 0, 0)`;
}

function measureBookPages() {
  paginationFrame = 0;
  const content = getBookContent();

  if (!bookMode || !content) {
    renderBookNavigation();
    return;
  }

  const contentStyle = window.getComputedStyle(content);
  const horizontalPadding =
    Number.parseFloat(contentStyle.paddingLeft) + Number.parseFloat(contentStyle.paddingRight);
  const verticalPadding =
    Number.parseFloat(contentStyle.paddingTop) + Number.parseFloat(contentStyle.paddingBottom);
  const pageWidth = Math.max(260, Math.floor(els.body.clientWidth));
  const pageHeight = Math.max(260, Math.floor(els.body.clientHeight));
  const columnWidth = Math.max(220, Math.floor(pageWidth - horizontalPadding));
  const pageGap = Math.round(Math.max(horizontalPadding + 12, Math.min(96, pageWidth * 0.12)));

  content.style.width = `${pageWidth}px`;
  content.style.height = `${pageHeight}px`;
  content.style.columnWidth = `${columnWidth}px`;
  content.style.columnGap = `${pageGap}px`;
  content.style.columnFill = "auto";
  bookPageStep = columnWidth + pageGap;

  bookPageCount = Math.max(1, Math.ceil(Math.max(content.scrollWidth - horizontalPadding, columnWidth) / bookPageStep));
  applyPendingBookPage();
  bookPageIndex = Math.min(Math.max(bookPageIndex, 0), bookPageCount - 1);
  applyBookPageOffset();
  renderBookNavigation();
}

function scheduleBookPagination(resetPage = false) {
  if (!bookMode) return;
  if (resetPage) {
    bookPageIndex = 0;
    pendingBookPage = "";
  }
  if (paginationFrame) window.cancelAnimationFrame(paginationFrame);
  paginationFrame = window.requestAnimationFrame(measureBookPages);
}

function setBookPage(nextPageIndex) {
  if (!bookMode) return;
  bookPageIndex = Math.min(Math.max(nextPageIndex, 0), Math.max(0, bookPageCount - 1));
  applyBookPageOffset();
  renderBookNavigation();
  syncBookModeUrl();
}

function moveBookPrevious() {
  const { prevPost } = getBookSiblings();
  if (bookMode && bookPageIndex > 0) {
    setBookPage(bookPageIndex - 1);
    return;
  }
  if (prevPost) goToBookPost(normalizePostId(prevPost), "last");
}

function moveBookNext() {
  const { nextPost } = getBookSiblings();
  if (bookMode && bookPageIndex < bookPageCount - 1) {
    setBookPage(bookPageIndex + 1);
    return;
  }
  if (nextPost) goToBookPost(normalizePostId(nextPost), "1");
}

function turnBookByDirection(direction) {
  if (!bookMode) return;
  if (direction < 0) {
    if (!els.prevSide.disabled) moveBookPrevious();
    return;
  }
  if (!els.nextSide.disabled) moveBookNext();
}

function handleBookWheel(event) {
  if (!bookMode) return;

  const deltaX = Number(event.deltaX) || 0;
  const deltaY = Number(event.deltaY) || 0;
  const strongestDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  if (Math.abs(strongestDelta) < 8) return;

  event.preventDefault();
  const now = window.performance.now();
  if (now < wheelTurnLockedUntil) return;

  wheelTurnLockedUntil = now + 360;
  turnBookByDirection(strongestDelta);
}

function handleBookTouchStart(event) {
  if (!bookMode || event.touches.length !== 1) return;
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = window.performance.now();
}

function handleBookTouchMove(event) {
  if (!bookMode || event.touches.length !== 1) return;
  event.preventDefault();
}

function handleBookTouchEnd(event) {
  if (!bookMode || !event.changedTouches.length) return;
  const touch = event.changedTouches[0];
  const moveX = touch.clientX - touchStartX;
  const moveY = touch.clientY - touchStartY;
  const elapsed = window.performance.now() - touchStartTime;

  if (elapsed > 1200 || Math.abs(moveX) < 42 || Math.abs(moveX) < Math.abs(moveY) * 1.15) return;
  turnBookByDirection(moveX > 0 ? -1 : 1);
}

function refreshPaginationWhenMediaLoads() {
  getBookContent()
    ?.querySelectorAll("img")
    .forEach((image) => {
      if (image.complete) return;
      image.addEventListener("load", () => scheduleBookPagination(), { once: true });
      image.addEventListener("error", () => scheduleBookPagination(), { once: true });
    });
}

function renderBookNavigation() {
  if (!bookMode || !currentPost) {
    updateBookModeUi();
    return;
  }

  const { prevPost, nextPost } = getBookSiblings();
  const hasPrevPage = bookPageIndex > 0;
  const hasNextPage = bookPageIndex < bookPageCount - 1;
  const canMovePrev = hasPrevPage || Boolean(prevPost);
  const canMoveNext = hasNextPage || Boolean(nextPost);
  const progressPercent = Math.round(((bookPageIndex + 1) / Math.max(bookPageCount, 1)) * 100);

  els.position.textContent = `${bookPageIndex + 1} / ${bookPageCount} · ${progressPercent}%`;
  els.first.disabled = bookPageIndex <= 0;
  els.last.disabled = bookPageIndex >= bookPageCount - 1;
  els.prev.disabled = !canMovePrev;
  els.next.disabled = !canMoveNext;
  els.prevSide.disabled = !canMovePrev;
  els.nextSide.disabled = !canMoveNext;
  els.prev.dataset.postId = !hasPrevPage && prevPost ? normalizePostId(prevPost) : "";
  els.next.dataset.postId = !hasNextPage && nextPost ? normalizePostId(nextPost) : "";
  els.prevSide.dataset.postId = els.prev.dataset.postId;
  els.nextSide.dataset.postId = els.next.dataset.postId;
  els.prev.textContent = hasPrevPage ? "← 이전 페이지" : prevPost ? `← 이전 글: ${prevPost.title || "이전 글"}` : "← 이전 페이지";
  els.next.textContent = hasNextPage ? "다음 페이지 →" : nextPost ? `다음 글: ${nextPost.title || "다음 글"} →` : "다음 페이지 →";
  els.progress.max = String(bookPageCount);
  els.progress.value = String(bookPageIndex + 1);
  els.progress.disabled = bookPageCount <= 1;
  updateBookModeUi();
}

function goToBookPost(targetPostId, pageTarget = "") {
  if (!targetPostId) return;
  window.location.href = buildViewerUrl(targetPostId, bookMode, pageTarget);
}

async function fetchPost() {
  if (viewerTarget === "materials") return fetchMaterial();

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

async function fetchMaterial() {
  if (!materialId) {
    throw new Error("자료 주소가 올바르지 않습니다.");
  }

  const session = getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_materials`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("id", `eq.${materialId}`);
  endpoint.searchParams.set("deleted_at", "is.null");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || "자료를 불러오지 못했습니다.";
    throw new Error(message);
  }

  const material = Array.isArray(data) ? data[0] : null;
  if (!material) throw new Error("자료를 찾지 못했습니다.");

  return {
    ...material,
    body: normalizeMaterialBody(material.content || material.url || ""),
    excerpt: material.url || "",
    folder: material.folder_name || "",
    published_at: material.created_at,
    author: material.login_id || "",
    source_type: "materials",
  };
}

async function fetchSameFolderPosts(post) {
  if (viewerTarget === "materials") return [post];

  const session = getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set(
    "select",
    "id,title,category,author,login_id,user_id,folder,folder_id,folder_name,folder_path,published,published_at,created_at"
  );
  endpoint.searchParams.set("limit", "1000");
  endpoint.searchParams.set("order", "title.asc.nullslast,published_at.asc.nullslast,created_at.asc.nullslast");

  const ownerFilter = getPostOwnerFilter(post);
  if (ownerFilter) {
    endpoint.searchParams.set(ownerFilter[0], `eq.${ownerFilter[1]}`);
  }

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(data)) return [post];

  const byId = new Map();
  data.filter((item) => isSameBookScope(item, post)).forEach((item) => {
    if (item?.id) byId.set(normalizePostId(item), item);
  });
  byId.set(normalizePostId(post), post);
  return sortPostsForBook([...byId.values()]);
}

async function initViewer() {
  try {
    const post = await fetchPost();
    currentPost = post;
    const session = getSession();
    const loginId = getSessionId(session);
    const isOwner = [post.author, post.login_id, post.user_id]
      .filter(Boolean)
      .some((value) =>
        [loginId, session?.user?.id].filter(Boolean).some((id) => String(value).toLowerCase() === String(id).toLowerCase())
      );

    els.title.textContent = post.title || "제목 없는 글";
    els.location.textContent = getPostLocation(post);
    renderPostBody(post);
    refreshPaginationWhenMediaLoads();
    els.edit.hidden = !isOwner;
    sameFolderPosts = await fetchSameFolderPosts(post);
    renderBookNavigation();
    scheduleBookPagination();
  } catch (error) {
    els.title.textContent = "글을 불러오지 못했습니다";
    els.location.textContent = "";
    els.body.innerHTML = "";
    els.message.textContent = error.message;
    bookMode = false;
    updateBookModeUi();
  }
}

els.back.addEventListener("click", () => {
  window.location.href = viewerTarget === "materials" ? "./materials.html" : "./my-blog.html";
});

els.edit.addEventListener("click", () => {
  if (!postId) return;
  window.location.href =
    viewerTarget === "materials"
      ? `./editor.html?target=materials&material=${encodeURIComponent(postId)}`
      : `./editor.html?post=${encodeURIComponent(postId)}`;
});

els.bookToggle.addEventListener("click", () => {
  bookMode = !bookMode;
  if (bookMode) {
    scheduleBookPagination(true);
  } else {
    clearBookPagination();
  }
  syncBookModeUrl();
  renderBookNavigation();
});

els.bookClose.addEventListener("click", () => {
  closeBookMode();
});

els.themeSelect.addEventListener("change", (event) => {
  readerTheme = event.target.value;
  syncReaderControls();
});

els.widthSelect.addEventListener("change", (event) => {
  readerWidth = event.target.value;
  syncReaderControls();
  scheduleBookPagination(true);
});

els.lineHeightSelect?.addEventListener("change", (event) => {
  readerLineHeight = event.target.value;
  syncReaderControls();
  scheduleBookPagination(true);
});

els.fontDown.addEventListener("click", () => {
  changeReaderFontSize(-1);
});

els.fontUp.addEventListener("click", () => {
  changeReaderFontSize(1);
});

els.first.addEventListener("click", () => {
  setBookPage(0);
});

els.last.addEventListener("click", () => {
  setBookPage(bookPageCount - 1);
});

els.prev.addEventListener("click", () => {
  moveBookPrevious();
});

els.next.addEventListener("click", () => {
  moveBookNext();
});

els.prevSide.addEventListener("click", () => {
  moveBookPrevious();
});

els.nextSide.addEventListener("click", () => {
  moveBookNext();
});

els.progress.addEventListener("input", () => {
  setBookPage(Number.parseInt(els.progress.value, 10) - 1);
});

els.body.addEventListener("wheel", handleBookWheel, { passive: false });
els.body.addEventListener("touchstart", handleBookTouchStart, { passive: true });
els.body.addEventListener("touchmove", handleBookTouchMove, { passive: false });
els.body.addEventListener("touchend", handleBookTouchEnd);

document.addEventListener("keydown", (event) => {
  if (!bookMode || event.altKey || event.ctrlKey || event.metaKey) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)) return;

  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    if (els.prevSide.disabled) return;
    event.preventDefault();
    moveBookPrevious();
    return;
  }

  if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
    if (els.nextSide.disabled) return;
    event.preventDefault();
    moveBookNext();
    return;
  }

  if (event.key === "Home") {
    event.preventDefault();
    setBookPage(0);
    return;
  }

  if (event.key === "End") {
    event.preventDefault();
    setBookPage(bookPageCount - 1);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeBookMode();
    return;
  }

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    changeReaderFontSize(1);
    return;
  }

  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    changeReaderFontSize(-1);
  }
});

window.addEventListener("resize", () => scheduleBookPagination());
document.fonts?.ready?.then(() => scheduleBookPagination());

updateBookModeUi();
Promise.resolve(window.blogSession?.ready).finally(initViewer);
