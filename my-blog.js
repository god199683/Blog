const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_FILTER = "all";
const DEFAULT_CATEGORY = "카테고리";
const TREE_STORAGE_PREFIX = "blog.categoryTree.";
const EDITOR_DRAFT_PREFIX = "blog.editorDraft.";

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
  editorPreviewOpen: false,
  editorSaving: false,
  deleteBusy: false,
  editingNodeId: "",
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
  writeButton: document.querySelector("[data-write-post]"),
  editorDialog: document.querySelector("[data-editor-dialog]"),
  editorForm: document.querySelector("[data-editor-form]"),
  editorClose: document.querySelector("[data-editor-close]"),
  editorTitle: document.querySelector("[data-editor-title]"),
  editorCategory: document.querySelector("[data-editor-category]"),
  editorFolder: document.querySelector("[data-editor-folder]"),
  editorCover: document.querySelector("[data-editor-cover]"),
  editorExcerpt: document.querySelector("[data-editor-excerpt]"),
  editorContent: document.querySelector("[data-editor-content]"),
  editorBlock: document.querySelector("[data-editor-block]"),
  editorPreview: document.querySelector("[data-editor-preview]"),
  editorPreviewPanel: document.querySelector("[data-editor-preview-panel]"),
  editorPreviewTitle: document.querySelector("[data-editor-preview-title]"),
  editorPreviewBody: document.querySelector("[data-editor-preview-body]"),
  editorSaveState: document.querySelector("[data-editor-save-state]"),
  editorSubmit: document.querySelector("[data-editor-submit]"),
  editorMessage: document.querySelector("[data-editor-message]"),
  editorReadingTime: document.querySelector("[data-editor-reading-time]"),
  editorAuthor: document.querySelector("[data-editor-author]"),
  editorPublished: document.querySelector("[data-editor-published]"),
  editorStatus: document.querySelector("[data-editor-status]"),
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

async function insertPost(payload) {
  const session = getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || "글을 저장하지 못했습니다.";
    throw new Error(message);
  }

  return Array.isArray(data) ? data[0] : data;
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

function editorDraftKey() {
  return `${EDITOR_DRAFT_PREFIX}${state.id || "guest"}`;
}

function getActivePanelTitle() {
  const node = getActiveNode();
  if (!node || node.id === ALL_FILTER) return "전체";
  return node.label || "전체";
}

function getActiveCategoryNode() {
  const found = findNode(state.tree, state.activeNodeId);
  if (!found) return null;
  return [...found.path].reverse().find((node) => node.type === "category") || null;
}

function getActiveFolderNode() {
  const node = getActiveNode();
  return node?.type === "folder" ? node : null;
}

function collectFolderOptions(nodes = state.tree, path = [], category = "") {
  return nodes.flatMap((node) => {
    const nextCategory = node.type === "category" ? node.filterCategory || node.label : category;
    const nextPath = node.type === "all" ? path : [...path, node.label];
    const children = collectFolderOptions(node.children || [], nextPath, nextCategory);

    if (node.type !== "folder") return children;

    return [
      {
        id: node.id,
        label: node.label,
        category: nextCategory,
        path: nextPath.join(" / "),
      },
      ...children,
    ];
  });
}

function getFolderMeta(folderId) {
  if (!folderId) return null;
  return collectFolderOptions().find((folder) => folder.id === folderId) || null;
}

function getEditorDefaults() {
  const categoryNode = getActiveCategoryNode();
  const folderNode = getActiveFolderNode();
  const category = categoryNode?.filterCategory || categoryNode?.label || DEFAULT_CATEGORY;

  return {
    category,
    folderId: folderNode?.id || "",
  };
}

function renderEditorFolderOptions(selectedFolderId = "") {
  const category = els.editorCategory.value.trim();
  const folders = collectFolderOptions().filter(
    (folder) => !category || !folder.category || folder.category === category
  );

  els.editorFolder.innerHTML = [
    `<option value="">폴더 없음</option>`,
    ...folders.map(
      (folder) => `
        <option value="${escapeHtml(folder.id)}" ${folder.id === selectedFolderId ? "selected" : ""}>
          ${escapeHtml(folder.path || folder.label)}
        </option>
      `
    ),
  ].join("");
}

