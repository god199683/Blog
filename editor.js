const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_FILTER = "all";
const DEFAULT_CATEGORY = "전체";
const TREE_STORAGE_PREFIX = "blog.categoryTree.";
const EDITOR_DRAFT_PREFIX = "blog.editorDraft.";

const state = {
  id: "",
  posts: [],
  tree: [],
  activeNodeId: new URLSearchParams(window.location.search).get("node") || ALL_FILTER,
  hiddenCategoryIds: new Set(),
  storedTreeData: null,
  editorSaving: false,
};

const els = {
  form: document.querySelector("[data-editor-form]"),
  close: document.querySelector("[data-editor-close]"),
  title: document.querySelector("[data-editor-title]"),
  category: document.querySelector("[data-editor-category]"),
  folder: document.querySelector("[data-editor-folder]"),
  content: document.querySelector("[data-editor-content]"),
  toolbar: document.querySelector("[data-editor-toolbar]"),
  fontFamily: document.querySelector("[data-editor-font-family]"),
  fontSize: document.querySelector("[data-editor-font-size]"),
  draft: document.querySelector("[data-editor-draft]"),
  saveState: document.querySelector("[data-editor-save-state]"),
  submit: document.querySelector("[data-editor-submit]"),
  message: document.querySelector("[data-editor-message]"),
  charWithSpaces: document.querySelector("[data-editor-char-spaces]"),
  charWithoutSpaces: document.querySelector("[data-editor-char-nospace]"),
  published: document.querySelector("[data-editor-published]"),
  visibilityButtons: document.querySelectorAll("[data-editor-visibility]"),
};

let savedEditorRange = null;
let colorDialogTarget = "foreground";
let colorDialogValue = "#000000";
let colorDialogPointerActive = false;

const THEME_COLOR_COLUMNS = [
  ["#ffffff", "#f2f2f2", "#d9d9d9", "#bfbfbf", "#808080", "#595959"],
  ["#000000", "#7f7f7f", "#595959", "#404040", "#262626", "#0d0d0d"],
  ["#ffffff", "#f2f2f2", "#d9d9d9", "#bfbfbf", "#808080", "#595959"],
  ["#111827", "#6b7280", "#4b5563", "#374151", "#1f2937", "#111827"],
  ["#155e75", "#cffafe", "#67e8f9", "#22d3ee", "#0e7490", "#164e63"],
  ["#ea580c", "#ffedd5", "#fdba74", "#fb923c", "#c2410c", "#7c2d12"],
  ["#166534", "#dcfce7", "#86efac", "#4ade80", "#15803d", "#14532d"],
  ["#0ea5e9", "#e0f2fe", "#7dd3fc", "#38bdf8", "#0284c7", "#075985"],
  ["#a21caf", "#fce7f3", "#f0abfc", "#e879f9", "#a21caf", "#701a75"],
  ["#4d7c0f", "#dcfce7", "#bbf7d0", "#86efac", "#65a30d", "#3f6212"],
];

const STANDARD_COLORS = [
  "#dc2626",
  "#ff0000",
  "#facc15",
  "#ffff00",
  "#84cc16",
  "#00a651",
  "#0ea5e9",
  "#0070c0",
  "#002060",
  "#7030a0",
];

const BASIC_DIALOG_COLORS = [
  "#000000",
  "#1f2937",
  "#475569",
  "#64748b",
  "#94a3b8",
  "#ffffff",
  "#7f1d1d",
  "#b91c1c",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#fef08a",
  "#365314",
  "#65a30d",
  "#22c55e",
  "#86efac",
  "#bbf7d0",
  "#f0fdf4",
  "#164e63",
  "#0891b2",
  "#22d3ee",
  "#7dd3fc",
  "#bae6fd",
  "#f0f9ff",
  "#1e1b4b",
  "#3730a3",
  "#6366f1",
  "#a78bfa",
  "#ddd6fe",
  "#faf5ff",
  "#701a75",
  "#a21caf",
  "#d946ef",
  "#f0abfc",
  "#f5d0fe",
  "#fdf4ff",
  "#831843",
  "#be185d",
  "#ec4899",
  "#f9a8d4",
  "#fbcfe8",
  "#fff1f2",
  "#7c2d12",
  "#c2410c",
  "#ea580c",
  "#fdba74",
  "#fed7aa",
  "#fff7ed",
];

