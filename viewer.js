const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const params = new URLSearchParams(window.location.search);
const postId = params.get("id") || "";
let bookMode = params.get("book") === "1";
let readerFontSize = Number.parseInt(localStorage.getItem("blog.readerFontSize") || "18", 10);
let readerFont = localStorage.getItem("blog.readerFont") || "serif";
let currentPost = null;
let sameFolderPosts = [];
let bookPageIndex = 0;
let bookPageCount = 1;
let bookPageStep = 0;
let pendingBookPage = params.get("page") || "";
let paginationFrame = 0;

const els = {
  title: document.querySelector("[data-viewer-title]"),
  location: document.querySelector("[data-viewer-location]"),
  body: document.querySelector("[data-viewer-body]"),
  message: document.querySelector("[data-viewer-message]"),
  back: document.querySelector("[data-viewer-back]"),
  edit: document.querySelector("[data-viewer-edit]"),
  bookToggle: document.querySelector("[data-viewer-book-toggle]"),
  readerControls: document.querySelector("[data-viewer-reader-controls]"),
  fontSelect: document.querySelector("[data-viewer-font]"),
  fontDown: document.querySelector("[data-viewer-font-down]"),
  fontUp: document.querySelector("[data-viewer-font-up]"),
  fontSize: document.querySelector("[data-viewer-font-size]"),
  bookClose: document.querySelector("[data-viewer-book-close]"),
  bookNav: document.querySelector("[data-viewer-book-nav]"),
  prev: document.querySelector("[data-viewer-prev]"),
  next: document.querySelector("[data-viewer-next]"),
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
    const timeDiff = getPostSortTime(a) - getPostSortTime(b);
    if (timeDiff !== 0) return timeDiff;
    return String(a.title || "").localeCompare(String(b.title || ""), "ko");
  });
}

function getPostOwnerFilter(post) {
  if (post.user_id) return ["user_id", post.user_id];
  if (post.login_id) return ["login_id", post.login_id];
  if (post.author) return ["author", post.author];
  return null;
}

function buildViewerUrl(nextPostId, useBookMode = bookMode, pageTarget = "") {
  const nextParams = new URLSearchParams();
  nextParams.set("id", nextPostId);
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

function syncReaderControls() {
  readerFontSize = clampReaderFontSize(readerFontSize);
  document.body.style.setProperty("--reader-font-size", `${readerFontSize}px`);
  document.body.dataset.readerFont = readerFont;
  els.fontSize.textContent = `${readerFontSize}px`;
  els.fontSelect.value = readerFont;
  localStorage.setItem("blog.readerFontSize", String(readerFontSize));
  localStorage.setItem("blog.readerFont", readerFont);
}

function updateBookModeUi() {
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

  const bodyStyle = window.getComputedStyle(els.body);
  const horizontalPadding = Number.parseFloat(bodyStyle.paddingLeft) + Number.parseFloat(bodyStyle.paddingRight);
  const verticalPadding = Number.parseFloat(bodyStyle.paddingTop) + Number.parseFloat(bodyStyle.paddingBottom);
  const pageWidth = Math.max(260, Math.floor(els.body.clientWidth - horizontalPadding));
  const pageHeight = Math.max(260, Math.floor(els.body.clientHeight - verticalPadding));
  const pageGap = Math.round(Math.min(80, Math.max(28, pageWidth * 0.06)));

  content.style.width = `${pageWidth}px`;
  content.style.height = `${pageHeight}px`;
  content.style.columnWidth = `${pageWidth}px`;
  content.style.columnGap = `${pageGap}px`;
  bookPageStep = pageWidth + pageGap;

  bookPageCount = Math.max(1, Math.ceil((content.scrollWidth + pageGap) / bookPageStep));
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

  els.position.textContent = `${bookPageIndex + 1} / ${bookPageCount}`;
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

async function fetchSameFolderPosts(post) {
  const session = getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set(
    "select",
    "id,title,category,author,login_id,user_id,folder,folder_id,folder_name,folder_path,published,published_at,created_at"
  );
  endpoint.searchParams.set("limit", "1000");
  endpoint.searchParams.set("order", "published_at.asc.nullslast,created_at.asc.nullslast");

  const ownerFilter = getPostOwnerFilter(post);
  if (ownerFilter) {
    endpoint.searchParams.set(ownerFilter[0], `eq.${ownerFilter[1]}`);
  }
  if (post.category) {
    endpoint.searchParams.set("category", `eq.${post.category}`);
  }
  if (post.folder_id) {
    endpoint.searchParams.set("folder_id", `eq.${post.folder_id}`);
  } else if (post.folder_name) {
    endpoint.searchParams.set("folder_name", `eq.${post.folder_name}`);
  } else if (post.folder) {
    endpoint.searchParams.set("folder", `eq.${post.folder}`);
  } else {
    endpoint.searchParams.set("folder_id", "is.null");
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
  data.forEach((item) => {
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
  window.location.href = "./my-blog.html";
});

els.edit.addEventListener("click", () => {
  if (!postId) return;
  window.location.href = `./editor.html?post=${encodeURIComponent(postId)}`;
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

els.fontSelect.addEventListener("change", (event) => {
  readerFont = event.target.value === "sans" ? "sans" : "serif";
  syncReaderControls();
  scheduleBookPagination();
});

els.fontDown.addEventListener("click", () => {
  changeReaderFontSize(-1);
});

els.fontUp.addEventListener("click", () => {
  changeReaderFontSize(1);
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