function getPlainTextFromHtml(html = "") {
  const scratch = document.createElement("div");
  scratch.innerHTML = html;
  return scratch.textContent.replace(/\s+/g, " ").trim();
}

function cleanEditorHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => {
    node.remove();
  });
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "style") {
        node.removeAttribute(attr.name);
      }
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML.trim();
}

function getReadingTimeLabel(text = "") {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 350));
  return `${minutes}분 읽기`;
}

function setEditorMessage(message = "", type = "info") {
  els.editorMessage.textContent = message;
  els.editorMessage.dataset.type = type;
}

function setEditorBusy(isBusy) {
  state.editorSaving = isBusy;
  els.editorSubmit.disabled = isBusy;
  els.editorSubmit.textContent = isBusy ? "게시 중" : "게시";
}

function collectEditorValues() {
  const body = cleanEditorHtml(els.editorContent.innerHTML);
  const plainText = getPlainTextFromHtml(body);
  const folder = getFolderMeta(els.editorFolder.value);
  const category = els.editorCategory.value.trim() || folder?.category || DEFAULT_CATEGORY;
  const excerpt = els.editorExcerpt.value.trim() || plainText.slice(0, 120);

  return {
    title: els.editorTitle.value.trim(),
    category,
    folder,
    cover_image: els.editorCover.value.trim(),
    excerpt,
    body,
    plainText,
    reading_time: getReadingTimeLabel(plainText),
    published: els.editorPublished.checked,
  };
}

function saveEditorDraft() {
  if (!state.id) return;
  const draft = {
    title: els.editorTitle.value,
    category: els.editorCategory.value,
    folder_id: els.editorFolder.value,
    cover_image: els.editorCover.value,
    excerpt: els.editorExcerpt.value,
    body: els.editorContent.innerHTML,
    published: els.editorPublished.checked,
    saved_at: new Date().toISOString(),
  };
  localStorage.setItem(editorDraftKey(), JSON.stringify(draft));
  els.editorSaveState.textContent = "초안 자동저장됨";
}

function loadEditorDraft() {
  return safeParseJson(localStorage.getItem(editorDraftKey()), null);
}

function clearEditorDraft() {
  localStorage.removeItem(editorDraftKey());
}

function syncEditorStats() {
  const values = collectEditorValues();
  els.editorReadingTime.textContent = values.plainText ? values.reading_time : "0분 읽기";
  els.editorStatus.textContent = values.published ? "공개 게시" : "비공개 초안";
  els.editorPreviewTitle.textContent = values.title || "제목 미리보기";
  els.editorPreviewBody.innerHTML = values.body || `<p>본문 미리보기</p>`;
}

function openEditor() {
  if (!state.id) {
    window.location.href = "./login.html";
    return;
  }

  const defaults = getEditorDefaults();
  const draft = loadEditorDraft();
  els.editorTitle.value = draft?.title || "";
  els.editorCategory.value = draft?.category || defaults.category;
  renderEditorFolderOptions(draft?.folder_id || defaults.folderId);
  els.editorFolder.value = draft?.folder_id || defaults.folderId;
  els.editorCover.value = draft?.cover_image || "";
  els.editorExcerpt.value = draft?.excerpt || "";
  els.editorContent.innerHTML = draft?.body || "";
  els.editorPublished.checked = draft?.published ?? true;
  els.editorAuthor.textContent = state.id;
  state.editorPreviewOpen = false;
  els.editorPreviewPanel.hidden = true;
  els.editorPreview.textContent = "미리보기";
  els.editorSaveState.textContent = draft ? "저장된 초안 불러옴" : "초안 준비됨";
  setEditorMessage("");
  syncEditorStats();
  els.editorDialog.showModal();
  window.setTimeout(() => els.editorTitle.focus(), 0);
}

