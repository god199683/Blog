const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_FILTER = "all";
const DEFAULT_CATEGORY = "전체";
const TREE_STORAGE_PREFIX = "blog.categoryTree.";

const state = {
  id: "",
  tree: [],
  hiddenCategoryIds: new Set(),
  treeCollapsedIds: new Set(),
  trashItems: [],
  selectedTrashIds: new Set(),
  selectionMode: false,
  busy: false,
};

const els = {
  summary: document.querySelector("[data-trash-summary]"),
  status: document.querySelector("[data-trash-status]"),
  list: document.querySelector("[data-trash-list]"),
  selectionToggle: document.querySelector("[data-trash-selection-toggle]"),
  restore: document.querySelector("[data-trash-restore]"),
  deleteSelected: document.querySelector("[data-trash-delete-selected]"),
  empty: document.querySelector("[data-trash-empty]"),
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

function createId(prefix = "trash") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function treeStorageKey() {
  return `${TREE_STORAGE_PREFIX}${state.id || "guest"}`;
}

function safeParseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
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

function normalizePost(raw = {}, index = 0) {
  return {
    id: raw.id || raw.slug || `post-${index}`,
    title: raw.title || raw.name || "제목 없는 글",
    excerpt: raw.excerpt || raw.summary || raw.description || raw.subtitle || "",
    category: raw.category || raw.topic || raw.tag || DEFAULT_CATEGORY,
    folder: raw.folder || "",
    folder_id: raw.folder_id || "",
    folder_name: raw.folder_name || "",
    folder_path: raw.folder_path || "",
    user_id: raw.user_id || "",
    login_id: raw.login_id || "",
    body: raw.body || raw.content || "",
    cover_image: raw.cover_image || raw.image_url || "",
    author: raw.author || raw.author_name || raw.writer || "",
    published_at: raw.published_at || raw.created_at || raw.date || "",
    reading_time: raw.reading_time || raw.read_time || "",
  };
}

function normalizeTrashItem(item = {}) {
  return {
    id: item.id || createId(),
    kind: item.kind === "post" ? "post" : "node",
    label: item.label || item.node?.label || item.posts?.[0]?.title || "삭제된 항목",
    deletedAt: item.deletedAt || new Date().toISOString(),
    node: item.node ? cloneNode(item.node) : null,
    posts: Array.isArray(item.posts) ? item.posts.map(normalizePost) : [],
  };
}

function normalizeTreeData(data) {
  return {
    nodes: Array.isArray(data?.nodes) ? data.nodes.map(cloneNode) : [],
    hiddenCategoryIds: Array.isArray(data?.hiddenCategoryIds) ? data.hiddenCategoryIds : [],
    treeCollapsedIds: Array.isArray(data?.treeCollapsedIds) ? data.treeCollapsedIds : [],
    trashItems: Array.isArray(data?.trashItems) ? data.trashItems.map(normalizeTrashItem) : [],
  };
}

function getStoredTreeData() {
  const parsed = safeParseJson(localStorage.getItem(treeStorageKey()), []);
  if (Array.isArray(parsed)) {
    return { nodes: parsed, hiddenCategoryIds: [], treeCollapsedIds: [], trashItems: [] };
  }

  return normalizeTreeData({
    nodes: parsed.nodes,
    hiddenCategoryIds: parsed.hiddenCategoryIds,
    treeCollapsedIds: parsed.treeCollapsedIds,
    trashItems: parsed.trashItems,
  });
}

function hasTreeData(data) {
  return Boolean(
    data?.nodes?.length ||
      data?.hiddenCategoryIds?.length ||
      data?.treeCollapsedIds?.length ||
      data?.trashItems?.length
  );
}

function saveTreeDataToLocal(data) {
  if (!state.id) return;
  localStorage.setItem(treeStorageKey(), JSON.stringify(normalizeTreeData(data)));
}

async function fetchTreeDataFromSupabase() {
  const session = getSession();
  if (!session?.access_token || !session.user?.id) return null;

  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_trees`);
  endpoint.searchParams.set("select", "tree,hidden_category_ids,tree_collapsed_ids,trash");
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
    trashItems: row.trash,
  });
}

async function saveTreeDataToSupabase(data) {
  const session = getSession();
  if (!session?.access_token || !session.user?.id || !state.id) return;

  const normalized = normalizeTreeData(data);
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_trees`);
  endpoint.searchParams.set("on_conflict", "user_id");

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
      trash: normalized.trashItems,
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

async function loadTreeData() {
  const local = getStoredTreeData();
  const remote = await fetchTreeDataFromSupabase();
  const selected = hasTreeData(remote) ? remote : local;

  if (hasTreeData(remote)) saveTreeDataToLocal(remote);
  if (!hasTreeData(remote) && hasTreeData(local)) saveTreeDataToSupabase(local);

  return normalizeTreeData(selected);
}

function getTreeData() {
  return normalizeTreeData({
    nodes: state.tree,
    hiddenCategoryIds: [...state.hiddenCategoryIds],
    treeCollapsedIds: [...state.treeCollapsedIds],
    trashItems: state.trashItems,
  });
}

function saveTree() {
  const data = getTreeData();
  saveTreeDataToLocal(data);
  saveTreeDataToSupabase(data);
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

function getNodePathLabels(nodeId) {
  const found = findNode(state.tree, nodeId);
  if (!found) return [];
  return found.path
    .filter((node) => node.type !== "all")
    .map((node) => node.label)
    .filter(Boolean);
}

function getNodeDisplayPath(nodeId) {
  const labels = getNodePathLabels(nodeId);
  return labels.length ? labels.join(" / ") : DEFAULT_CATEGORY;
}

function getRestoreTargets() {
  const targets = [{ id: ALL_FILTER, label: DEFAULT_CATEGORY, type: "all", node: state.tree[0] }];

  function walk(nodes = state.tree) {
    nodes.forEach((node) => {
      if (node.id !== ALL_FILTER && (node.type === "category" || node.type === "folder")) {
        targets.push({
          id: node.id,
          label: getNodeDisplayPath(node.id),
          type: node.type,
          node,
        });
      }
      walk(node.children || []);
    });
  }

  walk();
  return targets;
}

function promptRestoreTarget() {
  const targets = getRestoreTargets();
  const message = [
    "복원할 위치 번호를 입력하세요.",
    "",
    ...targets.map((target, index) => `${index + 1}. ${target.label}`),
  ].join("\n");
  const selected = window.prompt(message, "1");
  if (!selected) return null;
  const index = Number.parseInt(selected, 10) - 1;
  return targets[index] || null;
}

function getCategoryForTarget(target) {
  if (!target || target.id === ALL_FILTER) return DEFAULT_CATEGORY;
  if (target.type === "category") return target.node.filterCategory || target.node.label || DEFAULT_CATEGORY;
  const found = findNode(state.tree, target.id);
  const categoryNode = found?.path.find((node) => node.type === "category");
  return categoryNode?.filterCategory || categoryNode?.label || DEFAULT_CATEGORY;
}

function getFolderPayloadForTarget(target) {
  if (!target || target.id === ALL_FILTER || target.type !== "folder") {
    return {
      category: getCategoryForTarget(target),
      folder: null,
      folder_id: null,
      folder_name: null,
      folder_path: null,
    };
  }

  return {
    category: getCategoryForTarget(target),
    folder: target.node.label,
    folder_id: target.node.id,
    folder_name: target.node.label,
    folder_path: getNodeDisplayPath(target.node.id),
  };
}

function addRestoredNode(node, target) {
  const restored = cloneNode(node);
  if (restored.type === "category") {
    state.hiddenCategoryIds.delete(restored.id);
    const existing = findNode(state.tree, restored.id);
    if (existing) {
      existing.node.children = [...(existing.node.children || []), ...(restored.children || [])];
    } else {
      state.tree.push(restored);
    }
    return;
  }

  const parent = target?.node || state.tree[0];
  parent.children = [...(parent.children || []), restored];
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

async function updatePostInSupabase(id, payload) {
  const session = getSession();
  if (!session?.access_token) throw new Error("로그인이 필요합니다.");

  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("id", `eq.${id}`);

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || data?.details || "글을 복원하지 못했습니다.");
  }
}

async function deletePostFromSupabase(id) {
  const session = getSession();
  if (!session?.access_token) throw new Error("로그인이 필요합니다.");

  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("id", `eq.${id}`);

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      Prefer: "return=representation",
    },
  });

  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || data?.details || "Supabase에서 글을 삭제하지 못했습니다.");
  }

  return Array.isArray(data) ? data.length : 0;
}

