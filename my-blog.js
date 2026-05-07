const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_FILTER = "all";
const DEFAULT_CATEGORY = "카테고리";
const TREE_STORAGE_PREFIX = "blog.categoryTree.";

const state = {
  id: "",
  posts: [],
  activeNodeId: ALL_FILTER,
  error: "",
  tree: [],
  hiddenCategoryIds: new Set(),
  selectionMode: false,
  selectedIds: new Set(),
  panelCollapsedIds: new Set(),
  treePanelOpen: true,
};

const els = {
  main: document.querySelector("[data-my-blog-main]"),
  sidebar: document.querySelector("[data-sidebar]"),
  toggle: document.querySelector("[data-sidebar-toggle]"),
  treePanel: document.querySelector("[data-tree-panel]"),
  treePanelToggle: document.querySelector("[data-tree-panel-toggle]"),
  selectionToggle: document.querySelector("[data-selection-toggle]"),
  deleteSelected: document.querySelector("[data-delete-selected]"),
  nav: document.querySelector("#my-sidebar-nav"),
  title: document.querySelector("#my-post-title"),
  status: document.querySelector("#my-post-status"),
  count: document.querySelector("#my-post-count"),
  list: document.querySelector("#my-post-list"),
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "날짜 미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getSession() {
  return window.blogSession?.read?.() || null;
}

function getSessionId(session) {
  return window.blogSession?.getId?.(session) || "";
}

function normalizePost(raw, index) {
  const title = raw.title || raw.name || "제목 없는 글";
  const excerpt = raw.excerpt || raw.summary || raw.description || raw.subtitle || "";
  const category = raw.category || raw.topic || raw.tag || "일반";
  const publishedAt = raw.published_at || raw.created_at || raw.date || "";

  return {
    id: raw.id || raw.slug || `post-${index}`,
    title,
    excerpt,
    category,
    folder: raw.folder || "",
    folder_id: raw.folder_id || "",
    folder_name: raw.folder_name || "",
    folder_path: raw.folder_path || "",
    author: raw.author || raw.author_name || raw.writer || "",
    published_at: publishedAt,
    reading_time: raw.reading_time || raw.read_time || "",
  };
}

function belongsToAccount(raw, id) {
  const normalizedId = id.toLowerCase();
  return [raw.author, raw.author_name, raw.writer, raw.login_id, raw.user_id, raw.owner_id]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === normalizedId);
}

function isPublicPost(raw) {
  if (raw.published === false) return false;
  if (raw.is_published === false) return false;
  if (String(raw.status || "").toLowerCase() === "draft") return false;
  return true;
}

async function fetchPosts() {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("limit", "100");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error("");
  }

  return response.json();
}

function createId(prefix = "folder") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function categoryId(category) {
  return `category-${encodeURIComponent(String(category).toLowerCase())}`;
}

function treeStorageKey() {
  return `${TREE_STORAGE_PREFIX}${state.id || "guest"}`;
}

function safeParseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function cloneNode(node) {
  return {
    id: node.id,
    type: node.type || "folder",
    label: node.label || "폴더",
    filterCategory: node.filterCategory || "",
    children: Array.isArray(node.children) ? node.children.map(cloneNode) : [],
  };
}

function getStoredTreeData() {
  const parsed = safeParseJson(localStorage.getItem(treeStorageKey()), []);
  if (Array.isArray(parsed)) {
    return { nodes: parsed, hiddenCategoryIds: [] };
  }

  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    hiddenCategoryIds: Array.isArray(parsed.hiddenCategoryIds) ? parsed.hiddenCategoryIds : [],
  };
}

function saveTree() {
  if (!state.id) return;
  localStorage.setItem(
    treeStorageKey(),
    JSON.stringify({
      nodes: state.tree,
      hiddenCategoryIds: [...state.hiddenCategoryIds],
    })
  );
}

function flattenNodes(nodes, map = new Map()) {
  nodes.forEach((node) => {
    map.set(node.id, node);
    flattenNodes(node.children || [], map);
  });
  return map;
}

function getCategories() {
  const categories = [...new Set(state.posts.map((post) => post.category).filter(Boolean))];
  return categories.length ? categories : [DEFAULT_CATEGORY];
}

function createAllNode(storedNode) {
  return {
    id: ALL_FILTER,
    type: "all",
    label: storedNode?.label || "전체",
    filterCategory: "",
    children: Array.isArray(storedNode?.children) ? storedNode.children.map(cloneNode) : [],
  };
}