const ALLOWED_EDITOR_STYLES = new Set([
  "background-color",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "text-align",
  "text-decoration",
]);

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

function normalizePost(raw, index) {
  return {
    id: raw.id || raw.slug || `post-${index}`,
    title: raw.title || raw.name || "제목 없는 글",
    excerpt: raw.excerpt || raw.summary || raw.description || raw.subtitle || "",
    category: raw.category || raw.topic || raw.tag || "일반",
    folder: raw.folder || "",
    folder_id: raw.folder_id || "",
    folder_name: raw.folder_name || "",
    folder_path: raw.folder_path || "",
    user_id: raw.user_id || "",
    login_id: raw.login_id || "",
    author: raw.author || raw.author_name || raw.writer || "",
    published_at: raw.published_at || raw.created_at || raw.date || "",
  };
}

function belongsToAccount(raw, id) {
  const normalizedId = id.toLowerCase();
  return [raw.author, raw.author_name, raw.writer, raw.login_id, raw.user_id, raw.owner_id]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === normalizedId);
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

function getActiveNode() {
  return findNode(state.tree, state.activeNodeId)?.node || state.tree[0];
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
  const category = categoryNode?.filterCategory || categoryNode?.label || "";

  return {
    category,
    folderId: folderNode?.id || "",
  };
}

function editorDraftKey() {
  return `${EDITOR_DRAFT_PREFIX}${state.id || "guest"}`;
}

function getCategoryOptions() {
  return state.tree
    .filter((node) => node.type === "category")
    .map((node) => ({
      label: node.label,
      value: node.filterCategory || node.label,
    }));
}

function renderEditorCategoryOptions(selectedCategory = "") {
  const categories = getCategoryOptions();
  const values = new Set(categories.map((category) => category.value));
  const selected = selectedCategory && values.has(selectedCategory) ? selectedCategory : "";

  els.category.innerHTML = [
    `<option value="" ${selected ? "" : "selected"}>${DEFAULT_CATEGORY}</option>`,
    ...categories.map(
      (category) => `
        <option value="${escapeHtml(category.value)}" ${category.value === selected ? "selected" : ""}>
          ${escapeHtml(category.label)}
        </option>
      `
    ),
  ].join("");
}

function renderEditorFolderOptions(selectedFolderId = "") {
  const category = els.category.value;
  const folders = collectFolderOptions().filter(
    (folder) => !category || !folder.category || folder.category === category
  );

  els.folder.innerHTML = [
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

function getTextFromHtml(html = "") {
  const scratch = document.createElement("div");
  scratch.innerHTML = html;
  return scratch.textContent.replace(/\u200b/g, "");
}

function getPlainTextFromHtml(html = "") {
  return getTextFromHtml(html).replace(/\s+/g, " ").trim();
}

function getCharacterCounts(html = "") {
  const text = getTextFromHtml(html);
  return {
    withSpaces: text.length,
    withoutSpaces: text.replace(/\s/g, "").length,
  };
}

function cleanEditorHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => {
    node.remove();
  });
  template.content.querySelectorAll("*").forEach((node) => {
    const safeStyles = [];

    ALLOWED_EDITOR_STYLES.forEach((property) => {
      const value = node.style.getPropertyValue(property).trim();
      if (!value || /expression|javascript:|url\s*\(/i.test(value)) return;
      safeStyles.push(`${property}: ${value}`);
    });

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

    if (safeStyles.length > 0) {
      node.setAttribute("style", safeStyles.join("; "));
    }
  });
  return template.innerHTML.trim();
}

function getReadingTimeLabel(text = "") {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 350));
  return `${minutes}분 읽기`;
}

function collectEditorValues() {
  const body = cleanEditorHtml(els.content.innerHTML);
  const plainText = getPlainTextFromHtml(body);
  const characterCounts = getCharacterCounts(body);
  const folder = getFolderMeta(els.folder.value);
  const category = folder?.category || els.category.value || DEFAULT_CATEGORY;

  return {
    title: els.title.value.trim(),
    category,
    folder,
    body,
    plainText,
    characterCounts,
    reading_time: getReadingTimeLabel(plainText),
    published: els.published.checked,
  };
}

function setEditorMessage(message = "", type = "info") {
  els.message.textContent = message;
  els.message.dataset.type = type;
}

