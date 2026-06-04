(() => {
  const CACHE_KEY = "blog.guard.postList.snapshot";

  function readSnapshot() {
    try {
      return JSON.parse(sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSnapshot(snapshot) {
    try {
      const text = JSON.stringify(snapshot);
      sessionStorage.setItem(CACHE_KEY, text);
      localStorage.setItem(CACHE_KEY, text);
    } catch {
      // Ignore blocked storage.
    }
  }

  function hasRealRows(postList) {
    return Boolean(postList?.querySelector("[data-post-row], [data-folder-row]"));
  }

  function isOnlyEmptyState(postList) {
    return Boolean(postList?.querySelector(".blog-empty-row")) && !hasRealRows(postList);
  }

  function collectSnapshot() {
    const postList = document.querySelector("[data-post-list]");
    if (!postList || !hasRealRows(postList)) return null;

    return {
      postListHtml: postList.innerHTML,
      countText: document.querySelector("[data-blog-count]")?.textContent || "",
      boardTitleText: document.querySelector("[data-board-title]")?.textContent || "",
      featureHtml: document.querySelector("[data-feature-card]")?.innerHTML || "",
      featureHidden: document.querySelector("[data-feature-card]")?.hidden ?? true,
      miniHtml: document.querySelector("[data-blog-mini-list]")?.innerHTML || "",
      miniHidden: document.querySelector("[data-blog-mini-list]")?.hidden ?? true,
      savedAt: Date.now(),
    };
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot?.postListHtml) return false;

    const postList = document.querySelector("[data-post-list]");
    if (!postList || !isOnlyEmptyState(postList)) return false;

    postList.innerHTML = snapshot.postListHtml;

    const count = document.querySelector("[data-blog-count]");
    if (count && snapshot.countText) count.textContent = snapshot.countText;

    const boardTitle = document.querySelector("[data-board-title]");
    if (boardTitle && snapshot.boardTitleText) boardTitle.textContent = snapshot.boardTitleText;

    const feature = document.querySelector("[data-feature-card]");
    if (feature && snapshot.featureHtml) {
      feature.innerHTML = snapshot.featureHtml;
      feature.hidden = Boolean(snapshot.featureHidden);
    }

    const mini = document.querySelector("[data-blog-mini-list]");
    if (mini && snapshot.miniHtml) {
      mini.innerHTML = snapshot.miniHtml;
      mini.hidden = Boolean(snapshot.miniHidden);
    }

    console.warn("Restored cached blog post list after empty rerender.");
    return true;
  }

  function tick() {
    const current = collectSnapshot();
    if (current) {
      writeSnapshot(current);
      return;
    }

    const postList = document.querySelector("[data-post-list]");
    if (!isOnlyEmptyState(postList)) return;

    const cached = readSnapshot();
    if (cached) restoreSnapshot(cached);
  }

  function initGuard() {
    const root = document.querySelector("[data-blog-board]") || document.body;
    const observer = new MutationObserver(() => tick());
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    tick();
    window.addEventListener("pageshow", tick);
    window.addEventListener("focus", tick);
    setInterval(tick, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGuard, { once: true });
  } else {
    initGuard();
  }
})();