function closeEditor() {
  if (state.editorSaving) return;
  els.editorDialog.close();
}

function updateEditorPreview() {
  state.editorPreviewOpen = !state.editorPreviewOpen;
  els.editorPreviewPanel.hidden = !state.editorPreviewOpen;
  els.editorPreview.textContent = state.editorPreviewOpen ? "편집" : "미리보기";
  syncEditorStats();
}

function executeEditorCommand(command, value = null) {
  els.editorContent.focus();
  document.execCommand(command, false, value);
  syncEditorStats();
  saveEditorDraft();
}

async function publishEditorPost() {
  const session = getSession();
  const values = collectEditorValues();

  if (!session?.access_token) {
    throw new Error("로그인이 필요합니다.");
  }
  if (!values.title) {
    throw new Error("제목을 입력해주세요.");
  }
  if (!values.plainText) {
    throw new Error("본문을 입력해주세요.");
  }

  const payload = {
    title: values.title,
    excerpt: values.excerpt,
    body: values.body,
    category: values.category,
    author: state.id,
    login_id: state.id,
    user_id: session.user?.id,
    cover_image: values.cover_image || null,
    reading_time: values.reading_time,
    published: values.published,
    published_at: new Date().toISOString(),
    folder: values.folder?.label || null,
    folder_id: values.folder?.id || null,
    folder_name: values.folder?.label || null,
    folder_path: values.folder?.path || null,
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === "") {
      delete payload[key];
    }
  });

  try {
    return await insertPost(payload);
  } catch (error) {
    if (!/column|schema cache|Could not find/i.test(error.message)) {
      throw error;
    }

    const fallbackPayload = {
      title: payload.title,
      excerpt: payload.excerpt,
      body: payload.body,
      category: payload.category,
      author: payload.author,
      cover_image: payload.cover_image,
      reading_time: payload.reading_time,
      published: payload.published,
      published_at: payload.published_at,
    };
    Object.keys(fallbackPayload).forEach((key) => {
      if (fallbackPayload[key] === undefined || fallbackPayload[key] === "") {
        delete fallbackPayload[key];
      }
    });
    return insertPost(fallbackPayload);
  }
}

function isSelectableNode(node) {
  return node.id !== ALL_FILTER;
}