function setEditorBusy(isBusy) {
  state.editorSaving = isBusy;
  els.submit.disabled = isBusy;
  els.submit.textContent = isBusy ? "게시 중" : "게시";
}

function setEditorSaveState(message) {
  els.saveState.textContent = message;
}

function markEditorDirty() {
  setEditorSaveState("변경사항 미저장");
  if (els.message.dataset.type === "success") {
    setEditorMessage("");
  }
}

function saveEditorDraft() {
  if (!state.id) return;
  const draft = {
    title: els.title.value,
    category: els.category.value,
    folder_id: els.folder.value,
    body: els.content.innerHTML,
    published: els.published.checked,
    saved_at: new Date().toISOString(),
  };
  localStorage.setItem(editorDraftKey(), JSON.stringify(draft));
  setEditorSaveState("임시 저장됨");
  setEditorMessage("임시 저장했습니다.", "success");
}

function loadEditorDraft() {
  return safeParseJson(localStorage.getItem(editorDraftKey()), null);
}

function clearEditorDraft() {
  localStorage.removeItem(editorDraftKey());
}

function syncEditorStats() {
  const values = collectEditorValues();
  els.charWithSpaces.textContent = `${values.characterCounts.withSpaces}자`;
  els.charWithoutSpaces.textContent = `${values.characterCounts.withoutSpaces}자`;
  syncVisibilityButtons();
}

function syncVisibilityButtons() {
  els.visibilityButtons.forEach((button) => {
    const isPublicButton = button.dataset.editorVisibility === "public";
    const isActive = isPublicButton === els.published.checked;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setPublishedValue(isPublished) {
  els.published.checked = Boolean(isPublished);
  syncEditorStats();
}

function nodeIsInEditor(node) {
  if (!node) return false;
  return node === els.content || els.content.contains(node);
}

function saveCurrentSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !nodeIsInEditor(selection.anchorNode)) return;
  savedEditorRange = selection.getRangeAt(0).cloneRange();
}

function restoreEditorSelection() {
  els.content.focus();
  const selection = window.getSelection();
  selection.removeAllRanges();

  if (savedEditorRange) {
    selection.addRange(savedEditorRange);
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(els.content);
  range.collapse(false);
  selection.addRange(range);
  savedEditorRange = range.cloneRange();
}

function applyInlineStyle(property, value) {
  restoreEditorSelection();
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  const span = document.createElement("span");
  span.style[property] = value;

  if (range.collapsed) {
    span.appendChild(document.createTextNode("\u200b"));
    range.insertNode(span);
    range.setStart(span.firstChild, 1);
    range.collapse(true);
  } else {
    span.appendChild(range.extractContents());
    range.insertNode(span);
    range.selectNodeContents(span);
  }

  selection.removeAllRanges();
  selection.addRange(range);
  syncEditorStats();
  markEditorDirty();
  saveCurrentSelection();
}

function normalizeFontSize(value) {
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size)) return "";
  return `${Math.min(96, Math.max(8, size))}px`;
}

function applyFontSizeFromInput() {
  const size = normalizeFontSize(els.fontSize.value);
  if (!size) return;
  els.fontSize.value = size.replace("px", "");
  applyInlineStyle("fontSize", size);
}

function getClosestEditorBlock(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.("p, div, li, h1, h2, h3, h4, h5, h6, blockquote, td, th") || null;
}

function getSelectedEditorBlocks() {
  restoreEditorSelection();
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [];

  const range = selection.getRangeAt(0);
  const blocks = new Set();
  const startBlock = getClosestEditorBlock(range.startContainer);
  const endBlock = getClosestEditorBlock(range.endContainer);

  if (startBlock && els.content.contains(startBlock)) blocks.add(startBlock);
  if (endBlock && els.content.contains(endBlock)) blocks.add(endBlock);

  els.content
    .querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, blockquote, td, th")
    .forEach((block) => {
      if (range.intersectsNode(block)) blocks.add(block);
    });

  if (blocks.size === 0) {
    blocks.add(els.content);
  }

  return [...blocks].filter((block) => block === els.content || els.content.contains(block));
}

function applyBlockStyle(property, value) {
  getSelectedEditorBlocks().forEach((block) => {
    block.style[property] = value;
  });
  syncEditorStats();
  markEditorDirty();
  saveCurrentSelection();
}

function executeEditorCommand(command, value = null) {
  restoreEditorSelection();
  document.execCommand(command, false, value);
  syncEditorStats();
  markEditorDirty();
  saveCurrentSelection();
}

