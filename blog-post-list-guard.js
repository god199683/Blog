(() => {
  const CACHE_KEY = "blog.guard.postList.snapshot";
  let pendingTick = false;
  let lastSnapshotText = "";

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
      if (text === lastSnapshotText) return;
      lastSnapshotText = text;
      sessionStorage.setItem(CACHE_KEY, text);
      localStorage.setItem(CACHE_KEY, text);
    } catch {}
  }

  function textOf(selector) {
    return document.querySelector(selector)?.textContent || "";
  }

  function htmlOf(selector) {
    return document.querySelector(selector)?.innerHTML || "";
  }

  function hiddenOf(selector) {
    return document.querySelector(selector)?.hidden ?? true;
  }

  function isIntentionalEmptyScope() {
    return document.querySelector("[data-blog-board]")?.dataset.intentionalEmptyScope === "true";
  }

  function hasRealRows(postList) {
    return Boolean(postList?.querySelector("[data-post-row], [data-folder-row]"));
  }

  function hasUsefulFeature() {
    const feature = document.querySelector("[data-feature-card]");
    return Boolean(feature && !feature.hidden && feature.textContent.trim());
  }

  function hasUsefulMiniList() {
    const mini = document.querySelector("[data-blog-mini-list]");
    return Boolean(mini && !mini.hidden && mini.textContent.trim());
  }

  function countLooksNonZero() {
    return /[1-9]\d*/.test(textOf("[data-blog-count]"));
  }

  function pageLooksUseful() {
    if (isIntentionalEmptyScope()) return false;
    const postList = document.querySelector("[data-post-list]");
    return hasRealRows(postList) || hasUsefulFeature() || hasUsefulMiniList() || countLooksNonZero();
  }

  function pageLooksEmpty() {
    if (isIntentionalEmptyScope()) return false;
    const postList = document.querySelector("[data-post-list]");
    const emptyRow = Boolean(postList?.querySelector(".blog-empty-row"));
    const countLooksZero = /(^|\D)0(\D|$)/.test(textOf("[data-blog-count]"));
    return (emptyRow || countLooksZero) && !pageLooksUseful();
  }

  function collectSnapshot() {
    if (!pageLooksUseful()) return null;

    return {
      postListHtml: htmlOf("[data-post-list]"),
      countText: textOf("[data-blog-count]"),
      boardTitleText: textOf("[data-board-title]"),
      featureHtml: htmlOf("[data-feature-card]"),
      featureHidden: hiddenOf("[data-feature-card]"),
      miniHtml: htmlOf("[data-blog-mini-list]"),
      miniHidden: hiddenOf("[data-blog-mini-list]"),
      savedAt: Date.now(),
    };
  }

  function restoreSnapshot(snapshot) {
    if (isIntentionalEmptyScope()) return false;
    if (!snapshot || (!snapshot.postListHtml && !snapshot.featureHtml && !snapshot.miniHtml)) return false;
    if (!pageLooksEmpty()) return false;

    const postList = document.querySelector("[data-post-list]");
    if (postList && snapshot.postListHtml) postList.innerHTML = snapshot.postListHtml;

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

    console.warn("Restored cached blog post area after empty rerender/resume.");
    return true;
  }

  function tick() {
    if (isIntentionalEmptyScope()) return;

    const current = collectSnapshot();
    if (current) {
      writeSnapshot(current);
      return;
    }

    const cached = readSnapshot();
    if (cached) restoreSnapshot(cached);
  }

  function scheduleTick() {
    if (pendingTick) return;
    pendingTick = true;
    window.requestAnimationFrame(() => {
      pendingTick = false;
      tick();
    });
  }

  function runSoon() {
    scheduleTick();
    setTimeout(scheduleTick, 180);
    setTimeout(scheduleTick, 900);
  }

  function initGuard() {
    const root = document.querySelector("[data-blog-board]") || document.body;
    const observer = new MutationObserver(() => scheduleTick());
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "data-intentional-empty-scope"],
    });

    runSoon();
    window.addEventListener("pageshow", runSoon);
    window.addEventListener("focus", runSoon);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) runSoon();
    });
    window.addEventListener("online", runSoon);
    setInterval(scheduleTick, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGuard, { once: true });
  } else {
    initGuard();
  }
})();
