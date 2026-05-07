const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_FILTER = "all";
const DEFAULT_CATEGORY = "전체";
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
  treeCollapsedIds: new Set(),
  panelCollapsedIds: new Set(),
  deleteBusy: false,
  editingNodeId: "",
  storedTreeData: null,
};

const els = {
  main: document.querySelector("[data-my-blog-main]"),
  sidebar: document.querySelector("[data-sidebar]"),
  toggle: document.querySelector("[data-sidebar-toggle]"),
  categoryAdd: document.querySelector("[data-add-category]"),
  selectionToggle: document.querySelector("[data-selection-toggle]"),
  deleteSelected: document.querySelector("[data-delete-selected]"),
  nav: document.querySelector("#my-sidebar-nav"),
  title: document.querySelector("#my-post-title"),
  status: document.querySelector("#my-post-status"),
  count: document.querySelector("#my-post-count"),
  list: document.querySelector("#my-post-list"),
  writeButton: document.querySelector("[data-write-post]"),
  importInput: document.querySelector("[data-blog-import]"),
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
    user_id: raw.user_id || "",
    login_id: raw.login_id || "",
    body: raw.body || raw.content || "",
    cover_image: raw.cover_image || raw.image_url || "",
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
  const token = getSession()?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("");
  }

  return response.json();
}

async function deletePostFromSupabase(id) {
  const session = getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("id", `eq.${id}`);

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
    },
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || "Supabase에서 글을 삭제하지 못했습니다.";
    throw new Error(message);
  }

  return Array.isArray(data) ? data.length : 0;
}

async function deletePostsFromSupabase(postIds) {
  if (postIds.length === 0) return 0;

  let deletedCount = 0;
  for (const id of postIds) {
    deletedCount += await deletePostFromSupabase(id);
  }

  if (deletedCount < postIds.length) {
    throw new Error("일부 글을 Supabase에서 삭제하지 못했습니다. 권한 또는 SQL 정책을 확인해주세요.");
  }

  return deletedCount;
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
    return { nodes: parsed, hiddenCategoryIds: [], treeCollapsedIds: [] };
  }

  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    hiddenCategoryIds: Array.isArray(parsed.hiddenCategoryIds) ? parsed.hiddenCategoryIds : [],
    treeCollapsedIds: Array.isArray(parsed.treeCollapsedIds) ? parsed.treeCollapsedIds : [],
  };
}

function hasTreeData(data) {
  return Boolean(
    data?.nodes?.some((node) => node.id !== ALL_FILTER || (node.children || []).length > 0) ||
      data?.hiddenCategoryIds?.length ||
      data?.treeCollapsedIds?.length
  );
}

function normalizeTreeData(data) {
  return {
    nodes: Array.isArray(data?.nodes) ? data.nodes.map(cloneNode) : [],
    hiddenCategoryIds: Array.isArray(data?.hiddenCategoryIds) ? data.hiddenCategoryIds : [],
    treeCollapsedIds: Array.isArray(data?.treeCollapsedIds) ? data.treeCollapsedIds : [],
  };
}

function saveTreeDataToLocal(data) {
  if (!state.id) return;
  localStorage.setItem(treeStorageKey(), JSON.stringify(normalizeTreeData(data)));
}

async function fetchTreeDataFromSupabase() {
  const session = getSession();
  if (!session?.access_token || !session.user?.id) return null;

  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_trees`);
  endpoint.searchParams.set("select", "tree,hidden_category_ids,tree_collapsed_ids");
  endpoint.searchParams.set("user_id", `eq.${session.user.id}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) return null;

  const rows = await response.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  return normalizeTreeData({
    nodes: row.tree,
    hiddenCategoryIds: row.hidden_category_ids,
    treeCollapsedIds: row.tree_collapsed_ids,
  });
}