function applyColor(target, color) {
  if (target === "foreground") {
    executeEditorCommand("foreColor", color);
    return;
  }

  if (color === "transparent") {
    executeEditorCommand("backColor", "#ffffff");
    return;
  }

  executeEditorCommand("hiliteColor", color);
}

function insertEditorTable() {
  const rowCount = Math.min(12, Math.max(1, Number.parseInt(els.toolbar.querySelector("[data-table-rows]")?.value, 10) || 3));
  const colCount = Math.min(12, Math.max(1, Number.parseInt(els.toolbar.querySelector("[data-table-cols]")?.value, 10) || 3));
  const cells = Array.from({ length: colCount }, () => "<td><br></td>").join("");
  const rows = Array.from({ length: rowCount }, () => `<tr>${cells}</tr>`).join("");
  executeEditorCommand("insertHTML", `<table><tbody>${rows}</tbody></table><p><br></p>`);
}

function getActiveTableCell() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const node = selection.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const cell = element?.closest?.("td, th");
  return cell && els.content.contains(cell) ? cell : null;
}

function addTableRow() {
  restoreEditorSelection();
  const cell = getActiveTableCell();
  const row = cell?.closest("tr");
  if (!row) {
    setEditorMessage("행을 추가할 표 안을 클릭해주세요.", "error");
    return;
  }

  const newRow = row.cloneNode(true);
  newRow.querySelectorAll("td, th").forEach((item) => {
    item.innerHTML = "<br>";
  });
  row.after(newRow);
  syncEditorStats();
  markEditorDirty();
}

function addTableColumn() {
  restoreEditorSelection();
  const cell = getActiveTableCell();
  const row = cell?.closest("tr");
  const table = cell?.closest("table");
  if (!cell || !row || !table) {
    setEditorMessage("열을 추가할 표 안을 클릭해주세요.", "error");
    return;
  }

  const index = [...row.children].indexOf(cell);
  table.querySelectorAll("tr").forEach((tableRow) => {
    const cells = [...tableRow.children];
    const reference = cells[index] || cells[cells.length - 1];
    const newCell = document.createElement(reference?.tagName?.toLowerCase() || "td");
    newCell.innerHTML = "<br>";
    if (reference) {
      reference.after(newCell);
    } else {
      tableRow.appendChild(newCell);
    }
  });
  syncEditorStats();
  markEditorDirty();
}

function closeColorMenus(exceptTarget = "") {
  els.toolbar.querySelectorAll("[data-color-menu]").forEach((menu) => {
    if (menu.dataset.colorMenu !== exceptTarget) {
      menu.hidden = true;
    }
  });
}

function closeEditorMiniMenus(exceptMenu = null) {
  els.toolbar.querySelectorAll("[data-line-menu], [data-table-menu]").forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.hidden = true;
    }
  });
}

function closeAllToolbarMenus() {
  closeColorMenus();
  closeEditorMiniMenus();
}

function clampColorPart(value) {
  return Math.min(255, Math.max(0, Number.parseInt(value, 10) || 0));
}

function rgbToHex(red, green, blue) {
  return [red, green, blue]
    .map((value) => clampColorPart(value).toString(16).padStart(2, "0"))
    .join("")
    .replace(/^/, "#");
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function normalizeHexColor(value = "") {
  const trimmed = String(value).trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    return `#${trimmed}`.toLowerCase();
  }
  return "";
}

function hsvToHex(hue, saturation, value) {
  const chroma = value * saturation;
  const segment = hue / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = value - chroma;
  const channels = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][Math.min(5, Math.floor(segment))] || [chroma, 0, second];

  return rgbToHex(
    Math.round((channels[0] + match) * 255),
    Math.round((channels[1] + match) * 255),
    Math.round((channels[2] + match) * 255)
  );
}