function createCategoryNode(category, storedNode) {
  return {
    id: categoryId(category),
    type: "category",
    label: storedNode?.label || category,
    filterCategory: storedNode?.filterCategory || category,
    children: Array.isArray(storedNode?.children) ? storedNode.children.map(cloneNode) : [],
  };
}

function buildTree() {
  const stored = getStoredTreeData();
  const storedById = flattenNodes(stored.nodes.map(cloneNode));
  state.hiddenCategoryIds = new Set(stored.hiddenCategoryIds);

  const roots = [createAllNode(storedById.get(ALL_FILTER))];

  getCategories().forEach((category) => {
    const id = categoryId(category);
    if (state.hiddenCategoryIds.has(id)) return;
    roots.push(createCategoryNode(category, storedById.get(id)));
  });

  state.tree = roots;

  if (!findNode(state.tree, state.activeNodeId)) {
    state.activeNodeId = ALL_FILTER;
  }
}

function findNode(nodes, id, parent = null, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];
    if (node.id === id) {
      return { node, parent, path: nextPath };
    }

    const found = findNode(node.children || [], id, node, nextPath);
    if (found) return found;
  }

  return null;
}

function getNodePathLabels(nodeId) {
  const found = findNode(state.tree, nodeId);
  if (!found) return [];
  return found.path
    .filter((node) => node.type !== "all")
    .map((node) => node.label)
    .filter(Boolean);
}

function postMatchesFolder(post, node) {
  const nodePath = getNodePathLabels(node.id).join("/");
  const targets = [node.id, node.label, nodePath].map((value) => String(value).toLowerCase());
  return [post.folder_id, post.folder, post.folder_name, post.folder_path]
    .filter(Boolean)
    .some((value) => targets.includes(String(value).toLowerCase()));
}

function getNodePosts(node) {
  if (!node || node.type === "all") return state.posts;
  if (node.type === "category") {
    return state.posts.filter((post) => post.category === node.filterCategory);
  }

  return state.posts.filter((post) => postMatchesFolder(post, node));
}

function getActiveNode() {
  return findNode(state.tree, state.activeNodeId)?.node || state.tree[0];
}

function getFilteredPosts() {
  return getNodePosts(getActiveNode());
}

function getActivePanelTitle() {
  const node = getActiveNode();
  if (!node || node.id === ALL_FILTER) return "전체 카테고리";
  return node.label || "전체 카테고리";
}

function getActivePanelType() {
  const node = getActiveNode();
  if (!node || node.id === ALL_FILTER) return "전체";
  return node.type === "folder" ? "폴더" : "카테고리";
}

function isSelectableNode(node) {
  return node.id !== ALL_FILTER;
}

