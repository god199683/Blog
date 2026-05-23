const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const ALL_FILTER = "all";
const DEFAULT_CATEGORY = "전체";
const TREE_STORAGE_PREFIX = "blog.categoryTree.";
const EDITOR_DRAFT_PREFIX = "blog.editorDraft.";
const EDITOR_FONT_PREFIX = "blog.editorFonts.";
const EDITOR_HISTORY_LIMIT = 120;
const EDITOR_PARAMS = new URLSearchParams(window.location.search);
const EDITOR_TARGET = EDITOR_PARAMS.get("target") === "materials" ? "materials" : "posts";
const EDITOR_BLOCK_SELECTOR = "p, div, li, h1, h2, h3, h4, h5, h6, blockquote, td, th";
const EDITOR_MIDDLE_ELLIPSIS = "⋯";
const EDITOR_ELLIPSIS_BACKSPACE_TEXT = "....";

const state = {
  id: "",
  posts: [],
  tree: [],
  activeNodeId: EDITOR_PARAMS.get("node") || ALL_FILTER,
  target: EDITOR_TARGET,
  editPostId: EDITOR_PARAMS.get("post") || "",
  editMaterialId: EDITOR_PARAMS.get("material") || "",
  forceNewPost: EDITOR_PARAMS.get("mode") === "new",
  editingPost: null,
  editingMaterial: null,
  hiddenCategoryIds: new Set(),
  storedTreeData: null,
  editorSaving: false,
  locationOptions: [],
  pendingLocationKey: "",
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
  addFont: document.querySelector("[data-editor-add-font]"),
  removeFont: document.querySelector("[data-editor-remove-font]"),
  fontSize: document.querySelector("[data-editor-font-size]"),
  draft: document.querySelector("[data-editor-draft]"),
  saveState: document.querySelector("[data-editor-save-state]"),
  submit: document.querySelector("[data-editor-submit]"),
  message: document.querySelector("[data-editor-message]"),
  charWithSpaces: document.querySelector("[data-editor-char-spaces]"),
  charWithoutSpaces: document.querySelector("[data-editor-char-nospace]"),
  published: document.querySelector("[data-editor-published]"),
  visibilityButtons: document.querySelectorAll("[data-editor-visibility]"),
  brandTitle: document.querySelector("[data-editor-brand-title]"),
  brandInitial: document.querySelector("[data-editor-brand-initial]"),
  locationDialog: document.querySelector("[data-location-dialog]"),
  locationOptions: document.querySelector("[data-location-options]"),
  locationConfirm: document.querySelector("[data-location-confirm]"),
  locationCancel: document.querySelector("[data-location-cancel]"),
  locationClose: document.querySelector("[data-location-close]"),
};

let savedEditorRange = null;
let colorDialogTarget = "foreground";
let colorDialogValue = "#000000";
let colorDialogPointerActive = false;
let locationDialogResolver = null;
let fontSizeStepPointerActive = false;
let editorHistoryStack = [];
let editorHistoryIndex = -1;
let editorHistoryRestoring = false;
let activeEditorLineHeight = "";
let lastEditorEllipsisReplacement = null;
let pendingPastePayload = null;
let pasteMenu = null;

const BUILTIN_EDITOR_FONTS = [
  "Noto Sans KR",
  "Malgun Gothic",
  "Gulim",
  "Dotum",
  "Batang",
  "Gungsuh",
  "Arial",
  "Georgia",
  "Courier New",
  "Carlito",
];
const EDITOR_INLINE_STYLE_PROPERTIES = {
  fontFamily: "font-family",
  fontSize: "font-size",
};

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
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-bottom-color",
  "border-bottom-style",
  "border-bottom-width",
  "border-collapse",
  "border-color",
  "border-left",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-right",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-spacing",
  "border-style",
  "border-top",
  "border-top-color",
  "border-top-style",
  "border-top-width",
  "border-width",
  "color",
  "font-family",
  "font-kerning",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "height",
  "line-height",
  "list-style-position",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
  "text-decoration-color",
  "text-decoration-line",
  "text-decoration-style",
  "text-indent",
  "text-transform",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
]);

const EDITOR_PASTE_OPTIONS = [
  { key: "source", label: "원본 서식 유지" },
  { key: "merge", label: "서식 병합" },
  { key: "image", label: "그림 형태" },
  { key: "text", label: "텍스트만 유지" },
];

const SOURCE_PASTE_COMPUTED_STYLES = [
  "background-color",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "line-height",
  "text-align",
  "text-decoration",
  "text-decoration-color",
  "text-decoration-line",
  "text-decoration-style",
  "text-indent",
  "text-transform",
  "vertical-align",
  "white-space",
  "word-break",
];

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

async function getFreshSession() {
  return (await window.blogSession?.refresh?.()) || getSession();
}

function getSessionId(session) {
  return window.blogSession?.getId?.(session) || "";
}

function renderEditorBrand(id) {
  const title = `${id}'s Blog`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.brandInitial) els.brandInitial.textContent = id.slice(0, 1).toUpperCase();
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
    body: raw.body || raw.content || "",
    author: raw.author || raw.author_name || raw.writer || "",
    published_at: raw.published_at || raw.created_at || raw.date || "",
    reading_time: raw.reading_time || raw.read_time || "",
    published: raw.published !== false,
  };
}