function renderColorDialog() {
  if (document.querySelector("[data-color-dialog]")) return;

  const dialog = document.createElement("div");
  dialog.className = "color-dialog-backdrop";
  dialog.dataset.colorDialog = "";
  dialog.hidden = true;
  dialog.innerHTML = `
    <section class="color-dialog" role="dialog" aria-modal="true" aria-label="색">
      <header class="color-dialog-titlebar">
        <span>색</span>
        <button type="button" data-color-dialog-close aria-label="닫기">×</button>
      </header>
      <div class="color-dialog-layout">
        <div class="color-dialog-main">
          <div class="color-dialog-tabs" role="tablist">
            <button class="is-active" type="button" data-color-dialog-tab="basic">기본</button>
            <button type="button" data-color-dialog-tab="custom">사용자 지정</button>
          </div>
          <div class="color-dialog-panel" data-color-dialog-panel="basic">
            <p>색(C):</p>
            <div class="color-dialog-basic-grid">
              ${BASIC_DIALOG_COLORS.map(
                (color) => `
                  <button
                    type="button"
                    class="color-dialog-swatch"
                    style="--dialog-swatch:${color}"
                    data-dialog-color="${color}"
                    aria-label="${color}"
                  ></button>
                `
              ).join("")}
            </div>
          </div>
          <div class="color-dialog-panel" data-color-dialog-panel="custom" hidden>
            <p>색(C):</p>
            <div class="color-spectrum" data-color-spectrum>
              <i data-color-spectrum-marker></i>
            </div>
            <div class="color-dialog-fields">
              <label>색 모델(D): <select aria-label="색 모델"><option>RGB</option></select></label>
              <label>빨강(R): <input type="number" min="0" max="255" data-color-red></label>
              <label>녹색(G): <input type="number" min="0" max="255" data-color-green></label>
              <label>파랑(B): <input type="number" min="0" max="255" data-color-blue></label>
              <label>16진수(H): <input type="text" data-color-hex maxlength="7"></label>
            </div>
          </div>
        </div>
        <aside class="color-dialog-side">
          <button class="color-dialog-ok" type="button" data-color-dialog-ok>확인</button>
          <button type="button" data-color-dialog-cancel>취소</button>
          <div class="color-preview-block" style="--dialog-color:#000000"></div>
          <span>새 색</span>
          <span>현재 색</span>
        </aside>
      </div>
    </section>
  `;
  document.body.appendChild(dialog);
}

function getColorDialog() {
  renderColorDialog();
  return document.querySelector("[data-color-dialog]");
}

function setColorDialogPanel(panelName) {
  const dialog = getColorDialog();
  dialog.querySelectorAll("[data-color-dialog-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.colorDialogTab === panelName);
  });
  dialog.querySelectorAll("[data-color-dialog-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.colorDialogPanel !== panelName;
  });
}

function syncColorDialogFields(color) {
  const normalized = normalizeHexColor(color) || "#000000";
  const rgb = hexToRgb(normalized);
  const dialog = getColorDialog();

  colorDialogValue = normalized;
  dialog.querySelector("[data-color-red]").value = rgb.red;
  dialog.querySelector("[data-color-green]").value = rgb.green;
  dialog.querySelector("[data-color-blue]").value = rgb.blue;
  dialog.querySelector("[data-color-hex]").value = normalized;
  dialog.querySelector(".color-preview-block").style.setProperty("--dialog-color", normalized);
}

function openColorDialog(target) {
  colorDialogTarget = target;
  closeAllToolbarMenus();
  const dialog = getColorDialog();
  syncColorDialogFields(colorDialogValue);
  setColorDialogPanel("basic");
  dialog.hidden = false;
}

function closeColorDialog() {
  getColorDialog().hidden = true;
}

function updateColorDialogFromRgbFields() {
  const dialog = getColorDialog();
  syncColorDialogFields(
    rgbToHex(
      dialog.querySelector("[data-color-red]").value,
      dialog.querySelector("[data-color-green]").value,
      dialog.querySelector("[data-color-blue]").value
    )
  );
}

function updateColorDialogFromSpectrum(event) {
  const spectrum = event.currentTarget;
  const rect = spectrum.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  const marker = spectrum.querySelector("[data-color-spectrum-marker]");
  marker.style.left = `${x * 100}%`;
  marker.style.top = `${y * 100}%`;
  syncColorDialogFields(hsvToHex(x * 360, 1, 1 - y));
}

