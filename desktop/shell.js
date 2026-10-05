(() => {
  const tabList = document.querySelector("[data-tab-list]");
  const panelHost = document.querySelector("[data-tab-panels]");
  const refreshButton = document.querySelector("[data-refresh-tab]");
  const newTabButton = document.querySelector("[data-new-tab]");
  const splitButton = document.querySelector("[data-split-tab]");
  const autoLaunchButton = document.querySelector("[data-auto-launch]");
  const TAB_STATE_KEY = "blog.desktopTabs.v1";
  const tabs = [];
  let activeId = null;
  let split = false;
  let fixedLeftId = null;
  let tabCycleIndex = 0;
  let dragId = null;

  function sameOriginUrl(value) {
    try {
      const url = new URL(value || "/ebook-reader.html", window.location.origin);
      return url.origin === window.location.origin ? url.href : new URL("/ebook-reader.html", window.location.origin).href;
    } catch {
      return new URL("/ebook-reader.html", window.location.origin).href;
    }
  }

  function titleFor(url) {
    const path = new URL(url).pathname;
    if (path.endsWith("ebook-reader.html") || path.endsWith("viewer.html")) return "책 뷰어";
    if (path.endsWith("editor.html")) return "글쓰기";
    if (path.endsWith("my-blog.html")) return "내 블로그";
    return "블로그 홈";
  }

  function getTab(id) { return tabs.find((tab) => tab.id === id); }

  function getTabUrl(tab) {
    if (!tab.loaded) return tab.source;
    try {
      return sameOriginUrl(tab.panel.contentWindow?.location?.href || tab.panel.src);
    } catch {
      return tab.source;
    }
  }

  function loadTab(tab) {
    if (!tab || tab.loaded) return;
    tab.loaded = true;
    tab.panel.src = tab.source;
  }

  function saveTabState() {
    if (tabs.length === 0) return;
    try {
      localStorage.setItem(
        TAB_STATE_KEY,
        JSON.stringify({
          activeIndex: tabCycleIndex,
          split,
          tabs: tabs.map((tab) => ({ url: getTabUrl(tab) })),
        })
      );
    } catch {
      // The program can continue even when local storage is unavailable.
    }
  }

  function readTabState() {
    try {
      const saved = JSON.parse(localStorage.getItem(TAB_STATE_KEY) || "null");
      if (!Array.isArray(saved?.tabs) || saved.tabs.length === 0) return null;
      return {
        tabs: saved.tabs.slice(0, 8).map((tab) => sameOriginUrl(tab?.url)),
        activeIndex: Math.max(0, Number.parseInt(saved.activeIndex, 10) || 0),
        split: Boolean(saved.split),
      };
    } catch {
      return null;
    }
  }

  function fixedLeftTab() {
    return getTab(fixedLeftId);
  }

  function focusTabPanel(tab) {
    if (!tab) return;
    window.requestAnimationFrame(() => {
      tab.panel.focus();
      tab.panel.contentWindow?.postMessage(
        { type: "desktop-tab-activated" },
        window.location.origin
      );
    });
  }

  function render() {
    let fixedLeft = split ? fixedLeftTab() : null;
    if (split && (!fixedLeft || fixedLeft.id === activeId)) {
      fixedLeft = tabs.find((tab) => tab.id !== activeId) || null;
      fixedLeftId = fixedLeft?.id || null;
    }
    if (split && !fixedLeft) {
      split = false;
      fixedLeftId = null;
    }
    panelHost.classList.toggle("is-split", split);
    splitButton.classList.toggle("is-active", split);
    splitButton.setAttribute("aria-pressed", String(split));

    tabs.forEach((tab) => {
      const visible = tab.id === activeId || tab.id === fixedLeft?.id;
      const isCycleTarget = tab.id === tabs[tabCycleIndex]?.id;
      const pane = !split
        ? ""
        : tab.id === fixedLeft?.id
          ? "left"
          : tab.id === activeId
            ? "right"
            : "";
      if (visible) loadTab(tab);
      tab.panel.classList.toggle("is-visible", visible);
      tab.panel.classList.toggle("is-cycle-target", isCycleTarget);
      tab.panel.dataset.splitPane = pane;
      tab.panel.style.order = pane === "left" ? "0" : pane === "right" ? "1" : "";
      tab.button.classList.toggle("is-active", isCycleTarget);
      tab.button.classList.toggle("is-paired", tab.id === fixedLeft?.id);
      tab.button.setAttribute("aria-current", isCycleTarget ? "page" : "false");
      tab.panel.contentWindow?.postMessage({ type: "desktop-tab-visibility", visible }, window.location.origin);
    });
  }

  function activate(id, { focusPanel = false } = {}) {
    const tab = getTab(id);
    if (!tab) return;
    const index = tabs.findIndex((item) => item.id === id);
    if (index < 0) return;
    tabCycleIndex = index;
    if (!split || id !== fixedLeftId) activeId = id;
    render();
    saveTabState();
    if (focusPanel) {
      focusTabPanel(tab);
    }
  }

  function cycleTab(direction = 1) {
    if (tabs.length < 2) return;
    tabCycleIndex = Math.min(Math.max(tabCycleIndex, 0), tabs.length - 1);
    tabCycleIndex = (tabCycleIndex + direction + tabs.length) % tabs.length;
    const selectedTab = tabs[tabCycleIndex];
    if (!split || selectedTab.id !== fixedLeftId) {
      activeId = selectedTab.id;
    }
    render();
    saveTabState();
    focusTabPanel(selectedTab);
  }

  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const [tab] = tabs.splice(index, 1);
    tab.button.remove();
    tab.panel.remove();
    if (!tabs.length) {
      openTab("/");
      return;
    }
    if (activeId === id) {
      activeId = tabs.find((item) => item.id !== fixedLeftId)?.id || tabs[Math.max(0, index - 1)].id;
    }
    if (fixedLeftId === id) fixedLeftId = null;
    tabCycleIndex = Math.min(tabCycleIndex, tabs.length - 1);
    render();
    saveTabState();
  }

  function moveTab(draggedId, targetId, placeAfter) {
    const draggedIndex = tabs.findIndex((tab) => tab.id === draggedId);
    const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return;

    const [dragged] = tabs.splice(draggedIndex, 1);
    const adjustedTargetIndex = tabs.findIndex((tab) => tab.id === targetId);
    const insertionIndex = adjustedTargetIndex + (placeAfter ? 1 : 0);
    tabs.splice(insertionIndex, 0, dragged);
    tabList.insertBefore(dragged.button, tabs[insertionIndex + 1]?.button || null);
    saveTabState();
  }

  function openTab(url = "/", { activateTab = true, persist = true } = {}) {
    const source = sameOriginUrl(url);
    const id = `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const button = document.createElement("div");
    button.className = "desktop-tab";
    button.draggable = true;
    const label = document.createElement("button");
    label.className = "desktop-tab-label";
    label.type = "button";
    label.textContent = titleFor(source);
    const close = document.createElement("button");
    close.className = "desktop-tab-close";
    close.type = "button";
    close.textContent = "×";
    close.title = "탭 닫기";
    close.setAttribute("aria-label", "탭 닫기");
    button.append(label, close);

    const panel = document.createElement("iframe");
    panel.className = "desktop-panel";
    panel.title = label.textContent;
    panel.addEventListener("load", () => {
      try {
        const pageTitle = panel.contentDocument?.title?.replace(/\s*\|.*$/u, "").trim();
        if (pageTitle) label.textContent = pageTitle;
      } catch {}
      try {
        panel.contentDocument?.addEventListener(
          "pointerdown",
          () => {
            // A visible pane can be clicked without changing the right-hand
            // pane in split view.  Still make the clicked page the selected
            // tab so the tab bar always reflects where the cursor is working.
            if (tabs[tabCycleIndex]?.id !== id) activate(id);
          },
          true
        );
      } catch {}
      render();
      saveTabState();
    });

    const tab = { id, button, panel, source, loaded: false };
    label.addEventListener("click", () => activate(id));
    close.addEventListener("click", () => closeTab(id));
    close.addEventListener("dragstart", (event) => event.preventDefault());
    button.addEventListener("dragstart", (event) => {
      if (event.target === close) {
        event.preventDefault();
        return;
      }
      dragId = id;
      button.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    });
    button.addEventListener("dragend", () => {
      dragId = null;
      button.classList.remove("is-dragging");
      tabList.querySelectorAll(".is-drop-target").forEach((tabButton) => tabButton.classList.remove("is-drop-target"));
    });
    button.addEventListener("dragover", (event) => {
      if (!dragId || dragId === id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      button.classList.add("is-drop-target");
    });
    button.addEventListener("dragleave", () => button.classList.remove("is-drop-target"));
    button.addEventListener("drop", (event) => {
      if (!dragId || dragId === id) return;
      event.preventDefault();
      const bounds = button.getBoundingClientRect();
      moveTab(dragId, id, event.clientX > bounds.left + bounds.width / 2);
      button.classList.remove("is-drop-target");
    });
    tabList.append(button);
    panelHost.append(panel);
    tabs.push(tab);
    if (activateTab) activate(id);
    else render();
    if (persist) saveTabState();
    return tab;
  }

  function toggleSplit() {
    if (!split) {
      fixedLeftId = tabs[0]?.id || null;
      if (tabs.length < 2) openTab("/", { activateTab: false });
      activeId = tabs.find((tab) => tab.id !== fixedLeftId)?.id || fixedLeftId;
      tabCycleIndex = 0;
      split = Boolean(fixedLeftId && activeId && fixedLeftId !== activeId);
    } else {
      split = false;
      fixedLeftId = null;
    }
    render();
    saveTabState();
  }

  function refreshActiveTab() {
    const activeTab = tabs[tabCycleIndex] || getTab(activeId);
    if (!activeTab) return;
    loadTab(activeTab);
    try {
      activeTab.panel.contentWindow.location.reload();
    } catch {
      activeTab.panel.src = getTabUrl(activeTab);
    }
  }

  function syncAutoLaunchButton(enabled) {
    if (!autoLaunchButton) return;
    autoLaunchButton.hidden = false;
    autoLaunchButton.classList.toggle("is-active", Boolean(enabled));
    autoLaunchButton.dataset.state = enabled ? "on" : "off";
    autoLaunchButton.setAttribute("aria-pressed", String(Boolean(enabled)));
    autoLaunchButton.setAttribute("aria-label", enabled ? "자동 실행 끄기" : "자동 실행 켜기");
    autoLaunchButton.title = enabled ? "자동 실행: 켜짐" : "자동 실행: 꺼짐";
  }

  async function initAutoLaunch() {
    if (!window.desktopApp?.getAutoLaunch || !autoLaunchButton) return;
    try {
      syncAutoLaunchButton(await window.desktopApp.getAutoLaunch());
    } catch {
      autoLaunchButton.hidden = true;
    }
  }

  refreshButton.addEventListener("click", refreshActiveTab);
  newTabButton.addEventListener("click", () => openTab());
  splitButton.addEventListener("click", toggleSplit);
  autoLaunchButton?.addEventListener("click", async () => {
    if (!window.desktopApp?.setAutoLaunch) return;
    autoLaunchButton.disabled = true;
    try {
      syncAutoLaunchButton(await window.desktopApp.setAutoLaunch(autoLaunchButton.getAttribute("aria-pressed") !== "true"));
    } finally {
      autoLaunchButton.disabled = false;
    }
  });
  initAutoLaunch();
  window.desktopTabs = { openTab, toggleSplit, refreshActiveTab, cycleTab };
  window.addEventListener("beforeunload", saveTabState);

  const savedTabState = readTabState();
  if (savedTabState) {
    savedTabState.tabs.forEach((url) => openTab(url, { activateTab: false, persist: false }));
    tabCycleIndex = Math.min(savedTabState.activeIndex, tabs.length - 1);
    activeId = tabs[tabCycleIndex]?.id || tabs[0]?.id || null;
    split = savedTabState.split && tabs.length > 1;
    if (split) {
      fixedLeftId = tabs[0]?.id || null;
      if (fixedLeftId === activeId) {
        activeId = tabs.find((tab) => tab.id !== fixedLeftId)?.id || fixedLeftId;
      }
    }
    render();
  } else {
    openTab("/");
  }
})();