async function deletePostsFromSupabase(postIds) {
  for (const id of postIds) {
    await deletePostFromSupabase(id);
  }
}

async function permanentlyDeleteTrashItems(items) {
  const postIds = [...getTrashPostIdSet(items)];
  if (postIds.length > 0) await deletePostsFromSupabase(postIds);
}

function setBusy(busy) {
  state.busy = busy;
  render();
}

function render() {
  const count = state.trashItems.length;
  const selectedCount = state.selectedTrashIds.size;
  els.summary.textContent = `${count}개 항목 · ${selectedCount}개 선택`;
  els.selectionToggle.classList.toggle("is-active", state.selectionMode);
  els.restore.disabled = selectedCount === 0 || state.busy;
  els.deleteSelected.disabled = selectedCount === 0 || state.busy;
  els.empty.disabled = count === 0 || state.busy;

  if (count === 0) {
    els.list.innerHTML = `
      <div class="trash-page-empty">
        <h2>휴지통이 비어 있습니다</h2>
        <p>삭제한 글이나 폴더가 있으면 이곳에 먼저 보관됩니다.</p>
      </div>
    `;
    return;
  }

  els.list.innerHTML = state.trashItems
    .map((item) => {
      const isSelected = state.selectedTrashIds.has(item.id);
      const typeLabel = item.kind === "post" ? "글" : item.node?.type === "category" ? "카테고리" : "폴더";
      const countLabel = item.posts?.length ? `${item.posts.length}개 글` : "글 없음";
      const deletedAt = item.deletedAt ? new Date(item.deletedAt) : null;
      const dateLabel = deletedAt && !Number.isNaN(deletedAt.getTime()) ? deletedAt.toLocaleDateString("ko-KR") : "";
      const check = state.selectionMode
        ? `<input class="trash-check" type="checkbox" data-trash-check="${escapeHtml(item.id)}" ${
            isSelected ? "checked" : ""
          } aria-label="${escapeHtml(item.label)} 선택">`
        : "";

      return `
        <article class="trash-page-item ${isSelected ? "is-selected" : ""}" data-trash-item="${escapeHtml(item.id)}" tabindex="0">
          ${check}
          <div class="trash-page-item-main">
            <h2>${escapeHtml(item.label)}</h2>
            <p>${typeLabel} · ${countLabel}${dateLabel ? ` · ${dateLabel}` : ""}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

async function restoreSelectedTrashItems() {
  if (state.selectedTrashIds.size === 0) return;
  const target = promptRestoreTarget();
  if (!target) return;

  const selectedIds = new Set(state.selectedTrashIds);
  const items = state.trashItems.filter((item) => selectedIds.has(item.id));
  const folderPayload = getFolderPayloadForTarget(target);

  try {
    setBusy(true);

    for (const item of items) {
      if (item.node) addRestoredNode(item.node, target);

      if (item.kind === "post") {
        for (const post of item.posts || []) {
          if (post.id) await updatePostInSupabase(post.id, folderPayload);
        }
      }
    }

    state.trashItems = state.trashItems.filter((item) => !selectedIds.has(item.id));
    state.selectedTrashIds.clear();
    state.selectionMode = false;
    saveTree();
    els.status.textContent = "선택한 항목을 복원했습니다.";
  } catch (error) {
    els.status.textContent = error.message || "복원하지 못했습니다.";
  } finally {
    setBusy(false);
  }
}

async function deleteSelectedTrashItems() {
  if (state.selectedTrashIds.size === 0) return;
  if (!window.confirm("내용을 정말로 삭제할까요?")) return;

  const selectedIds = new Set(state.selectedTrashIds);
  const items = state.trashItems.filter((item) => selectedIds.has(item.id));

  try {
    setBusy(true);
    await permanentlyDeleteTrashItems(items);
    state.trashItems = state.trashItems.filter((item) => !selectedIds.has(item.id));
    state.selectedTrashIds.clear();
    saveTree();
    els.status.textContent = "선택한 항목을 완전히 삭제했습니다.";
  } catch (error) {
    els.status.textContent = error.message || "삭제하지 못했습니다.";
  } finally {
    setBusy(false);
  }
}

async function emptyTrash() {
  if (state.trashItems.length === 0) return;
  if (!window.confirm("내용을 정말로 삭제할까요?")) return;

  try {
    setBusy(true);
    await permanentlyDeleteTrashItems(state.trashItems);
    state.trashItems = [];
    state.selectedTrashIds.clear();
    state.selectionMode = false;
    saveTree();
    els.status.textContent = "휴지통을 비웠습니다.";
  } catch (error) {
    els.status.textContent = error.message || "휴지통을 비우지 못했습니다.";
  } finally {
    setBusy(false);
  }
}

async function initTrashPage() {
  const session = getSession();
  state.id = getSessionId(session);

  if (!state.id) {
    els.summary.textContent = "로그인이 필요합니다.";
    els.status.innerHTML = `<a href="./login.html">로그인하러 가기</a>`;
    return;
  }

  const data = await loadTreeData();
  state.tree = data.nodes.length
    ? data.nodes
    : [{ id: ALL_FILTER, type: "all", label: DEFAULT_CATEGORY, filterCategory: "", children: [] }];
  state.hiddenCategoryIds = new Set(data.hiddenCategoryIds);
  state.treeCollapsedIds = new Set(data.treeCollapsedIds);
  state.trashItems = data.trashItems;
  render();
}

els.selectionToggle.addEventListener("click", () => {
  state.selectionMode = !state.selectionMode;
  state.selectedTrashIds.clear();
  render();
});

els.restore.addEventListener("click", restoreSelectedTrashItems);
els.deleteSelected.addEventListener("click", deleteSelectedTrashItems);
els.empty.addEventListener("click", emptyTrash);

els.list.addEventListener("click", (event) => {
  if (event.target.closest("[data-trash-check]")) return;
  const item = event.target.closest("[data-trash-item]");
  if (!item || !state.selectionMode) return;

  const id = item.dataset.trashItem;
  if (state.selectedTrashIds.has(id)) {
    state.selectedTrashIds.delete(id);
  } else {
    state.selectedTrashIds.add(id);
  }
  render();
});

els.list.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-trash-check]");
  if (!checkbox) return;

  if (checkbox.checked) {
    state.selectedTrashIds.add(checkbox.dataset.trashCheck);
  } else {
    state.selectedTrashIds.delete(checkbox.dataset.trashCheck);
  }
  render();
});

els.list.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target.closest("[data-trash-item]");
  if (!item || !state.selectionMode) return;
  event.preventDefault();

  const id = item.dataset.trashItem;
  if (state.selectedTrashIds.has(id)) {
    state.selectedTrashIds.delete(id);
  } else {
    state.selectedTrashIds.add(id);
  }
  render();
});

Promise.resolve(window.blogSession?.ready).finally(initTrashPage);