function renderColorMenus() {
  els.toolbar.querySelectorAll("[data-color-menu]").forEach((menu) => {
    const target = menu.dataset.colorMenu;
    const emptyLabel = target === "foreground" ? "자동 색(A)" : "채우기 없음(N)";
    menu.innerHTML = `
      <div class="color-menu-section">
        <p>테마 색</p>
        <div class="theme-color-grid">
          ${THEME_COLOR_COLUMNS.map(
            (column) => `
              <div class="theme-color-column">
                ${column
                  .map(
                    (color) => `
                      <button
                        type="button"
                        class="color-swatch"
                        style="--swatch:${color}"
                        data-color-target="${target}"
                        data-color-value="${color}"
                        aria-label="${color}"
                      ></button>
                    `
                  )
                  .join("")}
              </div>
            `
          ).join("")}
        </div>
      </div>
      <div class="color-menu-section">
        <p>표준 색</p>
        <div class="standard-color-grid">
          ${STANDARD_COLORS.map(
            (color) => `
              <button
                type="button"
                class="color-swatch"
                style="--swatch:${color}"
                data-color-target="${target}"
                data-color-value="${color}"
                aria-label="${color}"
              ></button>
            `
          ).join("")}
        </div>
      </div>
      <button type="button" class="color-menu-option" data-color-target="${target}" data-color-value="transparent">
        <span class="empty-swatch" aria-hidden="true"></span>
        ${emptyLabel}
      </button>
      <button type="button" class="color-menu-option" data-color-custom="${target}">
        <span class="palette-dot" aria-hidden="true"></span>
        다른 색(M)...
      </button>
    `;
  });
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
    body: values.body,
    category: values.category,
    author: state.id,
    login_id: state.id,
    user_id: session.user?.id,
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
      body: payload.body,
      category: payload.category,
      author: payload.author,
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

function returnToBlog() {
  if (state.editorSaving) return;
  window.location.href = "./my-blog.html";
}

async function handleEditorSubmit(event) {
  event.preventDefault();

  try {
    setEditorBusy(true);
    setEditorMessage("게시 중입니다...");
    await publishEditorPost();
    clearEditorDraft();
    setEditorMessage("게시가 완료되었습니다.", "success");
    window.setTimeout(() => {
      window.location.href = "./my-blog.html";
    }, 450);
  } catch (error) {
    setEditorMessage(error.message, "error");
  } finally {
    setEditorBusy(false);
  }
}

async function initEditor() {
  const session = getSession();
  state.id = getSessionId(session);

  if (!state.id) {
    window.location.href = "./login.html";
    return;
  }

  try {
    const rows = await fetchPosts();
    state.posts = rows
      .filter((post) => belongsToAccount(post, state.id))
      .map(normalizePost)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  } catch {
    state.posts = [];
  }

  state.storedTreeData = await loadTreeData();
  buildTree();

  const defaults = getEditorDefaults();
  const draft = loadEditorDraft();
  els.title.value = draft?.title || "";
  renderEditorCategoryOptions(draft?.category || defaults.category);
  renderEditorFolderOptions(draft?.folder_id || defaults.folderId);
  els.folder.value = draft?.folder_id || defaults.folderId;
  els.content.innerHTML = draft?.body || "";
  els.published.checked = draft?.published ?? true;
  setEditorSaveState(draft ? "임시 저장 불러옴" : "임시 저장 준비");
  renderColorMenus();
  setEditorMessage("");
  syncEditorStats();
  window.setTimeout(() => els.title.focus(), 0);
}

els.close.addEventListener("click", returnToBlog);
els.form.addEventListener("submit", handleEditorSubmit);
els.draft.addEventListener("click", () => {
  saveEditorDraft();
  saveCurrentSelection();
});

els.form.addEventListener("input", () => {
  syncEditorStats();
  markEditorDirty();
  saveCurrentSelection();
});

els.content.addEventListener("mouseup", saveCurrentSelection);
els.content.addEventListener("keyup", saveCurrentSelection);
document.addEventListener("selectionchange", saveCurrentSelection);

els.category.addEventListener("change", () => {
  renderEditorFolderOptions(els.folder.value);
  markEditorDirty();
});

els.folder.addEventListener("change", () => {
  markEditorDirty();
});

els.visibilityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setPublishedValue(button.dataset.editorVisibility === "public");
    markEditorDirty();
  });
});

els.fontFamily.addEventListener("change", (event) => {
  applyInlineStyle("fontFamily", event.target.value);
});

els.fontSize.addEventListener("change", applyFontSizeFromInput);

els.fontSize.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyFontSizeFromInput();
});

els.toolbar.addEventListener("mousedown", (event) => {
  if (event.target.closest("button")) {
    event.preventDefault();
  }
});