function normalizeMaterialForEditor(raw = {}) {
  return {
    id: raw.id || "",
    title: raw.title || "제목 없는 자료",
    category: raw.category || DEFAULT_CATEGORY,
    folder: raw.folder_name || "",
    folder_id: raw.folder_id || "",
    folder_name: raw.folder_name || "",
    folder_path: raw.folder_path || "",
    material_type: raw.material_type || "note",
    url: raw.url || "",
    user_id: raw.user_id || "",
    login_id: raw.login_id || "",
    body: raw.content || "",
    published: true,
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
  const token = (await getFreshSession())?.access_token || SUPABASE_ANON_KEY;

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

async function fetchPostById(postId) {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("id", `eq.${postId}`);
  endpoint.searchParams.set("limit", "1");
  const token = (await getFreshSession())?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("");
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function insertPost(payload) {
  const session = await getFreshSession();
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

async function updatePost(postId, payload) {
  const session = await getFreshSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  endpoint.searchParams.set("id", `eq.${postId}`);

  const response = await fetch(endpoint, {
    method: "PATCH",
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
    const message = data?.message || data?.hint || data?.details || "글을 수정하지 못했습니다.";
    throw new Error(message);
  }

  return Array.isArray(data) ? data[0] : data;
}

async function insertMaterial(payload) {
  const session = await getFreshSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_materials`);

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
    const message = data?.message || data?.hint || data?.details || "자료를 저장하지 못했습니다.";
    throw new Error(message);
  }

  return Array.isArray(data) ? data[0] : data;
}

async function updateMaterial(materialId, payload) {
  const session = await getFreshSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_materials`);
  endpoint.searchParams.set("id", `eq.${materialId}`);
  if (session?.user?.id) {
    endpoint.searchParams.set("user_id", `eq.${session.user.id}`);
  }

  const response = await fetch(endpoint, {
    method: "PATCH",
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
    const message = data?.message || data?.hint || data?.details || "자료를 수정하지 못했습니다.";
    throw new Error(message);
  }

  return Array.isArray(data) ? data[0] : data;
}

async function fetchMaterialById(materialId) {
  const session = await getFreshSession();
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/blog_materials`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("id", `eq.${materialId}`);
  if (session?.user?.id) {
    endpoint.searchParams.set("user_id", `eq.${session.user.id}`);
  }
  endpoint.searchParams.set("limit", "1");
  const token = session?.access_token || SUPABASE_ANON_KEY;

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("자료를 불러오지 못했습니다.");
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function categoryId(category) {
  return `category-${encodeURIComponent(String(category).toLowerCase())}`;
}

function treeStorageKey() {
  return `${TREE_STORAGE_PREFIX}${state.target}.${state.id || "guest"}`;
}

function isMaterialEditor() {
  return state.target === "materials";
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
  const session = await getFreshSession();
  if (!session?.access_token || !session.user?.id) return null;

  if (isMaterialEditor()) {
    const endpoint = new URL(`${SUPABASE_URL}/rest/v1/material_trees`);
    endpoint.searchParams.set("select", "tree,tree_collapsed_ids");
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
      hiddenCategoryIds: [],
      treeCollapsedIds: row.tree_collapsed_ids,
    });
  }

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
  const session = await getFreshSession();
  if (!session?.access_token || !session.user?.id || !state.id) return;
  if (isMaterialEditor()) return;

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

function getCategoryKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function mergeStoredCategoryNodes(nodes = []) {
  const validNodes = nodes.filter(Boolean);
  if (validNodes.length === 0) return null;

  const merged = cloneNode(validNodes[0]);
  const childIds = new Set();
  merged.children = [];

  validNodes.forEach((node) => {
    (node.children || []).forEach((child) => {
      if (!child?.id || childIds.has(child.id)) return;
      childIds.add(child.id);
      merged.children.push(cloneNode(child));
    });
  });

  return merged;
}

function buildTree() {
  const stored = state.storedTreeData || getStoredTreeData();
  const storedById = flattenNodes(stored.nodes.map(cloneNode));
  state.hiddenCategoryIds = new Set(stored.hiddenCategoryIds);

  const roots = [createAllNode(storedById.get(ALL_FILTER))];

  if (isMaterialEditor()) {
    stored.nodes
      .map(cloneNode)
      .filter((node) => node.id !== ALL_FILTER && !state.hiddenCategoryIds.has(node.id))
      .forEach((node) => roots.push(node));
    state.tree = roots;
    if (!findNode(state.tree, state.activeNodeId)) {
      state.activeNodeId = ALL_FILTER;
    }
    return;
  }

  const categoryIds = new Set();
  const categoryValues = new Set();
  const storedCategoryNodes = stored.nodes
    .map(cloneNode)
    .filter((node) => node.type === "category" && node.id !== ALL_FILTER);
  const storedCategoriesByValue = new Map();

  storedCategoryNodes.forEach((node) => {
    const key = getCategoryKey(node.filterCategory || node.label);
    if (!key || (node.filterCategory || node.label) === DEFAULT_CATEGORY) return;
    const nodes = storedCategoriesByValue.get(key) || [];
    nodes.push(node);
    storedCategoriesByValue.set(key, nodes);
  });

  getCategories().forEach((category) => {
    const id = categoryId(category);
    const categoryKey = getCategoryKey(category);
    const storedNode = mergeStoredCategoryNodes([
      storedById.get(id),
      ...(storedCategoriesByValue.get(categoryKey) || []),
    ]);
    categoryIds.add(id);
    categoryValues.add(categoryKey);
    if (state.hiddenCategoryIds.has(id)) return;
    roots.push(createCategoryNode(category, storedNode));
  });

  stored.nodes.map(cloneNode).forEach((node) => {
    const categoryValue = String(node.filterCategory || node.label || "").trim();
    const categoryKey = getCategoryKey(categoryValue);
    if (
      node.type !== "category" ||
      node.id === ALL_FILTER ||
      categoryIds.has(node.id) ||
      state.hiddenCategoryIds.has(node.id) ||
      categoryValue === DEFAULT_CATEGORY ||
      categoryValues.has(categoryKey)
    ) {
      return;
    }
    categoryValues.add(categoryKey);
    roots.push(node);
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
  return `${EDITOR_DRAFT_PREFIX}${state.target}.${state.id || "guest"}`;
}

function editorFontKey() {
  return `${EDITOR_FONT_PREFIX}${state.id || "guest"}`;
}

function normalizeFontName(value = "") {
  return String(value)
    .trim()
    .replace(/[<>;{}]/g, "")
    .replace(/^['"]|['"]$/g, "")
    .slice(0, 80);
}

function quoteFontFamily(value = "") {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function formatFontFamilyValue(value = "") {
  const name = normalizeFontName(value);
  if (!name) return "";
  return `${quoteFontFamily(name)}, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
}

function getStoredEditorFonts() {
  const fonts = safeParseJson(localStorage.getItem(editorFontKey()), []);
  const cleaned = Array.isArray(fonts)
    ? fonts
        .map(normalizeFontName)
        .filter((font) => font && font !== "a시네마")
    : [];
  if (Array.isArray(fonts) && cleaned.length !== fonts.length) {
    saveStoredEditorFonts(cleaned);
  }
  return cleaned;
}

function saveStoredEditorFonts(fonts) {
  localStorage.setItem(
    editorFontKey(),
    JSON.stringify([...new Set(fonts.map(normalizeFontName).filter((font) => font && font !== "a시네마"))])
  );
}

function getEditorFonts() {
  return [...new Set([...BUILTIN_EDITOR_FONTS, ...getStoredEditorFonts()])];
}

function renderEditorFontOptions(selectedFont = "") {
  const selected = selectedFont || els.fontFamily.value || BUILTIN_EDITOR_FONTS[0];
  els.fontFamily.innerHTML = getEditorFonts()
    .map((font) => `<option value="${escapeHtml(font)}" ${font === selected ? "selected" : ""}>${escapeHtml(font)}</option>`)
    .join("");
}

function addEditorFont() {
  const name = normalizeFontName(window.prompt("추가할 글씨체 이름을 입력해주세요.", ""));
  if (!name) return;

  const storedFonts = getStoredEditorFonts();
  saveStoredEditorFonts([...storedFonts, name]);
  renderEditorFontOptions(name);
  applyFontFamily(name);
}

function removeEditorFont() {
  const name = normalizeFontName(els.fontFamily.value);
  if (!name) return;
  if (BUILTIN_EDITOR_FONTS.includes(name)) {
    window.alert("기본 글씨체는 삭제할 수 없습니다.");
    return;
  }

  const nextFonts = getStoredEditorFonts().filter((font) => font !== name);
  saveStoredEditorFonts(nextFonts);
  renderEditorFontOptions(BUILTIN_EDITOR_FONTS[0]);
  applyFontFamily(BUILTIN_EDITOR_FONTS[0]);
}

function getCategoryOptions() {
  const seen = new Set();
  return state.tree
    .filter((node) => node.type === "category")
    .flatMap((node) => {
      const value = String(node.filterCategory || node.label || "").trim();
      const label = String(node.label || value).trim();
      const key = value.toLowerCase();
      if (!value || value === DEFAULT_CATEGORY || seen.has(key)) return [];
      seen.add(key);
      return [{ label, value }];
    });
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
  const categoryKey = getCategoryKey(category);
  const seenFolders = new Set();
  const allFolders = collectFolderOptions();
  let folders = allFolders
    .filter((folder) => !categoryKey || !folder.category || getCategoryKey(folder.category) === categoryKey)
    .filter((folder) => {
      const key = `${folder.category || ""}::${folder.path || folder.label || folder.id}`.trim().toLowerCase();
      if (seenFolders.has(key)) return false;
      seenFolders.add(key);
      return true;
    });
  const selectedFolder = allFolders.find((folder) => folder.id === selectedFolderId);
  if (selectedFolder && !folders.some((folder) => folder.id === selectedFolder.id)) {
    folders = [selectedFolder, ...folders];
  }
  if (categoryKey && folders.length === 0) {
    folders = allFolders;
  }

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

function collectLocationOptions() {
  const options = [
    {
      key: "all",
      type: "all",
      typeLabel: "전체",
      label: "전체",
      path: "전체",
      category: "",
      folderId: "",
    },
  ];

  function walk(nodes = [], path = [], category = "") {
    nodes.forEach((node) => {
      if (node.id === ALL_FILTER) {
        walk(node.children || [], path, category);
        return;
      }

      const isCategory = node.type === "category";
      const nextCategory = isCategory ? node.filterCategory || node.label : category;
      const nextPath = [...path, node.label || (isCategory ? "카테고리" : "폴더")];

      if (isCategory) {
        options.push({
          key: `category:${node.id}`,
          type: "category",
          typeLabel: "카테고리",
          label: node.label,
          path: nextPath.join(" / "),
          category: nextCategory,
          folderId: "",
        });
      } else if (node.type === "folder") {
        options.push({
          key: `folder:${node.id}`,
          type: "folder",
          typeLabel: "폴더",
          label: node.label,
          path: nextPath.join(" / "),
          category: nextCategory,
          folderId: node.id,
        });
      }

      walk(node.children || [], nextPath, nextCategory);
    });
  }

  walk(state.tree);
  return options;
}

function getCurrentLocationKey() {
  if (els.folder.value) return `folder:${els.folder.value}`;

  const category = els.category.value;
  if (!category) return "all";

  const categoryOption = collectLocationOptions().find(
    (option) => option.type === "category" && option.category === category
  );
  return categoryOption?.key || "all";
}

function getLocationCategoryKey(option, options = state.locationOptions) {
  if (!option || option.type === "all") return "all";
  if (option.type === "category") return option.key;

  const categoryOption = options.find(
    (item) => item.type === "category" && item.category === option.category
  );
  return categoryOption?.key || "all";
}

function getActiveLocationCategoryKey(options = state.locationOptions) {
  const pending = options.find((option) => option.key === state.pendingLocationKey);
  return getLocationCategoryKey(pending, options);
}

function renderLocationOptions(selectedKey = "all") {
  if (!els.locationOptions) return;

  state.locationOptions = collectLocationOptions();
  state.pendingLocationKey = state.locationOptions.some((option) => option.key === selectedKey)
    ? selectedKey
    : "all";
  if (els.locationConfirm) {
    els.locationConfirm.textContent = isMaterialEditor() ? "선택 후 저장" : state.editPostId ? "선택 후 수정" : "선택 후 게시";
  }

  const activeCategoryKey = getActiveLocationCategoryKey();
  const categories = state.locationOptions.filter((option) => option.type === "all" || option.type === "category");
  const selectedCategory = state.locationOptions.find((option) => option.key === activeCategoryKey);
  const folders = state.locationOptions.filter(
    (option) =>
      option.type === "folder" &&
      (activeCategoryKey === "all" || getLocationCategoryKey(option) === activeCategoryKey)
  );
  const categorySaveOption =
    selectedCategory?.type === "category"
      ? `
        <button
          class="editor-location-option editor-location-folder-save${
            selectedCategory.key === state.pendingLocationKey ? " is-selected" : ""
          }"
          type="button"
          data-location-key="${escapeHtml(selectedCategory.key)}"
          aria-pressed="${selectedCategory.key === state.pendingLocationKey}"
        >
          <span>폴더 없음</span>
          <strong>${escapeHtml(selectedCategory.label)}</strong>
          <small>선택한 카테고리에 바로 저장</small>
        </button>
      `
      : "";
  const folderOptions = folders.map(
    (option) => `
        <button
          class="editor-location-option${option.key === state.pendingLocationKey ? " is-selected" : ""}"
          type="button"
          data-location-key="${escapeHtml(option.key)}"
          aria-pressed="${option.key === state.pendingLocationKey}"
        >
          <span>${escapeHtml(option.typeLabel)}</span>
          <strong>${escapeHtml(option.label)}</strong>
          <small>${escapeHtml(option.path)}</small>
        </button>
      `
  );
  const folderList = [categorySaveOption, ...folderOptions].join("");

  els.locationOptions.innerHTML = `
    <section class="editor-location-column" aria-label="카테고리">
      <h3>카테고리</h3>
      <div class="editor-location-column-list">
        ${categories
          .map(
            (option) => `
              <button
                class="editor-location-option editor-location-category${
                  option.key === activeCategoryKey ? " is-active-category" : ""
                }${option.key === state.pendingLocationKey ? " is-selected" : ""}"
                type="button"
                data-location-key="${escapeHtml(option.key)}"
                aria-pressed="${option.key === state.pendingLocationKey}"
              >
                <span>${escapeHtml(option.typeLabel)}</span>
                <strong>${escapeHtml(option.label)}</strong>
                <small>${escapeHtml(option.path)}</small>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="editor-location-column" aria-label="폴더">
      <h3>폴더</h3>
      <div class="editor-location-column-list">
        ${
          folderList ||
          `<p class="editor-location-empty">${
            activeCategoryKey === "all" ? "카테고리를 선택하면 폴더가 보입니다." : "폴더가 없습니다."
          }</p>`
        }
      </div>
    </section>
  `;

  if (els.locationConfirm) {
    els.locationConfirm.disabled = !state.pendingLocationKey;
  }
}

function getPendingLocation() {
  return state.locationOptions.find((option) => option.key === state.pendingLocationKey) || null;
}

function applyEditorLocation(location) {
  if (!location) return;
  const category = location.category || "";
  renderEditorCategoryOptions(category);
  els.category.value = category;
  renderEditorFolderOptions(location.folderId || "");
  els.folder.value = location.folderId || "";
}

function closeLocationDialog(result = null) {
  if (els.locationDialog) els.locationDialog.hidden = true;
  if (locationDialogResolver) {
    locationDialogResolver(result);
    locationDialogResolver = null;
  }
}

function openLocationDialog() {
  if (!els.locationDialog || !els.locationOptions) {
    return Promise.resolve({ key: "all", category: "", folderId: "" });
  }

  renderLocationOptions(getCurrentLocationKey());
  els.locationDialog.hidden = false;

  return new Promise((resolve) => {
    locationDialogResolver = resolve;
    window.setTimeout(() => {
      els.locationOptions.querySelector(".is-selected")?.focus();
    }, 0);
  });
}

function getTextFromHtml(html = "") {
  const scratch = document.createElement("div");
  scratch.innerHTML = html;
  return scratch.textContent.replace(/\u200b/g, "");
}

function getPlainTextFromHtml(html = "") {
  return getTextFromHtml(html).replace(/\s+/g, " ").trim();
}

function textToEditorHtml(text = "") {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trimEnd())
    .filter((paragraph) => paragraph.trim());

  if (paragraphs.length === 0) return "<p><br></p>";
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function getCharacterCounts(html = "") {
  const text = getTextFromHtml(html);
  return {
    withSpaces: text.length,
    withoutSpaces: text.replace(/\s/g, "").length,
  };
}

function getSafeEditorStyleValue(property, value = "") {
  const normalizedProperty = String(property || "").trim().toLowerCase();
  const normalizedValue = String(value || "").trim();
  if (!normalizedProperty || !normalizedValue || !ALLOWED_EDITOR_STYLES.has(normalizedProperty)) return "";
  if (/expression|javascript:|url\s*\(|behavior\s*:/i.test(normalizedValue)) return "";
  return normalizedValue;
}

function applyAllowedEditorStylesFromCssText(node, cssText = "") {
  if (!(node instanceof HTMLElement) || !cssText) return;
  const scratch = document.createElement("span");
  scratch.setAttribute("style", cssText);

  ALLOWED_EDITOR_STYLES.forEach((property) => {
    const value = getSafeEditorStyleValue(property, scratch.style.getPropertyValue(property));
    if (!value) return;
    node.style.setProperty(property, value);
  });
}

function normalizeSourceCssSelector(selector = "") {
  const normalized = String(selector || "")
    .trim()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^(?:html|body)\s+/i, "")
    .replace(/^body(?=[.#])/i, "");
  if (
    !normalized ||
    normalized.length > 160 ||
    normalized.startsWith("@") ||
    /[:[\]>+~*]/.test(normalized)
  ) {
    return "";
  }
  return normalized;
}

function applyPastedCssStyleRule(scope, rule) {
  if (!rule?.selectorText || !rule.style?.cssText) return;
  const selectors = rule.selectorText
    .split(",")
    .map(normalizeSourceCssSelector)
    .filter(Boolean);

  selectors.forEach((selector) => {
    try {
      scope.querySelectorAll(selector).forEach((node) => {
        applyAllowedEditorStylesFromCssText(node, rule.style.cssText);
      });
    } catch {
      // Clipboard CSS often contains source-app selectors that are not valid in querySelectorAll.
    }
  });
}

function applyPastedCssRules(scope, rules) {
  [...rules].forEach((rule) => {
    if (rule.type === CSSRule.STYLE_RULE) {
      applyPastedCssStyleRule(scope, rule);
      return;
    }

    if (rule.cssRules) {
      try {
        applyPastedCssRules(scope, rule.cssRules);
      } catch {
        // Some nested rules are intentionally unreadable; ignore them.
      }
    }
  });
}

function inlinePastedStyleRules(fragment) {
  if (!fragment.querySelector("style")) return;

  const doc = document.implementation.createHTMLDocument("pasted-source");
  const wrapper = doc.createElement("div");
  [...fragment.childNodes].forEach((node) => {
    wrapper.append(doc.importNode(node, true));
  });
  doc.body.append(wrapper);

  [...doc.styleSheets].forEach((sheet) => {
    try {
      applyPastedCssRules(wrapper, sheet.cssRules);
    } catch {
      // Clipboard style sheets can contain blocked or malformed rules.
    }
  });

  fragment.replaceChildren(...[...wrapper.childNodes].map((node) => document.importNode(node, true)));
}

function normalizeLegacyPastedFormatting(fragment) {
  fragment.querySelectorAll("font").forEach((node) => {
    const face = node.getAttribute("face");
    const color = node.getAttribute("color");
    const size = Number.parseInt(node.getAttribute("size"), 10);
    if (face) node.style.fontFamily = face;
    if (color) node.style.color = color;
    if (Number.isFinite(size)) {
      const mappedSize = {
        1: "10px",
        2: "13px",
        3: "16px",
        4: "18px",
        5: "24px",
        6: "32px",
        7: "48px",
      }[Math.min(7, Math.max(1, size))];
      node.style.fontSize = mappedSize;
    }
  });

  fragment.querySelectorAll("*").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const align = node.getAttribute("align");
    const valign = node.getAttribute("valign");
    const bgColor = node.getAttribute("bgcolor");
    const width = node.getAttribute("width");
    const height = node.getAttribute("height");

    if (/^(left|center|right|justify)$/i.test(align || "")) {
      node.style.textAlign = align.toLowerCase();
    }
    if (/^(top|middle|bottom|baseline)$/i.test(valign || "")) {
      node.style.verticalAlign = valign.toLowerCase();
    }
    if (bgColor) node.style.backgroundColor = bgColor;
    if (width && /^\d+(?:\.\d+)?%?$/.test(width)) {
      node.style.width = width.endsWith("%") ? width : `${width}px`;
    }
    if (height && /^\d+(?:\.\d+)?%?$/.test(height)) {
      node.style.height = height.endsWith("%") ? height : `${height}px`;
    }
  });
}

function cleanEditorHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;
  inlinePastedStyleRules(template.content);
  normalizeLegacyPastedFormatting(template.content);
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => {
    node.remove();
  });
  template.content.querySelectorAll("[data-editor-paste-marker]").forEach((node) => {
    node.remove();
  });
  template.content.querySelectorAll("[data-editor-selection-hold]").forEach((node) => {
    if (!node.getAttribute("style")) {
      node.replaceWith(...node.childNodes);
      return;
    }
    node.removeAttribute("data-editor-selection-hold");
  });
  template.content.querySelectorAll("[data-editor-style-caret]").forEach((node) => {
    if (!node.textContent.replace(/\u200b/g, "").trim() && node.children.length === 0) {
      node.remove();
    } else {
      node.removeAttribute("data-editor-style-caret");
    }
  });
  template.content.querySelectorAll("*").forEach((node) => {
    const safeStyles = [];

    ALLOWED_EDITOR_STYLES.forEach((property) => {
      const value = getSafeEditorStyleValue(property, node.style.getPropertyValue(property));
      if (!value) return;
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
  return template.innerHTML.replace(/\u200b/g, "").trim();
}

function mergeEditorHtmlWithCurrentStyle(html = "") {
  const template = document.createElement("template");
  template.innerHTML = cleanEditorHtml(html);

  template.content.querySelectorAll("*").forEach((node) => {
    node.removeAttribute("style");
    node.removeAttribute("class");
    node.removeAttribute("id");
    node.removeAttribute("width");
    node.removeAttribute("height");
    node.removeAttribute("face");
    node.removeAttribute("size");
    node.removeAttribute("color");

    if (node.tagName === "FONT") {
      node.replaceWith(...node.childNodes);
    }
  });

  template.content.querySelectorAll("span").forEach((node) => {
    if (node.attributes.length === 0) node.replaceWith(...node.childNodes);
  });

  return template.innerHTML.trim();
}

function readClipboardImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("이미지를 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

function wrapCanvasText(context, text, maxWidth) {
  const wrappedLines = [];
  String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((rawLine) => {
      const words = rawLine.trim() ? rawLine.split(/(\s+)/).filter(Boolean) : [""];
      let line = "";
      words.forEach((word) => {
        const candidate = `${line}${word}`;
        if (line && context.measureText(candidate).width > maxWidth) {
          wrappedLines.push(line.trimEnd());
          line = word.trimStart();
        } else {
          line = candidate;
        }
      });
      wrappedLines.push(line.trimEnd());
    });
  return wrappedLines;
}

function buildPastedTextImage(text = "") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const style = window.getComputedStyle(getActiveEditorStyleElement() || els.content);
  const fontSize = Math.min(28, Math.max(14, Number.parseFloat(style.fontSize) || 16));
  const fontFamily = style.fontFamily || '"Noto Sans KR", sans-serif';
  const padding = 36;
  const maxTextWidth = 900;
  const lineHeight = Math.round(fontSize * 1.65);

  context.font = `${fontSize}px ${fontFamily}`;
  const lines = wrapCanvasText(context, text || " ", maxTextWidth);
  const textWidth = Math.max(220, Math.min(maxTextWidth, ...lines.map((line) => context.measureText(line).width)));
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.max(100, Math.ceil(lines.length * lineHeight + padding * 2));

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#d8eafb";
  context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  context.font = `${fontSize}px ${fontFamily}`;
  context.fillStyle = "#20364a";
  context.textBaseline = "top";
  lines.forEach((line, index) => {
    context.fillText(line || " ", padding, padding + index * lineHeight);
  });

  return canvas.toDataURL("image/png");
}

function getPastePlainText(payload = {}) {
  return payload.text || getPlainTextFromHtml(payload.html || "");
}

async function readClipboardTextFromItem(item, type) {
  const blob = await item.getType(type);
  return blob.text();
}

async function readRichClipboardPayload() {
  if (!navigator.clipboard?.read) return null;

  try {
    const items = await navigator.clipboard.read();
    let html = "";
    let text = "";

    for (const item of items) {
      if (!html && item.types.includes("text/html")) {
        html = await readClipboardTextFromItem(item, "text/html");
      }
      if (!text && item.types.includes("text/plain")) {
        text = await readClipboardTextFromItem(item, "text/plain");
      }
      if (html && text) break;
    }

    return html || text ? { html, text, imageFiles: [] } : null;
  } catch {
    return null;
  }
}

async function resolveSourcePastePayload(payload = {}) {
  if (payload.html) return payload;
  const richPayload = await readRichClipboardPayload();
  if (!richPayload?.html) return payload;
  return {
    ...payload,
    ...richPayload,
    imageFiles: payload.imageFiles || richPayload.imageFiles || [],
  };
}

async function buildPasteHtml(mode, payload = {}) {
  const sourcePayload = mode === "source" ? await resolveSourcePastePayload(payload) : payload;
  const html = sourcePayload.html || "";
  const text = getPastePlainText(sourcePayload);
  const imageFile = payload.imageFiles?.[0] || null;

  if (mode === "source") {
    if (html) return cleanEditorHtml(html) || textToEditorHtml(text);
    if (imageFile) {
      const imageUrl = await readClipboardImageFile(imageFile);
      return `<p><img src="${escapeHtml(imageUrl)}" alt="붙여넣은 이미지"></p>`;
    }
    return textToEditorHtml(text);
  }

  if (mode === "merge") {
    if (html) return mergeEditorHtmlWithCurrentStyle(html) || textToEditorHtml(text);
    if (imageFile) {
      const imageUrl = await readClipboardImageFile(imageFile);
      return `<p><img src="${escapeHtml(imageUrl)}" alt="붙여넣은 이미지"></p>`;
    }
    return textToEditorHtml(text);
  }

  if (mode === "text") {
    return textToEditorHtml(text);
  }

  if (mode === "image") {
    if (imageFile) {
      const imageUrl = await readClipboardImageFile(imageFile);
      return `<p><img src="${escapeHtml(imageUrl)}" alt="붙여넣은 이미지"></p>`;
    }
    const imageUrl = buildPastedTextImage(text || getPlainTextFromHtml(html));
    return `<p><img src="${escapeHtml(imageUrl)}" alt="붙여넣은 내용 이미지"></p>`;
  }

  return textToEditorHtml(text);
}

function createNativePasteMarker(kind) {
  const marker = document.createElement("span");
  marker.dataset.editorPasteMarker = kind;
  marker.setAttribute("aria-hidden", "true");
  marker.setAttribute("contenteditable", "false");
  marker.style.cssText = "display:none";
  marker.textContent = "\u200b";
  return marker;
}

function insertNativePasteMarkers() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;

  const range = selection.getRangeAt(0);
  if (!rangeIsInEditor(range)) return null;

  const startMarker = createNativePasteMarker("start");
  const endMarker = createNativePasteMarker("end");
  const pasteRange = range.cloneRange();

  pasteRange.deleteContents();
  pasteRange.insertNode(endMarker);
  pasteRange.insertNode(startMarker);
  pasteRange.setStartAfter(startMarker);
  pasteRange.setEndBefore(endMarker);

  selection.removeAllRanges();
  selection.addRange(pasteRange);
  savedEditorRange = pasteRange.cloneRange();

  return { startMarker, endMarker };
}

function getNativePasteRange(payload = {}) {
  const { startMarker, endMarker } = payload;
  if (!startMarker?.isConnected || !endMarker?.isConnected) return null;

  const range = document.createRange();
  try {
    range.setStartAfter(startMarker);
    range.setEndBefore(endMarker);
    return range;
  } catch {
    return null;
  }
}

function nodeIsFullyInsideRange(node, range) {
  const nodeRange = document.createRange();
  try {
    nodeRange.selectNode(node);
    return (
      range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0 &&
      range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0
    );
  } catch {
    return false;
  }
}

function computedStyleValueShouldBeKept(property, value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (property === "background-color" && /^(transparent|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(normalized)) {
    return false;
  }
  return Boolean(getSafeEditorStyleValue(property, normalized));
}

function inlineComputedSourcePasteStyles(node) {
  if (!(node instanceof HTMLElement)) return;
  const computed = window.getComputedStyle(node);

  SOURCE_PASTE_COMPUTED_STYLES.forEach((property) => {
    const value = computed.getPropertyValue(property);
    if (!computedStyleValueShouldBeKept(property, value)) return;
    node.style.setProperty(property, value);
  });
}

function wrapNativePastedTextNode(textNode, range) {
  if (!textNode?.textContent || !nodeIsFullyInsideRange(textNode, range)) return null;
  const parent = textNode.parentElement;
  if (!parent || parent.dataset?.editorPasteMarker) return null;

  const span = document.createElement("span");
  const computed = window.getComputedStyle(parent);
  SOURCE_PASTE_COMPUTED_STYLES.forEach((property) => {
    const value = computed.getPropertyValue(property);
    if (!computedStyleValueShouldBeKept(property, value)) return;
    span.style.setProperty(property, value);
  });

  textNode.replaceWith(span);
  span.append(textNode);
  return span;
}

function inlineNativePastedComputedStyles(payload = {}) {
  const range = getNativePasteRange(payload);
  if (!range) return "";

  const textWalker = document.createTreeWalker(els.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (textWalker.nextNode()) {
    const node = textWalker.currentNode;
    if (node.textContent && nodeIsFullyInsideRange(node, range)) {
      textNodes.push(node);
    }
  }
  textNodes.forEach((node) => wrapNativePastedTextNode(node, range));

  const nextRange = getNativePasteRange(payload);
  if (!nextRange) return "";

  const elementWalker = document.createTreeWalker(els.content, NodeFilter.SHOW_ELEMENT);
  const elements = [];
  while (elementWalker.nextNode()) {
    const node = elementWalker.currentNode;
    if (
      node !== payload.startMarker &&
      node !== payload.endMarker &&
      nodeIsFullyInsideRange(node, nextRange)
    ) {
      elements.push(node);
    }
  }
  elements.forEach(inlineComputedSourcePasteStyles);

  const fragment = nextRange.cloneContents();
  return fragment.textContent || fragment.childNodes.length ? fragment : "";
}

function getNativePastedHtml(payload = {}) {
  const range = getNativePasteRange(payload);
  if (!range) return "";
  const template = document.createElement("template");
  template.content.append(range.cloneContents());
  return template.innerHTML.trim();
}

function placeCaretBeforeNode(node) {
  if (!node?.isConnected) return;
  const range = document.createRange();
  range.setStartBefore(node);
  range.collapse(true);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  savedEditorRange = range.cloneRange();
}

function finalizeNativePastedContent(payload = {}) {
  if (!payload.nativePaste) return;
  placeCaretBeforeNode(payload.endMarker);
  payload.startMarker?.remove();
  payload.endMarker?.remove();
  pushEditorHistorySnapshot();
  syncEditorStats();
  syncEditorToolbarState({ force: true });
  markEditorDirty();
  saveCurrentSelection();
}

function replaceNativePastedContent(payload = {}, html = "") {
  const range = getNativePasteRange(payload);
  if (!range) {
    insertEditorHtml(html);
    return;
  }

  const safeHtml = cleanEditorHtml(html);
  if (!safeHtml) {
    finalizeNativePastedContent(payload);
    return;
  }

  const template = document.createElement("template");
  template.innerHTML = safeHtml;
  range.deleteContents();
  range.insertNode(template.content);
  finalizeNativePastedContent(payload);
}

function insertEditorHtml(html = "") {
  const safeHtml = cleanEditorHtml(html);
  if (!safeHtml) return;
  restoreEditorSelection();
  document.execCommand("insertHTML", false, safeHtml);
  pushEditorHistorySnapshot();
  syncEditorStats();
  syncEditorToolbarState({ force: true });
  markEditorDirty();
  saveCurrentSelection();
}

function closePasteMenu({ finalizeNative = true } = {}) {
  const payload = pendingPastePayload;
  pasteMenu?.remove();
  pasteMenu = null;
  pendingPastePayload = null;
  if (finalizeNative && payload?.nativePaste) {
    finalizeNativePastedContent(payload);
  }
}

function getPasteMenuPosition(event) {
  if (event?.clientX || event?.clientY) {
    return { x: event.clientX, y: event.clientY };
  }

  if (rangeIsInEditor(savedEditorRange)) {
    const rect = savedEditorRange.getBoundingClientRect();
    if (rect.width || rect.height) {
      return { x: rect.left, y: rect.bottom };
    }
  }

  const rect = els.content.getBoundingClientRect();
  return { x: rect.left + 24, y: rect.top + 24 };
}

function positionPasteMenu(menu, point) {
  const margin = 8;
  menu.style.left = `${Math.max(margin, point.x)}px`;
  menu.style.top = `${Math.max(margin, point.y)}px`;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(Math.max(margin, point.x), window.innerWidth - rect.width - margin);
  const top = Math.min(Math.max(margin, point.y), window.innerHeight - rect.height - margin);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function showPasteMenu(event, payload) {
  closePasteMenu();
  pendingPastePayload = payload;

  pasteMenu = document.createElement("div");
  pasteMenu.className = "editor-paste-menu";
  pasteMenu.setAttribute("role", "menu");
  pasteMenu.setAttribute("aria-label", "붙여넣기 옵션");
  pasteMenu.innerHTML = EDITOR_PASTE_OPTIONS.map(
    (option) => `
      <button type="button" role="menuitem" data-paste-mode="${escapeHtml(option.key)}">
        ${escapeHtml(option.label)}
      </button>
    `
  ).join("");

  pasteMenu.addEventListener("mousedown", (mouseEvent) => {
    mouseEvent.preventDefault();
  });

  pasteMenu.addEventListener("click", async (clickEvent) => {
    const button = clickEvent.target.closest("[data-paste-mode]");
    if (!button || !pendingPastePayload) return;

    const payloadToInsert = pendingPastePayload;
    const mode = button.dataset.pasteMode;
    pasteMenu?.remove();
    pasteMenu = null;
    pendingPastePayload = null;

    try {
      if (payloadToInsert.nativePaste && mode === "source") {
        finalizeNativePastedContent(payloadToInsert);
        return;
      }
      const html = await buildPasteHtml(mode, payloadToInsert);
      if (payloadToInsert.nativePaste) {
        replaceNativePastedContent(payloadToInsert, html);
      } else {
        insertEditorHtml(html);
      }
    } catch (error) {
      if (payloadToInsert.nativePaste) {
        finalizeNativePastedContent(payloadToInsert);
      }
      window.alert(error.message || "붙여넣기를 처리하지 못했습니다.");
    }
  });

  document.body.append(pasteMenu);
  positionPasteMenu(pasteMenu, getPasteMenuPosition(event));
  window.requestAnimationFrame(() => pasteMenu?.querySelector("button")?.focus({ preventScroll: true }));
}

function getClipboardPayload(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return null;

  const imageFiles = [...clipboard.files].filter((file) => file.type.startsWith("image/"));
  const html = clipboard.getData("text/html");
  const text = clipboard.getData("text/plain");
  if (!html && !text && imageFiles.length === 0) return null;

  return { html, text, imageFiles };
}

function handleEditorPaste(event) {
  if (!nodeIsInEditor(event.target)) return;
  const payload = getClipboardPayload(event);
  if (!payload) return;

  const markers = insertNativePasteMarkers();
  if (!markers) {
    event.preventDefault();
    saveCurrentSelection();
    showPasteMenu(event, payload);
    return;
  }

  const nativePayload = {
    ...payload,
    nativePaste: true,
    ...markers,
  };

  window.setTimeout(async () => {
    inlineNativePastedComputedStyles(nativePayload);
    nativePayload.html = getNativePastedHtml(nativePayload) || nativePayload.html || "";

    if (!nativePayload.html && (payload.html || payload.text || payload.imageFiles?.length)) {
      const html = await buildPasteHtml("source", payload);
      replaceNativePastedContent(nativePayload, html);
      return;
    }

    pushEditorHistorySnapshot();
    syncEditorStats();
    syncEditorToolbarState({ force: true });
    markEditorDirty();
    saveCurrentSelection();
    showPasteMenu(event, nativePayload);
  }, 0);
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
  els.submit.textContent = isBusy
    ? "저장 중"
    : isMaterialEditor()
      ? state.editMaterialId
        ? "수정"
        : "저장"
      : state.editPostId
        ? "수정"
        : "게시";
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
  syncEditorToolbarState();
}

function setEditorCaret(node, offset) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  savedEditorRange = range.cloneRange();
}

function placeEditorCaretAtEnd() {
  els.content.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(els.content);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  savedEditorRange = range.cloneRange();
}

function stripCssQuotes(value = "") {
  return String(value).trim().replace(/^['"]|['"]$/g, "");
}

function normalizeFontFamilyName(value = "") {
  return stripCssQuotes(value).toLowerCase();
}

function splitFontFamilies(value = "") {
  const families = [];
  let current = "";
  let quote = "";

  String(value).split("").forEach((char) => {
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      current += char;
      return;
    }
    if (char === quote) {
      quote = "";
      current += char;
      return;
    }
    if (char === "," && !quote) {
      const family = normalizeFontName(current);
      if (family) families.push(family);
      current = "";
      return;
    }
    current += char;
  });

  const family = normalizeFontName(current);
  if (family) families.push(family);
  return families;
}

function getEditorStyleElement(node) {
  if (!node) return els.content;
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement || els.content;
  if (node.nodeType === Node.ELEMENT_NODE) return node;
  return els.content;
}

function getActiveEditorStyleElement() {
  const selection = window.getSelection();
  const range = selection?.rangeCount && rangeIsInEditor(selection.getRangeAt(0))
    ? selection.getRangeAt(0)
    : rangeIsInEditor(savedEditorRange)
      ? savedEditorRange
      : null;

  if (!range) return null;
  const node = range.startContainer || range.commonAncestorContainer;
  const element = getEditorStyleElement(node);
  return nodeIsInEditor(element) ? element : els.content;
}

function findMatchingEditorFont(fontFamily = "") {
  const families = splitFontFamilies(fontFamily);
  const fonts = getEditorFonts();

  return (
    fonts.find((font) =>
      families.some((family) => normalizeFontFamilyName(family) === normalizeFontFamilyName(font))
    ) ||
    fonts.find((font) =>
      families.some((family) => normalizeFontFamilyName(family).includes(normalizeFontFamilyName(font)))
    ) ||
    families[0] ||
    ""
  );
}

function ensureEditorFontOption(fontName = "") {
  const normalized = normalizeFontName(fontName);
  if (!normalized || [...els.fontFamily.options].some((option) => option.value === normalized)) return normalized;
  const option = document.createElement("option");
  option.value = normalized;
  option.textContent = normalized;
  els.fontFamily.append(option);
  return normalized;
}

function prepareEditorSelectionForToolbar({ holdSelection = false } = {}) {
  if (holdSelection && holdEditorSelection()) return;
  saveCurrentSelection();
}

function getInlineEditorFontName(element) {
  let current = element;
  while (current && current !== els.content && els.content.contains(current)) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const inlineFont = current.style?.getPropertyValue("font-family") || "";
      const family = splitFontFamilies(inlineFont)[0];
      if (family) return family;

      if (current.tagName === "FONT") {
        const face = normalizeFontName(current.getAttribute("face") || "");
        if (face) return face;
      }
    }
    current = current.parentElement;
  }
  return "";
}

function normalizeLineHeightForToolbar(style) {
  const raw = style.lineHeight;
  if (!raw || raw === "normal") return "";
  if (raw.endsWith("px")) {
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const lineHeight = Number.parseFloat(raw);
    if (!Number.isFinite(lineHeight) || !Number.isFinite(fontSize) || fontSize <= 0) return "";
    return normalizeLineHeightValue(lineHeight / fontSize);
  }
  return normalizeLineHeightValue(raw);
}

function syncEditorCommandButtons() {
  if (!els.toolbar) return;
  els.toolbar.querySelectorAll("[data-editor-command]").forEach((button) => {
    const command = button.dataset.editorCommand;
    let active = false;
    try {
      active = document.queryCommandState(command);
    } catch {
      active = false;
    }
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncEditorToolbarState({ force = false } = {}) {
  const target = getActiveEditorStyleElement();
  if (!target) return;

  const style = window.getComputedStyle(target);
  if (els.fontFamily && (force || document.activeElement !== els.fontFamily)) {
    const font = ensureEditorFontOption(getInlineEditorFontName(target) || findMatchingEditorFont(style.fontFamily));
    if (font) els.fontFamily.value = font;
  }

  if (els.fontSize && (force || document.activeElement !== els.fontSize)) {
    const size = Number.parseInt(style.fontSize, 10);
    if (Number.isFinite(size)) els.fontSize.value = String(size);
  }

  const lineHeightInput = els.toolbar?.querySelector("[data-line-height-custom]");
  if (lineHeightInput && (force || document.activeElement !== lineHeightInput)) {
    const lineHeight = normalizeLineHeightForToolbar(style);
    if (lineHeight) lineHeightInput.value = lineHeight;
  }

  syncEditorCommandButtons();
}

function resetEditorHistory() {
  editorHistoryStack = [els.content.innerHTML];
  editorHistoryIndex = 0;
}

function pushEditorHistorySnapshot() {
  if (editorHistoryRestoring || !els.content) return;
  const snapshot = els.content.innerHTML;
  if (editorHistoryStack[editorHistoryIndex] === snapshot) return;

  editorHistoryStack = editorHistoryStack.slice(0, editorHistoryIndex + 1);
  editorHistoryStack.push(snapshot);
  if (editorHistoryStack.length > EDITOR_HISTORY_LIMIT) {
    editorHistoryStack.shift();
  }
  editorHistoryIndex = editorHistoryStack.length - 1;
}

function restoreEditorHistory(step) {
  const nextIndex = editorHistoryIndex + step;
  if (nextIndex < 0 || nextIndex >= editorHistoryStack.length) return false;

  editorHistoryRestoring = true;
  clearEditorSelectionHold({ unwrap: true });
  els.content.innerHTML = editorHistoryStack[nextIndex];
  editorHistoryIndex = nextIndex;
  editorHistoryRestoring = false;

  syncEditorStats();
  markEditorDirty();
  placeEditorCaretAtEnd();
  return true;
}

function isEditorHistoryShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return "";
  const key = event.key.toLowerCase();
  if (key === "z" && event.shiftKey) return "redo";
  if (key === "z") return "undo";
  if (key === "y") return "redo";
  return "";
}

function handleEditorHistoryShortcut(event) {
  const action = isEditorHistoryShortcut(event);
  if (!action) return;

  const selection = window.getSelection();
  const selectionInEditor = selection?.rangeCount && nodeIsInEditor(selection.anchorNode);
  if (!nodeIsInEditor(event.target) && !selectionInEditor) return;

  event.preventDefault();
  restoreEditorHistory(action === "undo" ? -1 : 1);
}

function getLastTextNode(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node;

  for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
    const textNode = getLastTextNode(node.childNodes[index]);
    if (textNode) return textNode;
  }

  return null;
}

function getCollapsedEditorTextPosition() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;

  const range = selection.getRangeAt(0);
  if (!range.collapsed || !rangeIsInEditor(range)) return null;

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    return {
      node: range.startContainer,
      offset: range.startOffset,
    };
  }

  if (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startOffset > 0) {
    const textNode = getLastTextNode(range.startContainer.childNodes[range.startOffset - 1]);
    if (textNode) {
      return {
        node: textNode,
        offset: textNode.data.length,
      };
    }
  }

  return null;
}

function replaceTrailingEditorEllipsis(event) {
  if (event?.isComposing) return false;

  const position = getCollapsedEditorTextPosition();
  if (!position || position.offset < 3) return false;

  const before = position.node.data.slice(0, position.offset);
  if (!before.endsWith("...")) return false;

  const after = position.node.data.slice(position.offset);
  const nextOffset = position.offset - 2;
  position.node.data = `${before.slice(0, -3)}${EDITOR_MIDDLE_ELLIPSIS}${after}`;
  setEditorCaret(position.node, nextOffset);
  lastEditorEllipsisReplacement = {
    node: position.node,
    offset: nextOffset,
  };
  return true;
}

function handleEditorEllipsisBackspace(event) {
  if (event.key !== "Backspace" || event.ctrlKey || event.metaKey || event.altKey) return false;

  const position = getCollapsedEditorTextPosition();
  if (
    !position ||
    !lastEditorEllipsisReplacement ||
    lastEditorEllipsisReplacement.node !== position.node ||
    lastEditorEllipsisReplacement.offset !== position.offset ||
    position.offset < 1 ||
    position.node.data.charAt(position.offset - 1) !== EDITOR_MIDDLE_ELLIPSIS
  ) {
    return false;
  }

  event.preventDefault();
  position.node.data =
    position.node.data.slice(0, position.offset - 1) +
    EDITOR_ELLIPSIS_BACKSPACE_TEXT +
    position.node.data.slice(position.offset);
  setEditorCaret(position.node, position.offset - 1 + EDITOR_ELLIPSIS_BACKSPACE_TEXT.length);
  lastEditorEllipsisReplacement = null;
  syncActiveLineHeightBlocks();
  pushEditorHistorySnapshot();
  syncEditorStats();
  markEditorDirty();
  saveCurrentSelection();
  return true;
}

function handleEditorKeydown(event) {
  if (handleEditorEllipsisBackspace(event)) return;
  handleEditorHistoryShortcut(event);
}

function rangeIsInEditor(range) {
  return Boolean(range && nodeIsInEditor(range.startContainer) && nodeIsInEditor(range.endContainer));
}

function clearEditorSelectionHold({ unwrap = false } = {}) {
  els.content.querySelectorAll("[data-editor-selection-hold]").forEach((node) => {
    if (unwrap && !node.getAttribute("style")) {
      node.replaceWith(...node.childNodes);
      return;
    }
    node.removeAttribute("data-editor-selection-hold");
  });
}

function holdEditorSelection() {
  if (els.content.querySelector("[data-editor-selection-hold]")) return true;

  const selection = window.getSelection();
  let range = null;

  if (selection?.rangeCount) {
    const currentRange = selection.getRangeAt(0);
    if (!currentRange.collapsed && rangeIsInEditor(currentRange)) {
      range = currentRange.cloneRange();
    }
  }

  if (!range && rangeIsInEditor(savedEditorRange) && !savedEditorRange.collapsed) {
    range = savedEditorRange.cloneRange();
  }

  if (!range) return false;

  clearEditorSelectionHold({ unwrap: true });

  const hold = document.createElement("span");
  hold.dataset.editorSelectionHold = "true";

  try {
    hold.appendChild(range.extractContents());
    range.insertNode(hold);

    const heldRange = document.createRange();
    heldRange.selectNodeContents(hold);
    savedEditorRange = heldRange.cloneRange();
    selection.removeAllRanges();
    selection.addRange(heldRange);
    return true;
  } catch {
    saveCurrentSelection();
    return false;
  }
}

function restoreEditorSelection({ selectAllWhenMissing = false } = {}) {
  els.content.focus();
  const selection = window.getSelection();
  selection.removeAllRanges();

  if (rangeIsInEditor(savedEditorRange)) {
    selection.addRange(savedEditorRange);
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(els.content);
  if (!selectAllWhenMissing || !els.content.textContent.replace(/\u200b/g, "").trim()) {
    range.collapse(false);
  }
  selection.addRange(range);
  savedEditorRange = range.cloneRange();
}

function finishEditorStyleChange() {
  pushEditorHistorySnapshot();
  syncEditorStats();
  syncEditorToolbarState({ force: true });
  markEditorDirty();
  saveCurrentSelection();
}

function shouldApplyStyleDeep(property) {
  return property === "font-family" || property === "font-size" || property === "line-height";
}

function normalizeCssStyleValue(property, value) {
  if (property === "font-family") return formatFontFamilyValue(value);
  return value;
}

function applyCssProperty(target, property, value) {
  const cssValue = normalizeCssStyleValue(property, value);
  if (!cssValue) return;
  target.style.setProperty(property, cssValue);
  if (!shouldApplyStyleDeep(property)) return;
  target.querySelectorAll?.("*").forEach((node) => {
    node.style.setProperty(property, cssValue);
  });
}

function getEditorStyleBlocks() {
  const blocks = [...els.content.querySelectorAll(EDITOR_BLOCK_SELECTOR)].filter((block) =>
    block.textContent.replace(/\u200b/g, "").trim(),
  );
  return blocks.length > 0 ? blocks : [els.content];
}

function applyStyleToCurrentBlockOrAll(property, value, { applyAllWhenMissing = false } = {}) {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const block = range ? getClosestEditorBlock(range.startContainer) : null;

  if (block && block.textContent.replace(/\u200b/g, "").trim()) {
    applyCssProperty(block, property, value);
    finishEditorStyleChange();
    return true;
  }

  if (applyAllWhenMissing && els.content.textContent.replace(/\u200b/g, "").trim()) {
    getEditorStyleBlocks().forEach((target) => {
      applyCssProperty(target, property, value);
    });
    finishEditorStyleChange();
    return true;
  }

  return false;
}

function applyStyleToHeldSelection(property, value) {
  const heldNodes = [...els.content.querySelectorAll("[data-editor-selection-hold]")];
  if (heldNodes.length === 0) return false;

  heldNodes.forEach((node) => {
    applyCssProperty(node, property, value);
    node.removeAttribute("data-editor-selection-hold");
  });

  const range = document.createRange();
  range.selectNodeContents(heldNodes.at(-1));
  savedEditorRange = range.cloneRange();
  finishEditorStyleChange();
  return true;
}

function applyInlineStyle(property, value, options = {}) {
  const cssProperty = EDITOR_INLINE_STYLE_PROPERTIES[property] || property;
  if (options.useSelectionHold && applyStyleToHeldSelection(cssProperty, value)) {
    return;
  }

  const hadSavedRange = rangeIsInEditor(savedEditorRange);
  restoreEditorSelection({ selectAllWhenMissing: options.selectAllWhenMissing });
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);

  if (
    range.collapsed &&
    options.applyCollapsedBlock &&
    applyStyleToCurrentBlockOrAll(cssProperty, value, { applyAllWhenMissing: options.applyAllWhenMissing || !hadSavedRange })
  ) {
    return;
  }

  const span = document.createElement("span");
  applyCssProperty(span, cssProperty, value);

  if (range.collapsed) {
    span.dataset.editorStyleCaret = "true";
    const marker = document.createTextNode("\u200b");
    span.appendChild(marker);
    range.insertNode(span);
    range.setStart(marker, marker.length);
    range.collapse(true);
  } else {
    span.appendChild(range.extractContents());
    applyCssProperty(span, cssProperty, value);
    range.insertNode(span);
    range.selectNodeContents(span);
  }

  selection.removeAllRanges();
  selection.addRange(range);
  finishEditorStyleChange();
}

function applyFontFamily(fontName) {
  const name = normalizeFontName(fontName);
  if (!name) return;
  ensureEditorFontOption(name);
  els.fontFamily.value = name;

  if (applyStyleToHeldSelection("font-family", name)) {
    return;
  }

  const hadSavedRange = rangeIsInEditor(savedEditorRange);
  restoreEditorSelection({
    selectAllWhenMissing: !hadSavedRange && Boolean(els.content.textContent.replace(/\u200b/g, "").trim()),
  });

  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    applyCssProperty(els.content, "font-family", name);
    finishEditorStyleChange();
    return;
  }

  const range = selection.getRangeAt(0);

  if (range.collapsed) {
    const block = getClosestEditorBlock(range.startContainer) || els.content;
    applyCssProperty(block, "font-family", name);
    selection.removeAllRanges();
    selection.addRange(range);
    savedEditorRange = range.cloneRange();
    finishEditorStyleChange();
    return;
  }

  const span = document.createElement("span");
  applyCssProperty(span, "font-family", name);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  range.selectNodeContents(span);
  selection.removeAllRanges();
  selection.addRange(range);
  savedEditorRange = range.cloneRange();
  finishEditorStyleChange();
}

function normalizeFontSize(value) {
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size)) return "";
  return `${Math.min(96, Math.max(8, size))}px`;
}

function normalizeLineHeightValue(value) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return "";
  const clamped = Math.min(4, Math.max(0.8, number));
  return String(Number(clamped.toFixed(2)));
}

function applyFontSizeFromInput({ keepToolbarFocus = false } = {}) {
  const size = normalizeFontSize(els.fontSize.value);
  if (!size) return;
  const shouldRefocusInput = keepToolbarFocus && document.activeElement === els.fontSize;
  els.fontSize.value = size.replace("px", "");
  applyInlineStyle("fontSize", size, {
    applyCollapsedBlock: true,
    applyAllWhenMissing: Boolean(state.editingPost),
    selectAllWhenMissing: Boolean(state.editingPost),
    useSelectionHold: true,
  });
  if (shouldRefocusInput) {
    window.requestAnimationFrame(() => {
      els.fontSize.focus({ preventScroll: true });
    });
  }
}

function isFontSizeStepPointer(event) {
  const rect = els.fontSize.getBoundingClientRect();
  return event.clientX >= rect.right - 24;
}

function focusFontSizeInputForTyping() {
  window.requestAnimationFrame(() => {
    els.fontSize.focus({ preventScroll: true });
    els.fontSize.select?.();
  });
}

function applyCustomLineHeightFromInput(input) {
  const value = normalizeLineHeightValue(input?.value);
  if (!value) return;
  input.value = value;
  applyLineHeight(value);
}

function getClosestEditorBlock(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const block = element?.closest?.(EDITOR_BLOCK_SELECTOR) || null;
  return block && block !== els.content && els.content.contains(block) ? block : null;
}

function getSelectedEditorBlocks() {
  restoreEditorSelection();
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [];

  const range = selection.getRangeAt(0);
  const blocks = new Set();
  const startBlock = getClosestEditorBlock(range.startContainer);
  const endBlock = getClosestEditorBlock(range.endContainer);

  if (range.collapsed) {
    return [startBlock || els.content];
  }

  if (startBlock && els.content.contains(startBlock)) blocks.add(startBlock);
  if (endBlock && els.content.contains(endBlock)) blocks.add(endBlock);

  els.content
    .querySelectorAll(EDITOR_BLOCK_SELECTOR)
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
  pushEditorHistorySnapshot();
  syncEditorStats();
  markEditorDirty();
  saveCurrentSelection();
}

function getLineHeightTargets() {
  return [els.content, ...els.content.querySelectorAll(EDITOR_BLOCK_SELECTOR)];
}

function applyEditorLineHeight(target, value) {
  applyCssProperty(target, "line-height", value);
  if (target !== els.content && target.matches?.(EDITOR_BLOCK_SELECTOR)) {
    target.style.marginTop = "0";
    target.style.marginBottom = "0";
  }
}

function syncActiveLineHeightBlocks() {
  if (!activeEditorLineHeight) return;
  getLineHeightTargets().forEach((block) => {
    applyEditorLineHeight(block, activeEditorLineHeight);
  });
}

function syncActiveLineHeightFromContent() {
  const styledBlock = [els.content, ...els.content.querySelectorAll(EDITOR_BLOCK_SELECTOR)].find(
    (block) => block.style.lineHeight
  );
  activeEditorLineHeight = styledBlock?.style.lineHeight || "";
  syncActiveLineHeightBlocks();
}

function applyLineHeight(value) {
  activeEditorLineHeight = normalizeLineHeightValue(value);
  if (!activeEditorLineHeight) return;

  getLineHeightTargets().forEach((block) => applyEditorLineHeight(block, activeEditorLineHeight));

  pushEditorHistorySnapshot();
  syncEditorStats();
  syncEditorToolbarState({ force: true });
  markEditorDirty();
  saveCurrentSelection();
}

function handleEditorContentInput(event) {
  replaceTrailingEditorEllipsis(event);
  syncActiveLineHeightBlocks();
  pushEditorHistorySnapshot();
  syncEditorToolbarState();
}

function executeEditorCommand(command, value = null) {
  restoreEditorSelection();
  document.execCommand(command, false, value);
  pushEditorHistorySnapshot();
  syncEditorStats();
  syncEditorToolbarState({ force: true });
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

function insertEditorDivider() {
  executeEditorCommand("insertHTML", `<hr><p><br></p>`);
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
  pushEditorHistorySnapshot();
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
  pushEditorHistorySnapshot();
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
  const session = await getFreshSession();
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
    published_at: state.editingPost?.published_at || new Date().toISOString(),
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
    return state.editPostId ? await updatePost(state.editPostId, payload) : await insertPost(payload);
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
    return state.editPostId ? updatePost(state.editPostId, fallbackPayload) : insertPost(fallbackPayload);
  }
}

async function publishEditorMaterial() {
  const session = await getFreshSession();
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
    content: values.body,
    material_type: state.editingMaterial?.material_type || "note",
    category: values.category,
    login_id: state.id,
    user_id: session.user?.id,
    folder_id: values.folder?.id || null,
    folder_name: values.folder?.label || null,
    folder_path: values.folder?.path || null,
    updated_at: new Date().toISOString(),
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === "") {
      delete payload[key];
    }
  });

  try {
    return state.editMaterialId ? await updateMaterial(state.editMaterialId, payload) : await insertMaterial(payload);
  } catch (error) {
    if (!/column|schema cache|Could not find/i.test(error.message)) {
      throw error;
    }

    const fallbackPayload = {
      title: payload.title,
      content: payload.content,
      material_type: payload.material_type,
      category: payload.category,
      login_id: payload.login_id,
      user_id: payload.user_id,
    };
    Object.keys(fallbackPayload).forEach((key) => {
      if (fallbackPayload[key] === undefined || fallbackPayload[key] === "") {
        delete fallbackPayload[key];
      }
    });
    return state.editMaterialId ? updateMaterial(state.editMaterialId, fallbackPayload) : insertMaterial(fallbackPayload);
  }
}

function returnToBlog() {
  if (state.editorSaving) return;
  window.location.href = isMaterialEditor() ? "./materials.html" : "./my-blog.html";
}

async function handleEditorSubmit(event) {
  event.preventDefault();

  try {
    const previewValues = collectEditorValues();
    if (!(await getFreshSession())?.access_token) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!previewValues.title) {
      throw new Error("제목을 입력해주세요.");
    }
    if (!previewValues.plainText) {
      throw new Error("본문을 입력해주세요.");
    }

    setEditorBusy(true);
    setEditorMessage(isMaterialEditor() ? (state.editMaterialId ? "자료를 수정 중입니다..." : "자료를 저장 중입니다...") : state.editPostId ? "수정 중입니다..." : "게시 중입니다...");
    if (isMaterialEditor()) {
      await publishEditorMaterial();
    } else {
      await publishEditorPost();
    }
    clearEditorDraft();
    setEditorMessage(isMaterialEditor() ? (state.editMaterialId ? "자료 수정이 완료되었습니다." : "자료가 저장되었습니다.") : state.editPostId ? "수정이 완료되었습니다." : "게시가 완료되었습니다.", "success");
    window.setTimeout(() => {
      window.location.href = isMaterialEditor() ? "./materials.html" : "./my-blog.html";
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

  renderEditorBrand(state.id);

  let exactEditingPost = null;
  let exactEditingMaterial = null;
  if (!isMaterialEditor() && state.editPostId) {
    try {
      const row = await fetchPostById(state.editPostId);
      if (row && belongsToAccount(row, state.id)) {
        exactEditingPost = normalizePost(row);
      }
    } catch {
      exactEditingPost = null;
    }
  }
  if (isMaterialEditor() && state.editMaterialId) {
    try {
      const row = await fetchMaterialById(state.editMaterialId);
      if (row) {
        exactEditingMaterial = normalizeMaterialForEditor(row);
      }
    } catch {
      exactEditingMaterial = null;
    }
  }

  if (isMaterialEditor()) {
    state.posts = [];
  } else {
    try {
      const rows = await fetchPosts();
      state.posts = rows
        .filter((post) => belongsToAccount(post, state.id))
        .map(normalizePost)
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } catch {
      state.posts = [];
    }
  }

  state.storedTreeData = await loadTreeData();
  buildTree();

  const defaults = getEditorDefaults();
  state.editingPost = !isMaterialEditor() && state.editPostId
    ? exactEditingPost || state.posts.find((post) => String(post.id) === String(state.editPostId)) || null
    : null;
  state.editingMaterial = isMaterialEditor() && state.editMaterialId ? exactEditingMaterial : null;
  if (state.editingPost && !state.posts.some((post) => String(post.id) === String(state.editingPost.id))) {
    state.posts.unshift(state.editingPost);
  }
  const draft = state.editingPost || state.editingMaterial || state.forceNewPost ? null : loadEditorDraft();
  const source = state.editingPost || state.editingMaterial || draft || null;

  if (state.editPostId && !state.editingPost) {
    setEditorMessage("수정할 글을 찾지 못했습니다.", "error");
    els.submit.disabled = true;
  }
  if (state.editMaterialId && !state.editingMaterial) {
    setEditorMessage("수정할 자료를 찾지 못했습니다.", "error");
    els.submit.disabled = true;
  }

  els.title.value = source?.title || "";
  renderEditorCategoryOptions(source?.category || defaults.category);
  renderEditorFolderOptions(source?.folder_id || defaults.folderId);
  els.folder.value = source?.folder_id || defaults.folderId;
  els.content.innerHTML = source?.body || "";
  syncActiveLineHeightFromContent();
  resetEditorHistory();
  els.published.checked = source?.published ?? true;
  els.submit.textContent = isMaterialEditor() ? (state.editingMaterial ? "수정" : "저장") : state.editingPost ? "수정" : "게시";
  setEditorSaveState(state.editingPost || state.editingMaterial ? "수정 준비" : draft ? "임시 저장 불러옴" : "임시 저장 준비");
  renderEditorFontOptions();
  renderColorMenus();
  if ((!state.editPostId && !state.editMaterialId) || state.editingPost || state.editingMaterial) {
    setEditorMessage("");
  }
  syncEditorStats();
  syncEditorToolbarState({ force: true });
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

els.content.addEventListener("input", handleEditorContentInput);
els.content.addEventListener("keydown", handleEditorKeydown);
els.content.addEventListener("paste", handleEditorPaste);
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
  applyFontFamily(event.target.value);
});

els.fontFamily.addEventListener("pointerdown", () => {
  prepareEditorSelectionForToolbar({ holdSelection: true });
});

els.fontFamily.addEventListener("mousedown", () => {
  prepareEditorSelectionForToolbar({ holdSelection: true });
});

els.fontFamily.addEventListener("focus", () => {
  prepareEditorSelectionForToolbar({ holdSelection: true });
});

els.fontFamily.addEventListener("blur", () => {
  window.setTimeout(() => clearEditorSelectionHold({ unwrap: true }), 160);
});

els.addFont.addEventListener("click", addEditorFont);
els.removeFont?.addEventListener("click", removeEditorFont);

els.fontSize.addEventListener("pointerdown", (event) => {
  saveCurrentSelection();
  fontSizeStepPointerActive = isFontSizeStepPointer(event);
});

els.fontSize.addEventListener("mousedown", (event) => {
  const isStepPointer = isFontSizeStepPointer(event);
  saveCurrentSelection();
  fontSizeStepPointerActive = isStepPointer;
});

els.fontSize.addEventListener("input", () => {
  if (!fontSizeStepPointerActive) return;
  applyFontSizeFromInput({ keepToolbarFocus: true });
});

els.fontSize.addEventListener("change", () => {
  applyFontSizeFromInput({ keepToolbarFocus: document.activeElement === els.fontSize });
});

els.fontSize.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyFontSizeFromInput({ keepToolbarFocus: true });
    return;
  }

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    saveCurrentSelection();
    window.setTimeout(() => {
      applyFontSizeFromInput({ keepToolbarFocus: true });
    }, 0);
  }
});

els.content.addEventListener("pointerdown", () => {
  clearEditorSelectionHold({ unwrap: true });
});

document.addEventListener("pointerup", () => {
  fontSizeStepPointerActive = false;
});

els.toolbar.addEventListener("mousedown", (event) => {
  if (event.target.closest("input, select")) {
    prepareEditorSelectionForToolbar({ holdSelection: Boolean(event.target.closest("[data-editor-font-family]")) });
  }

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
    applyLineHeight(lineHeightButton.dataset.lineHeight);
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

  if (event.target.closest("[data-editor-divider]")) {
    insertEditorDivider();
    closeAllToolbarMenus();
    return;
  }

  const commandButton = event.target.closest("[data-editor-command]");
  if (commandButton) {
    executeEditorCommand(commandButton.dataset.editorCommand, commandButton.dataset.value || null);
  }
});

els.toolbar.addEventListener("keydown", (event) => {
  const lineHeightInput = event.target.closest("[data-line-height-custom]");
  if (!lineHeightInput || event.key !== "Enter") return;
  event.preventDefault();
  applyCustomLineHeightFromInput(lineHeightInput);
  closeEditorMiniMenus();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".editor-color-control") && !event.target.closest(".editor-table-control")) {
    closeAllToolbarMenus();
  }
  if (pasteMenu && !event.target.closest(".editor-paste-menu")) {
    closePasteMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pasteMenu) {
    event.preventDefault();
    closePasteMenu();
    els.content.focus({ preventScroll: true });
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

els.locationOptions?.addEventListener("click", (event) => {
  const optionButton = event.target.closest("[data-location-key]");
  if (!optionButton) return;

  state.pendingLocationKey = optionButton.dataset.locationKey;
  renderLocationOptions(state.pendingLocationKey);
  if (els.locationConfirm) els.locationConfirm.disabled = false;
});

els.locationConfirm?.addEventListener("click", () => {
  closeLocationDialog(getPendingLocation());
});

els.locationCancel?.addEventListener("click", () => closeLocationDialog(null));
els.locationClose?.addEventListener("click", () => closeLocationDialog(null));

els.locationDialog?.addEventListener("click", (event) => {
  if (event.target === els.locationDialog) {
    closeLocationDialog(null);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.locationDialog && !els.locationDialog.hidden) {
    closeLocationDialog(null);
  }
});

els.form.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveEditorDraft();
  }
});

Promise.resolve(window.blogSession?.ready).finally(initEditor);