function renderTree(nodes = state.tree, depth = 0) {
  return nodes
    .map((node) => {
      const isActive = node.id === state.activeNodeId;
      const isSelected = state.selectedIds.has(node.id);
      const isEditing = node.id === state.editingNodeId;
      const children = Array.isArray(node.children) ? node.children : [];
      const count = getNodePosts(node).length;
      const checkbox = state.selectionMode && isSelectableNode(node)
        ? `<input class="tree-check" type="checkbox" data-tree-check="${escapeHtml(node.id)}" ${isSelected ? "checked" : ""} aria-label="${escapeHtml(node.label)} 선택">`
        : "";
      const rowMain = isEditing
        ? `
            <div class="tree-row-main is-editing">
              <span class="tree-node-icon" aria-hidden="true">${node.type === "folder" ? "□" : "▤"}</span>
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
            <button class="tree-row-main" type="button" data-node-select="${escapeHtml(node.id)}" title="${escapeHtml(node.label)}">
              <span class="tree-node-icon" aria-hidden="true">${node.type === "folder" ? "□" : "▤"}</span>
              <span class="tree-node-label">${escapeHtml(node.label)}</span>
              <span class="tree-node-count">${count}</span>
            </button>
          `;

      return `
        <div class="tree-node" style="--tree-depth:${depth}">
          <div class="tree-row ${isActive ? "is-active" : ""}">
            ${checkbox}
            ${rowMain}
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
  els.treePanelToggle.setAttribute("aria-label", state.treePanelOpen ? "관리 영역 접기" : "관리 영역 펼치기");
  els.treePanelToggle.textContent = state.treePanelOpen ? "▾" : "▸";
  els.selectionToggle.classList.toggle("is-active", state.selectionMode);
  els.selectionToggle.textContent = state.selectionMode ? "선택 해제" : "선택 모드";
  els.deleteSelected.disabled = state.selectedIds.size === 0 || state.deleteBusy;
  els.deleteSelected.textContent = state.deleteBusy ? "삭제 중" : "삭제";
}

function renderSidebar() {
  els.nav.innerHTML = renderTree();
  renderTreePanelState();
}

function renderPostPanel(content, isEmpty = false) {
  return `
    <section class="post-panel">
      <div class="post-panel-head">
        <h2>${escapeHtml(getActivePanelTitle())}</h2>
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

  found.node.label = label;
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

async function handleEditorSubmit(event) {
  event.preventDefault();

  try {
    setEditorBusy(true);
    setEditorMessage("게시 중입니다...");
    const values = collectEditorValues();
    const saved = await publishEditorPost();
    const savedAt = saved?.published_at || saved?.created_at || new Date().toISOString();
    const row = {
      ...saved,
      title: saved?.title || values.title,
      excerpt: saved?.excerpt || values.excerpt,
      body: saved?.body || values.body,
      category: saved?.category || values.category,
      author: saved?.author || state.id,
      login_id: saved?.login_id || state.id,
      cover_image: saved?.cover_image || values.cover_image,
      reading_time: saved?.reading_time || values.reading_time,
      published: saved?.published ?? values.published,
      published_at: savedAt,
      folder: saved?.folder || values.folder?.label || "",
      folder_id: saved?.folder_id || values.folder?.id || "",
      folder_name: saved?.folder_name || values.folder?.label || "",
      folder_path: saved?.folder_path || values.folder?.path || "",
    };

    if (row.published !== false) {
      const normalized = normalizePost(row, 0);
      state.posts = [normalized, ...state.posts.filter((post) => String(post.id) !== String(normalized.id))];
      buildTree();
      state.activeNodeId = values.folder?.id || categoryId(values.category);
      if (!findNode(state.tree, state.activeNodeId)) {
        state.activeNodeId = ALL_FILTER;
      }
      render();
    }

    clearEditorDraft();
    setEditorMessage("게시가 완료되었습니다.", "success");
    window.setTimeout(closeEditor, 450);
  } catch (error) {
    setEditorMessage(error.message, "error");
  } finally {
    setEditorBusy(false);
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

els.writeButton.addEventListener("click", openEditor);
els.editorClose.addEventListener("click", closeEditor);
els.editorForm.addEventListener("submit", handleEditorSubmit);
els.editorPreview.addEventListener("click", updateEditorPreview);

els.editorDialog.addEventListener("click", (event) => {
  if (event.target === els.editorDialog) {
    saveEditorDraft();
    closeEditor();
  }
});

els.editorForm.addEventListener("input", () => {
  syncEditorStats();
  saveEditorDraft();
});

els.editorCategory.addEventListener("input", () => {
  renderEditorFolderOptions(els.editorFolder.value);
  saveEditorDraft();
});

els.editorBlock.addEventListener("change", (event) => {
  executeEditorCommand("formatBlock", event.target.value);
  event.target.value = "p";
});

els.editorForm.addEventListener("click", (event) => {
  const commandButton = event.target.closest("[data-editor-command]");
  if (commandButton) {
    executeEditorCommand(commandButton.dataset.editorCommand, commandButton.dataset.value || null);
    return;
  }

  if (event.target.closest("[data-editor-link]")) {
    const url = window.prompt("연결할 주소를 입력하세요.", "https://");
    if (url) executeEditorCommand("createLink", url);
    return;
  }

  if (event.target.closest("[data-editor-image]")) {
    const url = window.prompt("이미지 주소를 입력하세요.", "https://");
    if (url) executeEditorCommand("insertImage", url);
  }
});

els.editorForm.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveEditorDraft();
  }
});

els.nav.addEventListener("click", (event) => {
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
