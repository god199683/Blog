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
  importInput: document.querySelector("[data-file-import]"),
  searchForm: document.querySelector("[data-blog-search-form]"),
  searchInput: document.querySelector("[data-blog-search-input]"),
  visitorTotalPosts: document.querySelector("[data-visitor-total-posts]"),
  visitorVisiblePosts: document.querySelector("[data-visitor-visible-posts]"),
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

function sanitizeFileName(value = "blog") {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "blog";
}

function getFileExtension(name = "") {
  return String(name).split(".").pop().toLowerCase();
}

function getFileStem(name = "") {
  return String(name).replace(/\.[^.]+$/, "").trim() || "불러온 글";
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

function applyBlogSearch(keyword = "") {
  const query = keyword.trim().toLowerCase();
  if (!query) {
    renderActivePosts();
    return;
  }

  const results = state.posts.filter((post) =>
    [post.title, post.body, post.category, post.folder_name, post.folder_path]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  );
  if (els.boardTitle) els.boardTitle.textContent = `검색: ${keyword.trim()}`;
  renderPosts(results);
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

function cleanImportedHtml(html = "") {
  const parsed = new DOMParser().parseFromString(String(html), "text/html");
  const template = document.createElement("template");
  template.innerHTML = parsed.body?.innerHTML || String(html);
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => {
    node.remove();
  });
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML.trim();
}

function textToHtml(text = "") {
  const normalized = String(text).replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function stripRtfToText(text = "") {
  return String(text)
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\[a-z]+\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html);
  template.content.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  template.content.querySelectorAll("p, div, h1, h2, h3, h4, li, tr").forEach((node) => {
    node.append(document.createTextNode("\n"));
  });
  return (template.content.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function getReadingTimeLabel(text = "") {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 350));
  return `${minutes}분 읽기`;
}

function getActiveLocationMeta() {
  const fallback = {
    category: "전체",
    folder: null,
  };
  if (state.activeNodeId === ALL_NODE_ID) return fallback;

  const found = findNode(state.tree, state.activeNodeId);
  if (!found) return fallback;

  if (found.node.type === "category") {
    return {
      category: found.node.filterCategory || found.node.label || "전체",
      folder: null,
    };
  }

  const categoryNode = findParentCategory(found.path);
  return {
    category: categoryNode?.filterCategory || categoryNode?.label || "전체",
    folder: {
      id: found.node.id,
      label: found.node.label,
      path: found.path.map((node) => node.label).filter(Boolean).join(" / "),
    },
  };
}

async function readFileAsHtml(file) {
  const extension = getFileExtension(file.name);

  if (extension === "docx") {
    if (!window.mammoth?.convertToHtml) {
      throw new Error("DOCX 불러오기 도구를 불러오지 못했습니다.");
    }
    const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return cleanImportedHtml(result.value);
  }

  const text = await file.text();
  if (extension === "html" || extension === "htm") return cleanImportedHtml(text);
  if (extension === "rtf") return textToHtml(stripRtfToText(text));
  return textToHtml(text);
}

async function insertImportedPost(payload) {
  const rows = await requestRest("posts", state.session.access_token, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function createImportedPostFromFile(file, location) {
  const body = await readFileAsHtml(file);
  const plainText = htmlToPlainText(body);
  if (!plainText) {
    throw new Error("내용이 비어 있습니다.");
  }

  return {
    title: getFileStem(file.name).slice(0, 120),
    body,
    category: location.category,
    author: state.id,
    login_id: state.id,
    user_id: state.session.user?.id,
    reading_time: getReadingTimeLabel(plainText),
    published: true,
    published_at: new Date().toISOString(),
    folder: location.folder?.label || null,
    folder_id: location.folder?.id || null,
    folder_name: location.folder?.label || null,
    folder_path: location.folder?.path || null,
  };
}

async function importFiles(files = []) {
  const fileList = [...files].filter(Boolean);
  if (fileList.length === 0) return;
  if (!state.session?.access_token) {
    window.alert("로그인이 필요합니다.");
    return;
  }

  const location = getActiveLocationMeta();
  const errors = [];
  let importedCount = 0;

  for (const file of fileList) {
    try {
      const payload = await createImportedPostFromFile(file, location);
      await insertImportedPost(payload);
      importedCount += 1;
    } catch (error) {
      errors.push(`${file.name}: ${error.message || "불러오지 못했습니다."}`);
    }
  }

  try {
    state.posts = await fetchUserPosts(state.session, state.id);
  } catch {}
  renderActivePosts();

  if (errors.length > 0) {
    window.alert(`${importedCount}개의 파일을 불러왔습니다.\n\n${errors.join("\n")}`);
    return;
  }
  window.alert(`${importedCount}개의 파일을 불러왔습니다.`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getExportPosts() {
  return getActiveTreeMeta().posts;
}

function buildExportBaseName(posts, format) {
  const title = els.boardTitle?.textContent || "블로그";
  const suffix = posts.length === 1 ? posts[0].title || title : title;
  return `${sanitizeFileName(`${state.id || "blog"}-${suffix}`)}.${format}`;
}

function exportPostsAsText(posts) {
  const text = posts
    .map((post) =>
      [
        post.title || "제목 없는 글",
        post.folder_path || post.folder_name || post.category || "전체",
        formatDate(post.published_at || post.created_at),
        "",
        htmlToPlainText(post.body || ""),
      ].join("\n")
    )
    .join("\n\n---\n\n");
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), buildExportBaseName(posts, "txt"));
}

function exportPostsAsDocx(posts) {
  const docx = window.htmlDocx || window.htmlDocxJs;
  if (!docx?.asBlob) {
    window.alert("DOCX 내보내기 도구를 불러오지 못했습니다. TXT로 다시 내보내주세요.");
    return;
  }

  const body = posts
    .map(
      (post) => `
        <article>
          <h1>${escapeHtml(post.title || "제목 없는 글")}</h1>
          <p>${escapeHtml(post.folder_path || post.folder_name || post.category || "전체")} · ${escapeHtml(formatDate(post.published_at || post.created_at))}</p>
          ${cleanImportedHtml(post.body || "")}
        </article>
      `
    )
    .join("<hr>");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { color: #22364a; font-family: "Malgun Gothic", Arial, sans-serif; font-size: 11pt; line-height: 1.65; }
          h1 { color: #0f3f61; font-size: 18pt; margin: 0 0 12pt; }
          p { margin: 0 0 10pt; }
          hr { border: 0; border-top: 1px solid #cfe1f0; margin: 20pt 0; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `;
  downloadBlob(docx.asBlob(html), buildExportBaseName(posts, "docx"));
}

function exportActivePosts() {
  const posts = getExportPosts();
  if (posts.length === 0) {
    window.alert("내보낼 글이 없습니다.");
    return;
  }

  const format = window.prompt("내보낼 형식을 입력해주세요. txt 또는 docx", "txt")?.trim().toLowerCase();
  if (!format) return;
  if (format === "txt") {
    exportPostsAsText(posts);
    return;
  }
  if (format === "docx") {
    exportPostsAsDocx(posts);
    return;
  }
  window.alert("txt 또는 docx 형식만 입력해주세요.");
}

function renderPosts(posts = []) {
  if (els.count) els.count.textContent = `${posts.length}개의 글`;
  if (els.visitorTotalPosts) els.visitorTotalPosts.textContent = String(state.posts.length);
  if (els.visitorVisiblePosts) els.visitorVisiblePosts.textContent = String(posts.length);
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
    "posts?select=id,title,body,category,folder_id,folder_name,folder_path,author,login_id,user_id,published,published_at,created_at&order=published_at.desc&limit=100",
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
    return;
  }

  if (action === "import-files") {
    els.importInput?.click();
    return;
  }

  if (action === "export-files") {
    exportActivePosts();
  }
});

els.importInput?.addEventListener("change", async (event) => {
  const files = event.target.files ? [...event.target.files] : [];
  event.target.value = "";
  await importFiles(files);
});

els.all?.addEventListener("click", () => {
  state.activeNodeId = ALL_NODE_ID;
  if (els.searchInput) els.searchInput.value = "";
  renderActivePosts();
  syncTreeSelectionState();
});

els.searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  applyBlogSearch(els.searchInput?.value || "");
});

els.searchInput?.addEventListener("input", () => {
  if (!els.searchInput.value.trim()) renderActivePosts();
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
    if (els.searchInput) els.searchInput.value = "";
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