async function saveTreeDataToSupabase(data) {
  const session = getSession();
  if (!session?.access_token || !session.user?.id || !state.id) return;

  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_trees`);
  endpoint.searchParams.set("on_conflict", "user_id");

  const normalized = normalizeTreeData(data);
  await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      login_id: state.id,
      tree: normalized.nodes,
      hidden_category_ids: normalized.hiddenCategoryIds,
      tree_collapsed_ids: normalized.treeCollapsedIds,
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

async function loadTreeData() {
  const local = getStoredTreeData();
  const remote = await fetchTreeDataFromSupabase();

  if (hasTreeData(remote)) {
    saveTreeDataToLocal(remote);
    return remote;
  }

  if (hasTreeData(local)) {
    saveTreeDataToLocal(local);
    saveTreeDataToSupabase(local);
    return local;
  }

  return remote || local;
}

function saveTree() {
  if (!state.id) return;
  const data = normalizeTreeData({
    nodes: state.tree,
    hiddenCategoryIds: [...state.hiddenCategoryIds],
    treeCollapsedIds: [...state.treeCollapsedIds],
  });
  state.storedTreeData = data;
  saveTreeDataToLocal(data);
  saveTreeDataToSupabase(data);
}

function flattenNodes(nodes, map = new Map()) {
  nodes.forEach((node) => {
    map.set(node.id, node);
    flattenNodes(node.children || [], map);
  });
  return map;
}

function getCategories() {
  return [...new Set(state.posts.map((post) => post.category).filter(Boolean))].filter(
    (category) => category !== DEFAULT_CATEGORY
  );
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
  const stored = state.storedTreeData || getStoredTreeData();
  const storedById = flattenNodes(stored.nodes.map(cloneNode));
  state.hiddenCategoryIds = new Set(stored.hiddenCategoryIds);
  state.treeCollapsedIds = new Set(stored.treeCollapsedIds);

  const roots = [createAllNode(storedById.get(ALL_FILTER))];
  const categoryIds = new Set();

  getCategories().forEach((category) => {
    const id = categoryId(category);
    categoryIds.add(id);
    if (state.hiddenCategoryIds.has(id)) return;
    roots.push(createCategoryNode(category, storedById.get(id)));
  });

  stored.nodes
    .map(cloneNode)
    .filter(
      (node) =>
        node.type === "category" &&
        node.id !== ALL_FILTER &&
        !categoryIds.has(node.id) &&
        !state.hiddenCategoryIds.has(node.id) &&
        (node.filterCategory || node.label) !== DEFAULT_CATEGORY
    )
    .forEach((node) => roots.push(node));

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
  if (!node || node.id === ALL_FILTER) return "전체";
  return node.label || "전체";
}

function openEditor() {
  if (!state.id) {
    window.location.href = "./login.html";
    return;
  }

  const params = new URLSearchParams();
  if (state.activeNodeId && state.activeNodeId !== ALL_FILTER) {
    params.set("node", state.activeNodeId);
  }
  const query = params.toString();
  window.location.href = `./editor.html${query ? `?${query}` : ""}`;
}

function toggleSelectionMode() {
  state.selectionMode = !state.selectionMode;
  state.selectedIds.clear();
  render();
}

function isSelectableNode(node) {
  return node.id !== ALL_FILTER;
}

function exportBlogData() {
  const treeData = normalizeTreeData({
    nodes: state.tree,
    hiddenCategoryIds: [...state.hiddenCategoryIds],
    treeCollapsedIds: [...state.treeCollapsedIds],
  });
  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    login_id: state.id,
    tree: treeData.nodes,
    hidden_category_ids: treeData.hiddenCategoryIds,
    tree_collapsed_ids: treeData.treeCollapsedIds,
    posts: state.posts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeId = (state.id || "blog").replace(/[^\w-]+/g, "-");

  link.href = url;
  link.download = `${safeId}-blog-export.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  els.status.textContent = "내보내기 파일을 만들었습니다.";
}

function triggerBlogImport() {
  els.importInput.value = "";
  els.importInput.click();
}

