const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_NODE_ID = "all";

const state = {
  session: null,
  id: "",
  posts: [],
  tree: [],
  activeNodeId: ALL_NODE_ID,
  selectionMode: false,
  selectedNodeIds: new Set(),
  collapsedNodeIds: new Set(),
};

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
};

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

function renderBlog(id, profile = null) {
  const title = profile?.blog_title || `${id}'s Blog`;
  if (els.title) els.title.textContent = title;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.profileTitle) els.profileTitle.textContent = title;
  if (els.profileId) els.profileId.textContent = `@${id}`;
  if (els.owner) els.owner.textContent = `${id} 계정의 개인 블로그입니다.`;
  els.initials.forEach((initial) => {
    initial.textContent = id.slice(0, 1).toUpperCase();
  });
  document.title = `${title} | 블로그 홈`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function getActiveTreeMeta() {
  if (state.activeNodeId === ALL_NODE_ID) {
    return { title: "전체보기", posts: state.posts };
  }

  const found = findNode(state.tree, state.activeNodeId);
  if (!found) return { title: "전체보기", posts: state.posts };

  if (found.node.type === "category") {
    const category = found.node.filterCategory || found.node.label;
    return {
      title: found.node.label,
      posts: state.posts.filter((post) => (post.category || "전체") === category),
    };
  }

  return {
    title: found.node.label,
    posts: state.posts.filter((post) => post.folder_id === found.node.id),
  };
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

function syncTreeSelectionState() {
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
  const typeLabel = node.type === "category" ? "카테고리" : "폴더";
  const children = hasChildren && !isCollapsed ? node.children.map((child) => renderTreeNode(child, depth + 1)).join("") : "";

  return `
    <li>
      <div class="blog-tree-row" data-tree-node="${escapeHtml(node.id)}" style="--tree-depth:${depth}">
        ${
          state.selectionMode
            ? `<input class="blog-tree-check" type="checkbox" data-tree-check="${escapeHtml(node.id)}" ${isChecked ? "checked" : ""} aria-label="${escapeHtml(node.label)} 선택">`
            : ""
        }
        <button class="blog-tree-expander" type="button" data-tree-toggle="${escapeHtml(node.id)}" ${hasChildren ? "" : "disabled"} aria-label="${escapeHtml(node.label)} 접기 펼치기">
          <span aria-hidden="true">${hasChildren ? (isCollapsed ? "+" : "-") : ""}</span>
        </button>
        <button class="blog-tree-label" type="button" data-tree-select="${escapeHtml(node.id)}">
          <span class="blog-tree-type">${typeLabel}</span>
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

function renderActivePosts() {
  const meta = getActiveTreeMeta();
  if (els.boardTitle) els.boardTitle.textContent = meta.title;
  renderPosts(meta.posts);
}

async function loadTree(session) {
  if (!session?.access_token || !session.user?.id) return [];
  const rows = await requestRest(
    `blog_trees?select=tree,tree_collapsed_ids&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  state.collapsedNodeIds = new Set(Array.isArray(row?.tree_collapsed_ids) ? row.tree_collapsed_ids : []);
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

  if (!window.confirm("선택한 항목을 삭제할까요?")) return;

  state.tree = removeSelectedNodes(state.tree, state.selectedNodeIds);
  if (state.activeNodeId !== ALL_NODE_ID && !findNode(state.tree, state.activeNodeId)) {
    state.activeNodeId = ALL_NODE_ID;
  }
  state.selectedNodeIds.clear();
  state.selectionMode = false;
  await saveTree();
  renderTree();
  renderActivePosts();
}

function renderPosts(posts = []) {
  if (els.count) els.count.textContent = `${posts.length}개의 글`;
  if (!els.postList) return;

  if (posts.length === 0) {
    els.postList.innerHTML = `
      <div class="blog-empty-row">
        <span>아직 작성된 글이 없습니다.</span>
        <span>0</span>
        <span>-</span>
      </div>
    `;
    return;
  }

  els.postList.innerHTML = posts
    .map((post) => {
      const visibility = post.published === false ? "비공개" : "공개";
      return `
        <div class="blog-post-row">
          <span>
            <a class="blog-post-title" href="./editor.html?post=${encodeURIComponent(post.id)}">
              ${escapeHtml(post.title || "제목 없는 글")}
            </a>
            <small>${escapeHtml(post.folder_path || post.folder_name || post.category || "전체")} · ${visibility}</small>
          </span>
          <span>0</span>
          <span>${formatDate(post.published_at || post.created_at)}</span>
        </div>
      `;
    })
    .join("");
}

async function fetchUserPosts(session, id) {
  const rows = await requestRest(
    "posts?select=id,title,category,folder_id,folder_name,folder_path,author,login_id,user_id,published,published_at,created_at&order=published_at.desc&limit=100",
    session.access_token
  );
  return Array.isArray(rows) ? rows.filter((post) => belongsToUser(post, session, id)) : [];
}

const listToggle = document.querySelector("[data-list-toggle]");
const blogBoard = document.querySelector("[data-blog-board]");

if (listToggle && blogBoard) {
  listToggle.addEventListener("click", () => {
    const isCollapsed = blogBoard.classList.toggle("is-list-collapsed");
    listToggle.textContent = isCollapsed ? "목록열기" : "목록닫기";
    listToggle.setAttribute("aria-expanded", String(!isCollapsed));
  });
  listToggle.setAttribute("aria-expanded", "true");
}

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
  }
});

els.all?.addEventListener("click", () => {
  state.activeNodeId = ALL_NODE_ID;
  renderActivePosts();
  syncTreeSelectionState();
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
    renderActivePosts();
    syncTreeSelectionState();
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
  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }

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
  renderTree();

  try {
    state.posts = await fetchUserPosts(session, id);
  } catch {
    state.posts = [];
  }
  renderActivePosts();
});