function renderTree(nodes = state.tree, depth = 0) {
  return nodes
    .map((node) => {
      const isActive = node.id === state.activeNodeId;
      const isSelected = state.selectedIds.has(node.id);
      const children = Array.isArray(node.children) ? node.children : [];
      const count = getNodePosts(node).length;
      const checkbox = state.selectionMode && isSelectableNode(node)
        ? `<input class="tree-check" type="checkbox" data-tree-check="${escapeHtml(node.id)}" ${isSelected ? "checked" : ""} aria-label="${escapeHtml(node.label)} 선택">`
        : "";

      return `
        <div class="tree-node" style="--tree-depth:${depth}">
          <div class="tree-row ${isActive ? "is-active" : ""}">
            ${checkbox}
            <button class="tree-row-main" type="button" data-node-select="${escapeHtml(node.id)}" title="${escapeHtml(node.label)}">
              <span class="tree-node-icon" aria-hidden="true">${node.type === "folder" ? "□" : "▤"}</span>
              <span class="tree-node-label">${escapeHtml(node.label)}</span>
              <span class="tree-node-count">${count}</span>
            </button>
            <div class="tree-row-actions">
              <button type="button" data-add-folder="${escapeHtml(node.id)}" aria-label="폴더 추가" title="폴더 추가">+</button>
              <button type="button" data-rename-node="${escapeHtml(node.id)}" aria-label="이름 수정" title="이름 수정">✎</button>
            </div>
          </div>
          ${children.length ? `<div class="tree-children">${renderTree(children, depth + 1)}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderTreePanelState() {
  els.treePanel.classList.toggle("is-collapsed", !state.treePanelOpen);
  els.treePanelToggle.setAttribute("aria-expanded", String(state.treePanelOpen));
  els.treePanelToggle.setAttribute("aria-label", state.treePanelOpen ? "트리 접기" : "트리 펼치기");
  els.treePanelToggle.textContent = state.treePanelOpen ? "▾" : "▸";
  els.selectionToggle.classList.toggle("is-active", state.selectionMode);
  els.selectionToggle.textContent = state.selectionMode ? "선택 해제" : "선택 모드";
  els.deleteSelected.disabled = state.selectedIds.size === 0;
}

function renderSidebar() {
  els.nav.innerHTML = renderTree();
  renderTreePanelState();
}

function renderPostPanel(content, isEmpty = false) {
  return `
    <section class="post-panel">
      <div class="post-panel-head">
        <div>
          <p class="post-panel-kicker">${escapeHtml(getActivePanelType())}</p>
          <h2>${escapeHtml(getActivePanelTitle())}</h2>
        </div>
      </div>
      <div class="post-panel-body ${isEmpty ? "is-empty" : ""}">
        ${content}
      </div>
    </section>
  `;
}

function renderPostItems(posts) {
  return posts
    .map(
      (post) => `
        <article class="my-post-item">
          <div>
            <p class="meta-line">${escapeHtml(post.category)} · ${formatDate(post.published_at)}</p>
            <h3>${escapeHtml(post.title)}</h3>
            ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}
          </div>
          ${post.reading_time ? `<span class="tag">${escapeHtml(post.reading_time)}</span>` : ""}
        </article>
      `
    )
    .join("");
}

function renderPanelFolders(nodes = [], depth = 0) {
  const folders = nodes.filter((node) => node.type === "folder");
  if (folders.length === 0) return "";

  return `
    <div class="panel-folder-tree">
      ${folders
        .map((node) => {
          const isOpen = !state.panelCollapsedIds.has(node.id);
          const isActive = state.activeNodeId === node.id;
          const childFolders = renderPanelFolders(node.children || [], depth + 1);
          const posts = renderPostItems(getNodePosts(node));
          const content = [childFolders, posts].filter(Boolean).join("");

          return `
            <section class="panel-folder ${isActive ? "is-active" : ""}" style="--panel-depth:${depth}">
              <div class="panel-folder-row">
                <button
                  class="panel-folder-toggle"
                  type="button"
                  data-panel-folder-toggle="${escapeHtml(node.id)}"
                  aria-label="${escapeHtml(node.label)} ${isOpen ? "접기" : "펼치기"}"
                  aria-expanded="${String(isOpen)}"
                >
                  ${isOpen ? "▾" : "▸"}
                </button>
                <button
                  class="panel-folder-title"
                  type="button"
                  data-panel-folder-select="${escapeHtml(node.id)}"
                  title="${escapeHtml(node.label)}"
                >
                  <span class="panel-folder-icon" aria-hidden="true">□</span>
                  <span class="panel-folder-name">${escapeHtml(node.label)}</span>
                  <span class="panel-folder-count">${getNodePosts(node).length}개 글</span>
                </button>
              </div>
              ${isOpen ? `<div class="panel-folder-content">${content}</div>` : ""}
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderActiveNodeContent(posts) {
  const activeNode = getActiveNode();
  const folders = renderPanelFolders(activeNode?.children || []);
  const postItems = renderPostItems(posts);
  return [folders, postItems].filter(Boolean).join("");
}

function renderList() {
  const posts = getFilteredPosts();
  els.count.textContent = `${posts.length}개 글`;

  if (!state.id) {
    els.status.innerHTML = `<a href="./login.html">로그인하면 내 블로그를 사용할 수 있습니다.</a>`;
    els.list.innerHTML = renderPostPanel(
      `
        <div class="empty-state">
          <h3>로그인이 필요합니다</h3>
        </div>
      `,
      true
    );
    return;
  }

  els.status.textContent = state.error || "";

  const content = renderActiveNodeContent(posts);

  if (!content) {
    els.list.innerHTML = renderPostPanel(
      `
        <div class="empty-state">
          <h3>표시할 글이 없습니다</h3>
        </div>
      `,
      true
    );
    return;
  }

  els.list.innerHTML = renderPostPanel(content);
}

function render() {
  renderSidebar();
  renderList();
}

function toggleSidebar() {
  const collapsed = !els.main.classList.contains("is-sidebar-collapsed");
  els.main.classList.toggle("is-sidebar-collapsed", collapsed);
  els.toggle.setAttribute("aria-expanded", String(!collapsed));
  els.toggle.setAttribute("aria-label", collapsed ? "사이드바 펼치기" : "사이드바 접기");
  els.toggle.textContent = collapsed ? "›" : "‹";
}

function addFolder(parentId) {
  const found = findNode(state.tree, parentId);
  if (!found) return;

  const name = window.prompt("새 폴더 이름을 입력해주세요.", "새 폴더");
  const label = name?.trim();
  if (!label) return;

  found.node.children = [
    ...(found.node.children || []),
    {
      id: createId(),
      type: "folder",
      label,
      filterCategory: "",
      children: [],
    },
  ];

  saveTree();
  render();
}

function renameNode(nodeId) {
  const found = findNode(state.tree, nodeId);
  if (!found) return;

  const name = window.prompt("새 이름을 입력해주세요.", found.node.label);
  const label = name?.trim();
  if (!label) return;

  found.node.label = label;
  saveTree();
  render();
}

function removeSelectedNodes(nodes) {
  return nodes
    .filter((node) => {
      const shouldRemove = state.selectedIds.has(node.id) && isSelectableNode(node);
      if (shouldRemove && node.type === "category") {
        state.hiddenCategoryIds.add(node.id);
      }
      return !shouldRemove;
    })
    .map((node) => ({
      ...node,
      children: removeSelectedNodes(node.children || []),
    }));
}

function deleteSelectedNodes() {
  if (state.selectedIds.size === 0) return;

  const confirmed = window.confirm("선택한 항목을 삭제할까요?");
  if (!confirmed) return;

  state.tree = removeSelectedNodes(state.tree);
  state.selectedIds.forEach((id) => state.panelCollapsedIds.delete(id));
  state.selectedIds.clear();

  if (!findNode(state.tree, state.activeNodeId)) {
    state.activeNodeId = ALL_FILTER;
  }

  saveTree();
  render();
}

async function initMyBlog() {
  const session = getSession();
  state.id = getSessionId(session);

  if (state.id) {
    els.title.textContent = "내 글 목록";
  } else {
    els.title.textContent = "로그인이 필요합니다";
  }

  try {
    const rows = state.id ? await fetchPosts() : [];
    state.posts = rows
      .filter(isPublicPost)
      .filter((post) => belongsToAccount(post, state.id))
      .map(normalizePost)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  } catch (error) {
    state.error = error.message;
    state.posts = [];
  }

  buildTree();
  render();
}

els.toggle.addEventListener("click", toggleSidebar);

els.treePanelToggle.addEventListener("click", () => {
  state.treePanelOpen = !state.treePanelOpen;
  renderTreePanelState();
});

els.selectionToggle.addEventListener("click", () => {
  state.selectionMode = !state.selectionMode;
  state.selectedIds.clear();
  render();
});

els.deleteSelected.addEventListener("click", deleteSelectedNodes);

els.nav.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-folder]");
  if (addButton) {
    addFolder(addButton.dataset.addFolder);
    return;
  }

  const renameButton = event.target.closest("[data-rename-node]");
  if (renameButton) {
    renameNode(renameButton.dataset.renameNode);
    return;
  }

  const selectButton = event.target.closest("[data-node-select]");
  if (!selectButton) return;
  state.activeNodeId = selectButton.dataset.nodeSelect;
  render();
});

els.nav.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-tree-check]");
  if (!checkbox) return;

  if (checkbox.checked) {
    state.selectedIds.add(checkbox.dataset.treeCheck);
  } else {
    state.selectedIds.delete(checkbox.dataset.treeCheck);
  }

  renderTreePanelState();
});

els.list.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-panel-folder-toggle]");
  if (toggleButton) {
    const id = toggleButton.dataset.panelFolderToggle;
    if (state.panelCollapsedIds.has(id)) {
      state.panelCollapsedIds.delete(id);
    } else {
      state.panelCollapsedIds.add(id);
    }
    renderList();
    return;
  }

  const selectButton = event.target.closest("[data-panel-folder-select]");
  if (!selectButton) return;
  state.activeNodeId = selectButton.dataset.panelFolderSelect;
  render();
});

initMyBlog();