async function importBlogDataFile(file) {
  if (!file) return;

  try {
    const parsed = safeParseJson(await file.text(), null);
    const imported = normalizeTreeData({
      nodes: parsed?.tree || parsed?.nodes,
      hiddenCategoryIds: parsed?.hidden_category_ids || parsed?.hiddenCategoryIds,
      treeCollapsedIds: parsed?.tree_collapsed_ids || parsed?.treeCollapsedIds,
    });

    if (!Array.isArray(imported.nodes) || imported.nodes.length === 0) {
      throw new Error("불러올 카테고리/폴더 데이터가 없습니다.");
    }

    state.storedTreeData = imported;
    state.activeNodeId = ALL_FILTER;
    state.selectedIds.clear();
    state.selectionMode = false;
    buildTree();
    saveTree();
    render();
    els.status.textContent = "카테고리와 폴더를 불러왔습니다.";
  } catch (error) {
    els.status.textContent = error.message || "불러오지 못했습니다.";
  }
}

function renderTree(nodes = state.tree, depth = 0) {
  return nodes
    .map((node) => {
      const isActive = node.id === state.activeNodeId;
      const isSelected = state.selectedIds.has(node.id);
      const isEditing = node.id === state.editingNodeId;
      const children = Array.isArray(node.children) ? node.children : [];
      const canToggle = children.length > 0 && node.type !== "all";
      const isOpen = !state.treeCollapsedIds.has(node.id);
      const hasNodeIcon = node.type !== "folder";
      const nodeIcon = hasNodeIcon ? `<span class="tree-node-icon" aria-hidden="true">▤</span>` : "";
      const rowMainClass = `tree-row-main${hasNodeIcon ? " has-node-icon" : ""}`;
      const treeToggle = canToggle
        ? `
            <button
              class="tree-node-toggle"
              type="button"
              data-tree-toggle="${escapeHtml(node.id)}"
              aria-label="${escapeHtml(node.label)} ${isOpen ? "접기" : "펼치기"}"
              aria-expanded="${String(isOpen)}"
              title="${isOpen ? "접기" : "펼치기"}"
            >
              ${isOpen ? "▾" : "▸"}
            </button>
          `
        : `<span class="tree-node-toggle-placeholder" aria-hidden="true"></span>`;
      const count = getNodePosts(node).length;
      const checkbox = state.selectionMode && isSelectableNode(node)
        ? `<input class="tree-check" type="checkbox" data-tree-check="${escapeHtml(node.id)}" ${isSelected ? "checked" : ""} aria-label="${escapeHtml(node.label)} 선택">`
        : "";
      const rowMain = isEditing
        ? `
            <div class="${rowMainClass} is-editing">
              ${nodeIcon}
              <input
                class="tree-rename-input"
                type="text"
                value="${escapeHtml(node.label)}"
                data-rename-input="${escapeHtml(node.id)}"
                aria-label="이름 수정"
              >
              <span class="tree-node-count">${count}</span>
            </div>
          `
        : `
            <button class="${rowMainClass}" type="button" data-node-select="${escapeHtml(node.id)}" title="${escapeHtml(node.label)}">
              ${nodeIcon}
              <span class="tree-node-label">${escapeHtml(node.label)}</span>
              <span class="tree-node-count">${count}</span>
            </button>
          `;

      return `
        <div class="tree-node" style="--tree-depth:${depth}">
          <div class="tree-row ${isActive ? "is-active" : ""}">
            ${checkbox}
            ${treeToggle}
            ${rowMain}
            <div class="tree-row-actions">
              <button type="button" data-add-folder="${escapeHtml(node.id)}" aria-label="폴더 추가" title="폴더 추가">+</button>
              <button type="button" data-rename-node="${escapeHtml(node.id)}" aria-label="이름 수정" title="이름 수정">✎</button>
            </div>
          </div>
          ${children.length && isOpen ? `<div class="tree-children">${renderTree(children, depth + 1)}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderTreePanelState() {
  els.selectionToggle.classList.toggle("is-active", state.selectionMode);
  els.selectionToggle.textContent = state.selectionMode ? "✓" : "□";
  els.selectionToggle.setAttribute("aria-label", state.selectionMode ? "선택 해제" : "선택 모드");
  els.selectionToggle.title = state.selectionMode ? "선택 해제" : "선택 모드";
  els.deleteSelected.disabled = state.selectedIds.size === 0 || state.deleteBusy;
  els.deleteSelected.textContent = state.deleteBusy ? "…" : "×";
  els.deleteSelected.setAttribute("aria-label", state.deleteBusy ? "삭제 중" : "삭제");
  els.deleteSelected.title = state.deleteBusy ? "삭제 중" : "삭제";
}

function renderSidebar() {
  els.nav.innerHTML = renderTree();
  renderTreePanelState();
}

function renderPostPanel(content, isEmpty = false) {
  const activeNode = getActiveNode();
  const canRenameActiveNode = activeNode && isSelectableNode(activeNode);
  const selectionLabel = state.selectionMode ? "선택 해제" : "선택 모드";

  return `
    <section class="post-panel">
      <div class="post-panel-head">
        <h2>${escapeHtml(getActivePanelTitle())}</h2>
        <div class="post-panel-actions" aria-label="본문 관리">
          <button
            class="post-panel-icon-button ${state.selectionMode ? "is-active" : ""}"
            type="button"
            data-panel-selection-toggle
            aria-label="${selectionLabel}"
            aria-pressed="${String(state.selectionMode)}"
            title="${selectionLabel}"
          >
            <span class="panel-action-icon icon-select" aria-hidden="true"></span>
          </button>
          <button
            class="post-panel-icon-button"
            type="button"
            data-panel-edit
            aria-label="수정"
            title="수정"
            ${canRenameActiveNode ? "" : "disabled"}
          >
            <span class="panel-action-icon icon-edit" aria-hidden="true"></span>
          </button>
          <button
            class="post-panel-icon-button"
            type="button"
            data-panel-import
            aria-label="불러오기"
            title="불러오기"
          >
            <span class="panel-action-icon icon-import" aria-hidden="true"></span>
          </button>
          <button
            class="post-panel-icon-button"
            type="button"
            data-panel-export
            aria-label="내보내기"
            title="내보내기"
          >
            <span class="panel-action-icon icon-export" aria-hidden="true"></span>
          </button>
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

function addCategory() {
  const name = window.prompt("새 카테고리 이름을 입력해주세요.", "새 카테고리");
  const label = name?.trim();
  if (!label) return;

  const id = categoryId(label);
  state.hiddenCategoryIds.delete(id);

  if (findNode(state.tree, id)) {
    state.activeNodeId = id;
    saveTree();
    render();
    return;
  }

  state.tree.push({
    id,
    type: "category",
    label,
    filterCategory: label,
    children: [],
  });
  state.activeNodeId = id;
  saveTree();
  render();
}

function startInlineRename(nodeId) {
  state.editingNodeId = nodeId;
  renderSidebar();

  window.setTimeout(() => {
    const input = [...els.nav.querySelectorAll("[data-rename-input]")].find(
      (item) => item.dataset.renameInput === nodeId
    );
    input?.focus();
    input?.select();
  }, 0);
}

function saveInlineRename(nodeId, value) {
  if (state.editingNodeId !== nodeId) return;

  const found = findNode(state.tree, nodeId);
  if (!found) {
    state.editingNodeId = "";
    render();
    return;
  }

  const label = value.trim();
  state.editingNodeId = "";
  if (!label) {
    render();
    return;
  }

  const previousFilter = found.node.filterCategory || found.node.label;
  found.node.label = label;
  if (found.node.type === "category" && !state.posts.some((post) => post.category === previousFilter)) {
    found.node.filterCategory = label;
  }
  saveTree();
  render();
}

function cancelInlineRename() {
  state.editingNodeId = "";
  renderSidebar();
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

function getSelectedNodes(nodes = state.tree) {
  return nodes.flatMap((node) => {
    const children = getSelectedNodes(node.children || []);
    if (state.selectedIds.has(node.id) && isSelectableNode(node)) {
      return [node, ...children];
    }
    return children;
  });
}

function getNodeDeletionPosts(node) {
  const posts = getNodePosts(node);
  const childPosts = (node.children || []).flatMap(getNodeDeletionPosts);
  const byId = new Map();
  [...posts, ...childPosts].forEach((post) => {
    if (post.id) byId.set(String(post.id), post);
  });
  return [...byId.values()];
}

async function deleteSelectedNodes() {
  if (state.selectedIds.size === 0) return;

  const selectedNodes = getSelectedNodes();
  const postsToDelete = selectedNodes.flatMap(getNodeDeletionPosts);
  const postIds = [...new Set(postsToDelete.map((post) => String(post.id)).filter(Boolean))];
  const confirmed = window.confirm(
    postIds.length > 0
      ? `선택한 항목과 연결된 글 ${postIds.length}개를 Supabase에서도 완전히 삭제할까요?`
      : "선택한 항목을 삭제할까요?"
  );
  if (!confirmed) return;

  try {
    state.deleteBusy = true;
    renderTreePanelState();
    const deletedCount = await deletePostsFromSupabase(postIds);
    const deletedIdSet = new Set(postIds);
    state.posts = state.posts.filter((post) => !deletedIdSet.has(String(post.id)));
    state.tree = removeSelectedNodes(state.tree);
    state.selectedIds.forEach((id) => state.panelCollapsedIds.delete(id));
    state.selectedIds.forEach((id) => state.treeCollapsedIds.delete(id));
    state.selectedIds.clear();

    if (!findNode(state.tree, state.activeNodeId)) {
      state.activeNodeId = ALL_FILTER;
    }

    saveTree();
    render();
    els.status.textContent = deletedCount > 0 ? `${deletedCount}개 글을 완전히 삭제했습니다.` : "";
  } catch (error) {
    els.status.textContent = error.message;
  } finally {
    state.deleteBusy = false;
    renderTreePanelState();
  }
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
      .filter((post) => belongsToAccount(post, state.id))
      .map(normalizePost)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  } catch (error) {
    state.error = error.message;
    state.posts = [];
  }

  state.storedTreeData = await loadTreeData();
  buildTree();
  render();
}

els.toggle.addEventListener("click", toggleSidebar);

els.selectionToggle.addEventListener("click", toggleSelectionMode);

els.categoryAdd.addEventListener("click", addCategory);

els.deleteSelected.addEventListener("click", deleteSelectedNodes);

els.writeButton.addEventListener("click", openEditor);

els.importInput.addEventListener("change", (event) => {
  importBlogDataFile(event.target.files?.[0]);
});

els.nav.addEventListener("click", (event) => {
  const treeToggle = event.target.closest("[data-tree-toggle]");
  if (treeToggle) {
    const id = treeToggle.dataset.treeToggle;
    if (state.treeCollapsedIds.has(id)) {
      state.treeCollapsedIds.delete(id);
    } else {
      state.treeCollapsedIds.add(id);
    }
    saveTree();
    renderSidebar();
    return;
  }

  const addButton = event.target.closest("[data-add-folder]");
  if (addButton) {
    addFolder(addButton.dataset.addFolder);
    return;
  }

  const renameButton = event.target.closest("[data-rename-node]");
  if (renameButton) {
    startInlineRename(renameButton.dataset.renameNode);
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

els.nav.addEventListener("focusout", (event) => {
  const input = event.target.closest("[data-rename-input]");
  if (!input) return;
  if (state.editingNodeId !== input.dataset.renameInput) return;
  saveInlineRename(input.dataset.renameInput, input.value);
});

els.nav.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-rename-input]");
  if (!input) return;

  if (event.key === "Enter") {
    event.preventDefault();
    saveInlineRename(input.dataset.renameInput, input.value);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineRename();
  }
});

els.list.addEventListener("click", (event) => {
  const selectionButton = event.target.closest("[data-panel-selection-toggle]");
  if (selectionButton) {
    toggleSelectionMode();
    return;
  }

  const editButton = event.target.closest("[data-panel-edit]");
  if (editButton) {
    const activeNode = getActiveNode();
    if (activeNode && isSelectableNode(activeNode)) {
      startInlineRename(activeNode.id);
    } else {
      els.status.textContent = "수정할 카테고리나 폴더를 선택해주세요.";
    }
    return;
  }

  if (event.target.closest("[data-panel-import]")) {
    triggerBlogImport();
    return;
  }

  if (event.target.closest("[data-panel-export]")) {
    exportBlogData();
    return;
  }

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