els.toolbar.addEventListener("click", (event) => {
  const colorToggle = event.target.closest("[data-color-menu-toggle]");
  if (colorToggle) {
    const target = colorToggle.dataset.colorMenuToggle;
    const menu = els.toolbar.querySelector(`[data-color-menu="${target}"]`);
    const willOpen = menu.hidden;
    closeEditorMiniMenus();
    closeColorMenus(target);
    menu.hidden = !willOpen;
    return;
  }

  const lineToggle = event.target.closest("[data-line-menu-toggle]");
  if (lineToggle) {
    const menu = els.toolbar.querySelector("[data-line-menu]");
    const willOpen = menu.hidden;
    closeColorMenus();
    closeEditorMiniMenus(menu);
    menu.hidden = !willOpen;
    return;
  }

  const lineHeightButton = event.target.closest("[data-line-height]");
  if (lineHeightButton) {
    applyBlockStyle("lineHeight", lineHeightButton.dataset.lineHeight);
    closeEditorMiniMenus();
    return;
  }

  const tableToggle = event.target.closest("[data-table-menu-toggle]");
  if (tableToggle) {
    const menu = els.toolbar.querySelector("[data-table-menu]");
    const willOpen = menu.hidden;
    closeColorMenus();
    closeEditorMiniMenus(menu);
    menu.hidden = !willOpen;
    return;
  }

  const swatch = event.target.closest("[data-color-value]");
  if (swatch) {
    applyColor(swatch.dataset.colorTarget, swatch.dataset.colorValue);
    closeColorMenus();
    return;
  }

  const customColor = event.target.closest("[data-color-custom]");
  if (customColor) {
    openColorDialog(customColor.dataset.colorCustom);
    return;
  }

  if (event.target.closest("[data-table-insert]")) {
    insertEditorTable();
    closeEditorMiniMenus();
    return;
  }

  if (event.target.closest("[data-table-add-row]")) {
    addTableRow();
    closeEditorMiniMenus();
    return;
  }

  if (event.target.closest("[data-table-add-col]")) {
    addTableColumn();
    closeEditorMiniMenus();
    return;
  }

  const commandButton = event.target.closest("[data-editor-command]");
  if (commandButton) {
    executeEditorCommand(commandButton.dataset.editorCommand, commandButton.dataset.value || null);
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".editor-color-control") && !event.target.closest(".editor-table-control")) {
    closeAllToolbarMenus();
  }
});

document.addEventListener("click", (event) => {
  const dialog = event.target.closest("[data-color-dialog]");
  if (!dialog) return;

  if (event.target.matches("[data-color-dialog]") || event.target.closest("[data-color-dialog-close], [data-color-dialog-cancel]")) {
    closeColorDialog();
    return;
  }

  const tab = event.target.closest("[data-color-dialog-tab]");
  if (tab) {
    setColorDialogPanel(tab.dataset.colorDialogTab);
    return;
  }

  const swatch = event.target.closest("[data-dialog-color]");
  if (swatch) {
    syncColorDialogFields(swatch.dataset.dialogColor);
    return;
  }

  if (event.target.closest("[data-color-dialog-ok]")) {
    applyColor(colorDialogTarget, colorDialogValue);
    closeColorDialog();
  }
});

document.addEventListener("input", (event) => {
  if (!event.target.closest("[data-color-dialog]")) return;

  if (event.target.matches("[data-color-red], [data-color-green], [data-color-blue]")) {
    updateColorDialogFromRgbFields();
    return;
  }

  if (event.target.matches("[data-color-hex]")) {
    const normalized = normalizeHexColor(event.target.value);
    if (normalized) {
      syncColorDialogFields(normalized);
    }
  }
});

document.addEventListener("pointerdown", (event) => {
  const spectrum = event.target.closest("[data-color-spectrum]");
  if (!spectrum) return;
  colorDialogPointerActive = true;
  updateColorDialogFromSpectrum({ currentTarget: spectrum, clientX: event.clientX, clientY: event.clientY });
});

document.addEventListener("pointermove", (event) => {
  if (!colorDialogPointerActive) return;
  const spectrum = getColorDialog().querySelector("[data-color-spectrum]");
  updateColorDialogFromSpectrum({ currentTarget: spectrum, clientX: event.clientX, clientY: event.clientY });
});

document.addEventListener("pointerup", () => {
  colorDialogPointerActive = false;
});

els.form.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveEditorDraft();
  }
});

initEditor();
