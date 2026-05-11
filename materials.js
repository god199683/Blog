const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const FILTER_LABELS = {
  all: "전체 자료",
  note: "메모",
  link: "링크",
  file: "파일",
  reference: "참고",
  space: "공간",
};

const SECTION_LABELS = {
  materials: "자료",
  spaces: "공간",
};

const MATERIAL_ALL_NODE_ID = "materials-all";

const state = {
  session: null,
  id: "",
  materials: [],
  materialTree: [],
  materialError: "",
  activeSection: "materials",
  activeMaterialNodeId: MATERIAL_ALL_NODE_ID,
  collapsedMaterialNodeIds: new Set(),
  activeFilter: "all",
  searchQuery: "",
  selectedMaterialId: "",
  selectedMaterialIds: new Set(),
  selectionMode: false,
  titleSortDirection: "none",
};

const els = {
  title: document.querySelector("[data-materials-title]"),
  owner: document.querySelector("[data-materials-owner]"),
  brandTitle: document.querySelector("[data-brand-title]"),
  profileTitle: document.querySelector("[data-profile-title]"),
  profileId: document.querySelector("[data-profile-id]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
  stats: document.querySelectorAll("[data-material-stat]"),
  board: document.querySelector("[data-material-board]"),
  boardTitle: document.querySelector("[data-material-board-title]"),
  count: document.querySelector("[data-material-count]"),
  titleHeading: document.querySelector("[data-material-title-heading]"),
  typeHeading: document.querySelector("[data-material-type-heading]"),
  table: document.querySelector("[data-material-table]"),
  spaceGrid: document.querySelector("[data-material-space-grid]"),
  listToggle: document.querySelector("[data-material-list-toggle]"),
  list: document.querySelector("[data-material-list]"),
  featureCard: document.querySelector("[data-material-feature-card]"),
  miniList: document.querySelector("[data-material-mini-list]"),
  titleSort: document.querySelector("[data-material-title-sort]"),
  toolsToggle: document.querySelector("[data-material-tools-toggle]"),
  tools: document.querySelector("[data-material-tools]"),
  importInput: document.querySelector("[data-material-file-import]"),
  searchForm: document.querySelector("[data-material-search-form]"),
  searchInput: document.querySelector("[data-material-search-input]"),
  sectionButtons: document.querySelectorAll("[data-material-section]"),
  sectionCounts: document.querySelectorAll("[data-material-section-count]"),
  treeAll: document.querySelector("[data-material-tree-all]"),
  tree: document.querySelector("[data-material-tree]"),
  materialForm: document.querySelector("[data-material-form]"),
  materialTitle: document.querySelector("[data-material-title]"),
  materialType: document.querySelector("[data-material-type]"),
  materialUrl: document.querySelector("[data-material-url]"),
  materialContent: document.querySelector("[data-material-content]"),
  scrollTop: document.querySelector("[data-scroll-top]"),
  scrollBottom: document.querySelector("[data-scroll-bottom]"),
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
  if (!response.ok) throw new Error(payload?.message || "자료를 불러오지 못했습니다.");
  return payload;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeFileName(value = "materials") {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "materials";
}

function getFileExtension(name = "") {
  return String(name).split(".").pop().toLowerCase();
}

function getFileStem(name = "") {
  return String(name).replace(/\.[^.]+$/, "").trim() || "불러온 자료";
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

function htmlToPlainText(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html);
  template.content.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  template.content.querySelectorAll("p, div, h1, h2, h3, h4, li, tr").forEach((node) => {
    node.append(document.createTextNode("\n"));
  });
  return (template.content.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
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

function formatDate(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function getMaterialTypeLabel(type = "note") {
  return FILTER_LABELS[type] || "자료";
}

function getMaterialTypeFromInput(value = "") {
  const normalized = String(value).trim().toLowerCase();
  const labelMatch = Object.entries(FILTER_LABELS).find(
    ([key, label]) => key !== "all" && (normalized === key || normalized === label.toLowerCase())
  );
  return labelMatch?.[0] || "note";
}

function normalizeMaterial(row = {}) {
  return {
    id: row.id || "",
    user_id: row.user_id || "",
    login_id: row.login_id || "",
    title: row.title || "제목 없는 자료",
    material_type: row.material_type || "note",
    url: row.url || "",
    content: row.content || "",
    category: row.category || "전체",
    folder_id: row.folder_id || "",
    folder_name: row.folder_name || "",
    folder_path: row.folder_path || "",
    source_post_id: row.source_post_id || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
    deleted_at: row.deleted_at || "",
  };
}

function createMaterialTreeNode(type, label) {
  const randomId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id: `${type}-${randomId}`,
    type,
    label,
    filterCategory: type === "category" ? label : "",
    children: [],
  };
}

function normalizeMaterialTreeNode(node = {}) {
  const type = node.type === "folder" ? "folder" : "category";
  const label = String(node.label || (type === "category" ? "새 카테고리" : "새 폴더")).trim();
  return {
    id: node.id || `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    label,
    filterCategory: type === "category" ? node.filterCategory || label : "",
    children: Array.isArray(node.children) ? node.children.map(normalizeMaterialTreeNode) : [],
  };
}

function promptName(message, fallback) {
  return window.prompt(message, fallback)?.trim().slice(0, 40) || "";
}

function findMaterialNode(nodes = state.materialTree, nodeId, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];
    if (node.id === nodeId) return { node, path: nextPath };
    const found = findMaterialNode(node.children || [], nodeId, nextPath);
    if (found) return found;
  }
  return null;
}

function getMaterialPathLabel(path = []) {
  return path
    .map((node) => node?.label || "")
    .filter(Boolean)
    .join(" / ");
}

function getDescendantMaterialNodeIds(node = {}) {
  return [
    node.id,
    ...(node.children || []).flatMap((child) => getDescendantMaterialNodeIds(child)),
  ].filter(Boolean);
}

function findParentMaterialCategory(path = []) {
  return [...path].reverse().find((node) => node.type === "category") || null;
}

function getActiveMaterialLocation() {
  if (state.activeMaterialNodeId === MATERIAL_ALL_NODE_ID) {
    return {
      category: "전체",
      folder: null,
    };
  }

  const found = findMaterialNode(state.materialTree, state.activeMaterialNodeId);
  if (!found) {
    return {
      category: "전체",
      folder: null,
    };
  }

  if (found.node.type === "category") {
    return {
      category: found.node.filterCategory || found.node.label || "전체",
      folder: null,
    };
  }

  const categoryNode = findParentMaterialCategory(found.path);
  return {
    category: categoryNode?.filterCategory || categoryNode?.label || "전체",
    folder: {
      id: found.node.id,
      label: found.node.label,
      path: getMaterialPathLabel(found.path),
    },
  };
}

function isMaterialInActiveNode(material = {}) {
  if (state.activeSection !== "materials" || state.activeMaterialNodeId === MATERIAL_ALL_NODE_ID) return true;

  const found = findMaterialNode(state.materialTree, state.activeMaterialNodeId);
  if (!found) return true;

  if (found.node.type === "category") {
    const category = found.node.filterCategory || found.node.label;
    return (material.category || "전체") === category;
  }

  const ids = new Set(getDescendantMaterialNodeIds(found.node));
  return ids.has(material.folder_id);
}

function getMaterialCounts() {
  return state.materials.reduce(
    (counts, material) => {
      const type = material.material_type || "note";
      counts.total += 1;
      if (type === "space") {
        counts.spaces += 1;
      } else {
        counts.materials += 1;
      }
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    },
    { total: 0, materials: 0, spaces: 0, note: 0, link: 0, file: 0, reference: 0, space: 0 }
  );
}

function getMaterialSortTime(material = {}) {
  const time = Date.parse(material.created_at || material.updated_at || "");
  return Number.isFinite(time) ? time : 0;
}

function isWebLink(url = "") {
  return /^https?:\/\//i.test(String(url).trim());
}

function getMaterialPreview(material = {}) {
  return String(material.content || material.url || "자료 설명이 없습니다.").replace(/\s+/g, " ").trim();
}

function getTitleSortLabel() {
  return state.titleSortDirection === "asc" ? "제목 내림차순 정렬" : "제목 오름차순 정렬";
}

function getCurrentMaterials() {
  const query = state.searchQuery.trim().toLowerCase();
  let materials = state.materials.filter((material) =>
    state.activeSection === "spaces" ? material.material_type === "space" : material.material_type !== "space"
  );

  if (state.activeSection === "materials") {
    materials = materials.filter(isMaterialInActiveNode);
  }

  if (query) {
    materials = materials.filter((material) =>
      [material.title, material.content, material.url, getMaterialTypeLabel(material.material_type)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }

  if (state.titleSortDirection === "asc" || state.titleSortDirection === "desc") {
    const direction = state.titleSortDirection === "asc" ? 1 : -1;
    return materials.sort((a, b) => direction * String(a.title || "").localeCompare(String(b.title || ""), "ko", { numeric: true }));
  }

  return materials.sort((a, b) => getMaterialSortTime(b) - getMaterialSortTime(a));
}

function renderBlog(id, profile = null) {
  const title = profile?.blog_title || `${id}'s Blog`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.profileTitle) els.profileTitle.textContent = `${id}'s Blog`;
  if (els.profileId) els.profileId.textContent = `@${id}`;
  if (els.title) els.title.textContent = "자료실";
  if (els.owner) els.owner.textContent = `${id} 계정의 독립 자료실입니다.`;
  els.initials.forEach((initial) => {
    initial.textContent = id.slice(0, 1).toUpperCase();
  });
  document.title = `자료실 | ${title}`;
}

function renderStats() {
  const counts = getMaterialCounts();
  els.stats.forEach((item) => {
    const key = item.dataset.materialStat;
    item.textContent = key === "total" ? counts.total : counts[key] || 0;
  });
}

function renderSections() {
  const counts = getMaterialCounts();
  els.sectionButtons.forEach((button) => {
    const isActive = button.dataset.materialSection === state.activeSection;
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  els.sectionCounts.forEach((item) => {
    if (item.dataset.materialSectionCount === "spaces") {
      item.textContent = `${counts.spaces}개의 공간`;
      return;
    }
    item.textContent = `${counts.materials}개의 자료`;
  });
}

function renderMaterialTreeNode(node, depth = 0) {
  const hasChildren = (node.children || []).length > 0;
  const isCollapsed = state.collapsedMaterialNodeIds.has(node.id);
  const children = hasChildren && !isCollapsed ? node.children.map((child) => renderMaterialTreeNode(child, depth + 1)).join("") : "";

  return `
    <li>
      <div class="blog-tree-row ${node.id === state.activeMaterialNodeId ? "is-active" : ""}" data-material-tree-node="${escapeHtml(node.id)}" style="--tree-depth:${depth}">
        <button class="blog-tree-expander" type="button" data-material-tree-toggle="${escapeHtml(node.id)}" ${hasChildren ? "" : "disabled"} aria-label="${escapeHtml(node.label)} 접기 펼치기">
          <span aria-hidden="true">${hasChildren ? (isCollapsed ? "+" : "-") : ""}</span>
        </button>
        <button class="blog-tree-label" type="button" data-material-tree-select="${escapeHtml(node.id)}">
          <span>${escapeHtml(node.label)}</span>
        </button>
        <span class="blog-tree-node-actions">
          <button type="button" data-material-tree-rename="${escapeHtml(node.id)}" title="이름 수정" aria-label="이름 수정">
            <span class="tree-action-icon tree-action-edit" aria-hidden="true"></span>
          </button>
          <button type="button" data-material-tree-add-folder="${escapeHtml(node.id)}" title="폴더 추가" aria-label="폴더 추가">
            <span class="tree-action-icon tree-action-folder" aria-hidden="true"></span>
          </button>
        </span>
      </div>
      ${children ? `<ul>${children}</ul>` : ""}
    </li>
  `;
}

function renderMaterialTree() {
  if (els.treeAll) {
    if (state.activeSection === "materials" && state.activeMaterialNodeId === MATERIAL_ALL_NODE_ID) {
      els.treeAll.setAttribute("aria-current", "page");
    } else {
      els.treeAll.removeAttribute("aria-current");
    }
  }

  if (!els.tree) return;
  if (state.materialTree.length === 0) {
    els.tree.innerHTML = `<p class="blog-tree-empty">카테고리를 추가해주세요.</p>`;
    return;
  }

  els.tree.innerHTML = `<ul>${state.materialTree.map((node) => renderMaterialTreeNode(node)).join("")}</ul>`;
}

function renderToolState() {
  els.tools
    ?.querySelector('[data-material-action="toggle-selection"]')
    ?.classList.toggle("is-active", state.selectionMode);
}

function renderBoardHeader(materials = []) {
  const title = state.searchQuery.trim()
    ? `검색: ${state.searchQuery.trim()}`
    : state.activeSection === "materials" && state.activeMaterialNodeId !== MATERIAL_ALL_NODE_ID
      ? findMaterialNode(state.materialTree, state.activeMaterialNodeId)?.node.label || "자료"
      : SECTION_LABELS[state.activeSection] || "자료";
  if (els.boardTitle) els.boardTitle.textContent = title;
  if (els.count) els.count.textContent = `${materials.length}개의 ${state.activeSection === "spaces" ? "공간" : "자료"}`;
  if (els.titleHeading) els.titleHeading.textContent = state.activeSection === "spaces" ? "공간 이름" : "자료 제목";
  if (els.typeHeading) els.typeHeading.textContent = state.activeSection === "spaces" ? "구분" : "종류";
}

function renderMaterialRows(materials = []) {
  if (!els.list) return;

  if (materials.length === 0) {
    const message = state.materialError || (state.activeSection === "spaces" ? "아직 만든 공간이 없습니다." : "아직 저장된 자료가 없습니다.");
    els.list.innerHTML = `
      <div class="blog-empty-row">
        <span>${escapeHtml(message)}</span>
        <span>-</span>
        <span>-</span>
        <span aria-hidden="true"></span>
      </div>
    `;
    return;
  }

  els.list.innerHTML = materials
    .map((material) => {
      const isSelected = material.id && material.id === state.selectedMaterialId;
      const isChecked = material.id && state.selectedMaterialIds.has(material.id);
      return `
        <div class="blog-post-row ${isSelected || isChecked ? "is-selected" : ""}" data-material-row="${escapeHtml(material.id)}" tabindex="0">
          <span class="materials-row-main">
            ${
              state.selectionMode
                ? `<input class="materials-select-check" type="checkbox" data-material-check="${escapeHtml(material.id)}" ${isChecked ? "checked" : ""} aria-label="${escapeHtml(material.title)} 선택">`
                : ""
            }
            <span class="materials-row-text">
              <span class="blog-post-title">${escapeHtml(material.title)}</span>
              <small>${escapeHtml(getMaterialPreview(material))}</small>
            </span>
          </span>
          <span>${escapeHtml(getMaterialTypeLabel(material.material_type))}</span>
          <span>${escapeHtml(formatDate(material.created_at || material.updated_at))}</span>
          <span aria-hidden="true"></span>
        </div>
      `;
    })
    .join("");
}

function renderFeatureArea(materials = []) {
  if (!els.featureCard) return;

  if (materials.length === 0) {
    state.selectedMaterialId = "";
    els.featureCard.hidden = true;
    els.featureCard.innerHTML = "";
    return;
  }

  const selectedExists = materials.some((material) => material.id === state.selectedMaterialId);
  if (!selectedExists) state.selectedMaterialId = materials[0].id;

  const material = materials.find((item) => item.id === state.selectedMaterialId) || materials[0];
  const title = material.title || "제목 없는 자료";
  const preview = getMaterialPreview(material);
  const date = formatDate(material.created_at || material.updated_at);
  const typeLabel = getMaterialTypeLabel(material.material_type);
  const url = String(material.url || "").trim();
  const canOpen = isWebLink(url);
  const initial = (state.id || "B").slice(0, 1).toUpperCase();

  els.featureCard.hidden = false;
  els.featureCard.setAttribute("tabindex", "0");
  els.featureCard.setAttribute("aria-label", `${title} 자료 보기`);
  els.featureCard.innerHTML = `
    <div class="blog-feature-kicker">${escapeHtml(typeLabel)}</div>
    ${canOpen ? `<a class="blog-feature-title" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>` : `<span class="blog-feature-title">${escapeHtml(title)}</span>`}
    <div class="blog-feature-meta">
      <span class="blog-feature-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <span class="blog-feature-author">${escapeHtml(state.id || "blog")}</span>
      <time datetime="${escapeHtml(material.created_at || material.updated_at || "")}">${escapeHtml(date)}</time>
      <span>${escapeHtml(typeLabel)}</span>
      ${canOpen ? `<a class="blog-feature-light-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">열기</a>` : ""}
      <button class="blog-feature-light-button" type="button" data-feature-delete="${escapeHtml(material.id)}">삭제</button>
    </div>
    <div class="blog-feature-media">
      <span class="blog-feature-placeholder">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(preview)}</small>
      </span>
    </div>
    <div class="blog-feature-caption">${escapeHtml(url || preview)}</div>
    <div class="blog-feature-actions" aria-label="자료 기능">
      ${canOpen ? `<a class="blog-feature-text-action" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">열기</a>` : ""}
      <button class="blog-feature-text-action" type="button" data-feature-delete="${escapeHtml(material.id)}">삭제</button>
    </div>
  `;
}

function renderSpaceCards(spaces = []) {
  if (!els.spaceGrid) return;

  if (spaces.length === 0) {
    state.selectedMaterialId = "";
    els.spaceGrid.innerHTML = `
      <div class="materials-space-empty">
        <strong>아직 만든 공간이 없습니다.</strong>
        <span>공간 영역에서 불러오기를 사용하면 카드로 정리됩니다.</span>
      </div>
    `;
    return;
  }

  const selectedExists = spaces.some((space) => space.id === state.selectedMaterialId);
  if (!selectedExists) state.selectedMaterialId = spaces[0].id;

  els.spaceGrid.innerHTML = spaces
    .map((space) => {
      const isSelected = space.id && space.id === state.selectedMaterialId;
      const isChecked = space.id && state.selectedMaterialIds.has(space.id);
      const preview = getMaterialPreview(space);
      return `
        <article class="materials-space-board-card ${isSelected || isChecked ? "is-selected" : ""}" data-space-card="${escapeHtml(space.id)}" tabindex="0">
          <div class="materials-space-card-top">
            ${
              state.selectionMode
                ? `<input class="materials-select-check" type="checkbox" data-material-check="${escapeHtml(space.id)}" ${isChecked ? "checked" : ""} aria-label="${escapeHtml(space.title)} 선택">`
                : `<span>공간</span>`
            }
            <time datetime="${escapeHtml(space.created_at || space.updated_at || "")}">${escapeHtml(formatDate(space.created_at || space.updated_at))}</time>
          </div>
          <h3>${escapeHtml(space.title || "이름 없는 공간")}</h3>
          <p>${escapeHtml(preview)}</p>
          <div class="materials-space-card-actions">
            <button type="button" data-space-delete="${escapeHtml(space.id)}">삭제</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMiniList(materials = []) {
  if (!els.miniList) return;
  if (materials.length === 0) {
    els.miniList.hidden = true;
    els.miniList.innerHTML = "";
    return;
  }

  const title = state.searchQuery.trim()
    ? `검색 ${state.searchQuery.trim()}`
    : state.activeSection === "materials" && state.activeMaterialNodeId !== MATERIAL_ALL_NODE_ID
      ? findMaterialNode(state.materialTree, state.activeMaterialNodeId)?.node.label || "자료"
      : SECTION_LABELS[state.activeSection] || "자료";
  const sortLabel = getTitleSortLabel();
  els.miniList.hidden = false;
  els.miniList.innerHTML = `
    <div class="blog-mini-list-head">
      <strong>이 자료실 ${escapeHtml(title)}</strong>
      <button class="blog-title-sort blog-mini-title-sort" type="button" data-mini-material-title-sort data-sort-direction="${escapeHtml(state.titleSortDirection)}" aria-label="${escapeHtml(sortLabel)}" title="${escapeHtml(sortLabel)}">
        <span class="blog-title-sort-icon" aria-hidden="true"></span>
      </button>
    </div>
    <div class="blog-mini-rows">
      ${materials
        .slice(0, 5)
        .map(
          (material) => `
            <button class="blog-mini-row ${material.id === state.selectedMaterialId ? "is-selected" : ""}" type="button" data-mini-material="${escapeHtml(material.id)}" aria-pressed="${material.id === state.selectedMaterialId ? "true" : "false"}">
              <span>${escapeHtml(material.title)}</span>
              <time>${escapeHtml(formatDate(material.created_at || material.updated_at))}</time>
            </button>
          `
        )
        .join("")}
    </div>
    <div class="blog-mini-footer">
      <span>이전</span>
      <span>다음</span>
      <a href="#top">TOP</a>
    </div>
  `;
}

function renderDashboard() {
  const materials = getCurrentMaterials();
  const isSpaceSection = state.activeSection === "spaces";
  renderStats();
  renderSections();
  renderMaterialTree();
  renderToolState();
  renderBoardHeader(materials);
  if (els.table) els.table.hidden = isSpaceSection;
  if (els.spaceGrid) els.spaceGrid.hidden = !isSpaceSection;
  if (els.listToggle) els.listToggle.hidden = isSpaceSection;

  if (isSpaceSection) {
    renderSpaceCards(materials);
    if (els.featureCard) {
      els.featureCard.hidden = true;
      els.featureCard.innerHTML = "";
    }
    if (els.miniList) {
      els.miniList.hidden = true;
      els.miniList.innerHTML = "";
    }
  } else {
    if (els.spaceGrid) els.spaceGrid.innerHTML = "";
    renderFeatureArea(materials);
    renderMaterialRows(materials);
    renderMiniList(materials);
  }
  const sortLabel = getTitleSortLabel();
  if (els.titleSort) {
    els.titleSort.dataset.sortDirection = state.titleSortDirection;
    els.titleSort.setAttribute("aria-label", sortLabel);
    els.titleSort.setAttribute("title", sortLabel);
  }
}

async function loadBlogProfile(session) {
  if (!session?.access_token || !session.user?.id) return null;
  const rows = await requestRest(
    `blog_profiles?select=login_id,blog_title&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function loadMaterials(session) {
  const rows = await requestRest(
    `blog_materials?select=id,user_id,login_id,title,material_type,url,content,category,folder_id,folder_name,folder_path,source_post_id,created_at,updated_at,deleted_at&user_id=eq.${encodeURIComponent(
      session.user.id
    )}&deleted_at=is.null&order=created_at.desc&limit=1000`,
    session.access_token
  );
  return Array.isArray(rows) ? rows.map(normalizeMaterial) : [];
}

async function loadMaterialTree(session) {
  const rows = await requestRest(
    `material_trees?select=tree,tree_collapsed_ids&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  const item = Array.isArray(rows) ? rows[0] : null;
  return {
    tree: Array.isArray(item?.tree) ? item.tree.map(normalizeMaterialTreeNode) : [],
    collapsedIds: Array.isArray(item?.tree_collapsed_ids) ? item.tree_collapsed_ids : [],
  };
}

async function saveMaterialTree() {
  await requestRest("material_trees?on_conflict=user_id", state.session.access_token, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: state.session.user.id,
      login_id: state.id,
      tree: state.materialTree,
      tree_collapsed_ids: [...state.collapsedMaterialNodeIds],
      updated_at: new Date().toISOString(),
    }),
  });
}

async function addMaterialCategory() {
  const label = promptName("추가할 자료 카테고리 이름을 입력해주세요.", "새 카테고리");
  if (!label) return;

  const node = createMaterialTreeNode("category", label);
  state.materialTree.push(node);
  state.activeSection = "materials";
  state.activeMaterialNodeId = node.id;
  await saveMaterialTree();
  renderDashboard();
}

async function addMaterialFolder(parentId) {
  const found = findMaterialNode(state.materialTree, parentId);
  if (!found) return;

  const label = promptName("추가할 폴더 이름을 입력해주세요.", "새 폴더");
  if (!label) return;

  found.node.children = Array.isArray(found.node.children) ? found.node.children : [];
  const folder = createMaterialTreeNode("folder", label);
  found.node.children.push(folder);
  state.collapsedMaterialNodeIds.delete(found.node.id);
  state.activeSection = "materials";
  state.activeMaterialNodeId = folder.id;
  await saveMaterialTree();
  renderDashboard();
}

async function renameMaterialNode(nodeId) {
  const found = findMaterialNode(state.materialTree, nodeId);
  if (!found) return;

  const row = els.tree?.querySelector(`[data-material-tree-node="${CSS.escape(nodeId)}"]`);
  const labelButton = row?.querySelector("[data-material-tree-select]");
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
      await saveMaterialTree();
    }
    renderDashboard();
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finishRename(true);
    if (event.key === "Escape") finishRename(false);
  });
  input.addEventListener("blur", () => finishRename(true), { once: true });
}

async function createMaterial(payload) {
  const rows = await requestRest("blog_materials", state.session.access_token, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  return normalizeMaterial(Array.isArray(rows) ? rows[0] : payload);
}

async function readMaterialFile(file) {
  const extension = getFileExtension(file.name);

  if (extension === "docx") {
    if (!window.mammoth?.convertToHtml) {
      throw new Error("DOCX 불러오기 도구를 불러오지 못했습니다.");
    }
    const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToPlainText(cleanImportedHtml(result.value));
  }

  const text = await file.text();
  if (extension === "html" || extension === "htm") return htmlToPlainText(cleanImportedHtml(text));
  if (extension === "rtf") return stripRtfToText(text);
  return text.trim();
}

async function importMaterialFiles(files = []) {
  const fileList = [...files].filter(Boolean);
  if (fileList.length === 0) return;
  if (!state.session?.access_token) {
    window.alert("로그인이 필요합니다.");
    return;
  }

  const errors = [];
  const imported = [];
  const location = getActiveMaterialLocation();

  for (const file of fileList) {
    try {
      const content = await readMaterialFile(file);
      const material = await createMaterial({
        user_id: state.session.user.id,
        login_id: state.id,
        title: getFileStem(file.name).slice(0, 120),
        material_type: state.activeSection === "spaces" ? "space" : "file",
        url: file.name,
        content: content || file.name,
        category: state.activeSection === "spaces" ? "전체" : location.category,
        folder_id: state.activeSection === "spaces" ? null : location.folder?.id || null,
        folder_name: state.activeSection === "spaces" ? null : location.folder?.label || null,
        folder_path: state.activeSection === "spaces" ? null : location.folder?.path || null,
        deleted_at: null,
      });
      imported.push(material);
    } catch (error) {
      errors.push(`${file.name}: ${error.message || "불러오지 못했습니다."}`);
    }
  }

  if (imported.length > 0) {
    state.materials = [...imported, ...state.materials];
    state.selectedMaterialId = imported[0].id;
    state.activeSection = imported[0].material_type === "space" ? "spaces" : "materials";
    state.activeFilter = "all";
    state.searchQuery = "";
    state.materialError = "";
    if (els.searchInput) els.searchInput.value = "";
    renderDashboard();
  }

  if (errors.length > 0) {
    window.alert(`${imported.length}개의 파일을 불러왔습니다.\n\n${errors.join("\n")}`);
    return;
  }
  window.alert(`${imported.length}개의 파일을 불러왔습니다.`);
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

function getExportMaterials() {
  const selected = state.materials.filter((material) => state.selectedMaterialIds.has(material.id));
  return selected.length > 0 ? selected : getCurrentMaterials();
}

function buildMaterialExportBaseName(materials, format) {
  const title = els.boardTitle?.textContent || "자료실";
  const suffix = materials.length === 1 ? materials[0].title || title : title;
  return `${sanitizeFileName(`${state.id || "materials"}-${suffix}`)}.${format}`;
}

function plainTextToExportHtml(text = "") {
  const normalized = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "<p></p>";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function exportMaterialsAsText(materials) {
  const text = materials
    .map((material) =>
      [
        material.title || "제목 없는 자료",
        getMaterialTypeLabel(material.material_type),
        formatDate(material.created_at || material.updated_at),
        material.url || "",
        "",
        material.content || "",
      ].join("\n")
    )
    .join("\n\n---\n\n");
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), buildMaterialExportBaseName(materials, "txt"));
}

function exportMaterialsAsDocx(materials) {
  const docx = window.htmlDocx || window.htmlDocxJs;
  if (!docx?.asBlob) {
    window.alert("DOCX 내보내기 도구를 불러오지 못했습니다. TXT로 다시 내보내주세요.");
    return;
  }

  const body = materials
    .map(
      (material) => `
        <article>
          <h1>${escapeHtml(material.title || "제목 없는 자료")}</h1>
          <p>${escapeHtml(getMaterialTypeLabel(material.material_type))} · ${escapeHtml(formatDate(material.created_at || material.updated_at))}</p>
          ${material.url ? `<p>${escapeHtml(material.url)}</p>` : ""}
          ${plainTextToExportHtml(material.content || "")}
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
  downloadBlob(docx.asBlob(html), buildMaterialExportBaseName(materials, "docx"));
}

function exportMaterials() {
  const materials = getExportMaterials();
  if (materials.length === 0) {
    window.alert("내보낼 자료가 없습니다.");
    return;
  }

  const format = window.prompt("내보낼 형식을 입력해주세요. txt 또는 docx", "txt")?.trim().toLowerCase();
  if (!format) return;
  if (format === "txt") {
    exportMaterialsAsText(materials);
    return;
  }
  if (format === "docx") {
    exportMaterialsAsDocx(materials);
    return;
  }
  window.alert("txt 또는 docx 형식만 입력해주세요.");
}

async function promptCreateMaterial() {
  const isSpaceSection = state.activeSection === "spaces";
  const title = window.prompt(isSpaceSection ? "공간 이름을 입력해주세요." : "자료 제목을 입력해주세요.", "")?.trim();
  if (!title) return;

  const defaultType = isSpaceSection ? "공간" : "메모";
  const typeInput = isSpaceSection ? "공간" : window.prompt("자료 종류를 입력해주세요. 메모, 링크, 파일, 참고", defaultType);
  if (typeInput === null) return;

  const url = isSpaceSection ? "" : window.prompt("링크 또는 파일 경로를 입력해주세요. 비워둘 수 있습니다.", "")?.trim() || "";
  const content = window.prompt(
    isSpaceSection ? "공간 설명을 입력해주세요. 비워둘 수 있습니다." : "자료 내용을 입력해주세요. 비워둘 수 있습니다.",
    ""
  )?.trim() || "";
  const location = getActiveMaterialLocation();

  try {
    const material = await createMaterial({
      user_id: state.session.user.id,
      login_id: state.id,
      title: title.slice(0, 120),
      material_type: getMaterialTypeFromInput(typeInput),
      url: url || null,
      content: content || null,
      category: isSpaceSection ? "전체" : location.category,
      folder_id: isSpaceSection ? null : location.folder?.id || null,
      folder_name: isSpaceSection ? null : location.folder?.label || null,
      folder_path: isSpaceSection ? null : location.folder?.path || null,
      deleted_at: null,
    });
    state.materials = [material, ...state.materials];
    state.selectedMaterialId = material.id;
    state.activeSection = material.material_type === "space" ? "spaces" : "materials";
    state.activeFilter = "all";
    state.searchQuery = "";
    state.materialError = "";
    if (els.searchInput) els.searchInput.value = "";
    renderDashboard();
  } catch (error) {
    window.alert(error.message || "자료를 저장하지 못했습니다.");
  }
}

async function moveMaterialToTrash(materialId) {
  await requestRest(
    `blog_materials?id=eq.${encodeURIComponent(materialId)}&user_id=eq.${encodeURIComponent(state.session.user.id)}`,
    state.session.access_token,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

function selectMaterial(materialId) {
  if (!materialId) return;
  const exists = getCurrentMaterials().some((material) => material.id === materialId);
  if (!exists) return;
  state.selectedMaterialId = materialId;
  renderDashboard();
}

async function deleteMaterial(materialId) {
  if (!materialId || !window.confirm("자료를 휴지통으로 이동할까요?")) return;
  await moveMaterialToTrash(materialId);
  state.materials = state.materials.filter((material) => material.id !== materialId);
  state.selectedMaterialIds.delete(materialId);
  if (state.selectedMaterialId === materialId) state.selectedMaterialId = "";
  renderDashboard();
}

async function deleteSelectedMaterials() {
  const ids = [...state.selectedMaterialIds];
  if (ids.length === 0 && state.selectedMaterialId) ids.push(state.selectedMaterialId);

  if (ids.length === 0) {
    state.selectionMode = true;
    renderDashboard();
    window.alert("삭제할 자료를 선택해주세요.");
    return;
  }

  if (!window.confirm("선택한 자료를 휴지통으로 이동할까요?")) return;

  try {
    await Promise.all(ids.map((materialId) => moveMaterialToTrash(materialId)));
    const idSet = new Set(ids);
    state.materials = state.materials.filter((material) => !idSet.has(material.id));
    state.selectedMaterialIds.clear();
    state.selectedMaterialId = "";
    state.selectionMode = false;
    renderDashboard();
  } catch (error) {
    window.alert(error.message || "자료를 삭제하지 못했습니다.");
  }
}

function toggleTitleSort() {
  state.titleSortDirection = state.titleSortDirection === "asc" ? "desc" : "asc";
  renderDashboard();
}

if (els.listToggle && els.board) {
  const isInitiallyCollapsed = els.board.classList.contains("is-list-collapsed");
  els.listToggle.textContent = isInitiallyCollapsed ? "목록열기" : "목록닫기";
  els.listToggle.setAttribute("aria-expanded", String(!isInitiallyCollapsed));

  els.listToggle.addEventListener("click", () => {
    const isCollapsed = els.board.classList.toggle("is-list-collapsed");
    els.listToggle.textContent = isCollapsed ? "목록열기" : "목록닫기";
    els.listToggle.setAttribute("aria-expanded", String(!isCollapsed));
  });
}

els.materialForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = els.materialTitle?.value.trim() || "";
  if (!title) {
    els.materialTitle?.focus();
    return;
  }

  const submitButton = els.materialForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const material = await createMaterial({
      user_id: state.session.user.id,
      login_id: state.id,
      title,
      material_type: els.materialType?.value || "note",
      url: els.materialUrl?.value.trim() || null,
      content: els.materialContent?.value.trim() || null,
      deleted_at: null,
    });
    state.materials = [material, ...state.materials];
    state.selectedMaterialId = material.id;
    state.activeFilter = "all";
    state.searchQuery = "";
    if (els.searchInput) els.searchInput.value = "";
    state.materialError = "";
    els.materialForm.reset();
    renderDashboard();
  } catch (error) {
    window.alert(error.message || "자료를 저장하지 못했습니다.");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

els.list?.addEventListener("click", (event) => {
  if (event.target.closest("[data-material-check]")) return;
  const row = event.target.closest("[data-material-row]");
  if (!row) return;
  event.preventDefault();
  selectMaterial(row.dataset.materialRow);
});

els.list?.addEventListener("keydown", (event) => {
  const row = event.target.closest("[data-material-row]");
  if (!row || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  selectMaterial(row.dataset.materialRow);
});

els.list?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-material-check]");
  if (!checkbox) return;
  if (checkbox.checked) {
    state.selectedMaterialIds.add(checkbox.dataset.materialCheck);
  } else {
    state.selectedMaterialIds.delete(checkbox.dataset.materialCheck);
  }
  renderDashboard();
});

els.spaceGrid?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-space-delete]");
  if (deleteButton) {
    event.preventDefault();
    await deleteMaterial(deleteButton.dataset.spaceDelete);
    return;
  }

  if (event.target.closest("[data-material-check]")) return;
  const card = event.target.closest("[data-space-card]");
  if (!card) return;
  event.preventDefault();
  selectMaterial(card.dataset.spaceCard);
});

els.spaceGrid?.addEventListener("keydown", (event) => {
  const card = event.target.closest("[data-space-card]");
  if (!card || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  selectMaterial(card.dataset.spaceCard);
});

els.spaceGrid?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-material-check]");
  if (!checkbox) return;
  if (checkbox.checked) {
    state.selectedMaterialIds.add(checkbox.dataset.materialCheck);
  } else {
    state.selectedMaterialIds.delete(checkbox.dataset.materialCheck);
  }
  renderDashboard();
});

els.featureCard?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-feature-delete]");
  if (!deleteButton) return;
  event.preventDefault();
  await deleteMaterial(deleteButton.dataset.featureDelete);
});

els.miniList?.addEventListener("click", (event) => {
  const sortButton = event.target.closest("[data-mini-material-title-sort]");
  if (sortButton) {
    event.preventDefault();
    toggleTitleSort();
    return;
  }

  const row = event.target.closest("[data-mini-material]");
  if (!row) return;
  event.preventDefault();
  selectMaterial(row.dataset.miniMaterial);
});

els.titleSort?.addEventListener("click", toggleTitleSort);

els.toolsToggle?.addEventListener("click", () => {
  const willOpen = els.tools?.hidden;
  if (els.tools) els.tools.hidden = !willOpen;
  els.toolsToggle.setAttribute("aria-expanded", String(Boolean(willOpen)));
});

els.tools?.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-material-action]")?.dataset.materialAction;
  if (!action) return;

  if (action === "add-material") {
    await promptCreateMaterial();
    return;
  }

  if (action === "add-category") {
    await addMaterialCategory();
    return;
  }

  if (action === "toggle-selection") {
    state.selectionMode = !state.selectionMode;
    state.selectedMaterialIds.clear();
    renderDashboard();
    return;
  }

  if (action === "delete-selected") {
    await deleteSelectedMaterials();
    return;
  }

  if (action === "import-files") {
    els.importInput?.click();
    return;
  }

  if (action === "export-files") {
    exportMaterials();
  }
});

els.importInput?.addEventListener("change", async (event) => {
  const files = event.target.files ? [...event.target.files] : [];
  event.target.value = "";
  await importMaterialFiles(files);
});

els.treeAll?.addEventListener("click", () => {
  state.activeSection = "materials";
  state.activeMaterialNodeId = MATERIAL_ALL_NODE_ID;
  state.searchQuery = "";
  state.selectedMaterialId = "";
  state.selectedMaterialIds.clear();
  if (els.searchInput) els.searchInput.value = "";
  renderDashboard();
});

els.tree?.addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-material-tree-toggle]");
  if (toggle && !toggle.disabled) {
    const id = toggle.dataset.materialTreeToggle;
    if (state.collapsedMaterialNodeIds.has(id)) {
      state.collapsedMaterialNodeIds.delete(id);
    } else {
      state.collapsedMaterialNodeIds.add(id);
    }
    await saveMaterialTree();
    renderDashboard();
    return;
  }

  const rename = event.target.closest("[data-material-tree-rename]");
  if (rename) {
    await renameMaterialNode(rename.dataset.materialTreeRename);
    return;
  }

  const add = event.target.closest("[data-material-tree-add-folder]");
  if (add) {
    await addMaterialFolder(add.dataset.materialTreeAddFolder);
    return;
  }

  const select = event.target.closest("[data-material-tree-select]");
  if (select) {
    state.activeSection = "materials";
    state.activeMaterialNodeId = select.dataset.materialTreeSelect;
    state.searchQuery = "";
    state.selectedMaterialId = "";
    state.selectedMaterialIds.clear();
    if (els.searchInput) els.searchInput.value = "";
    renderDashboard();
  }
});

els.sectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeSection = button.dataset.materialSection || "materials";
    if (state.activeSection === "materials" && !findMaterialNode(state.materialTree, state.activeMaterialNodeId)) {
      state.activeMaterialNodeId = MATERIAL_ALL_NODE_ID;
    }
    state.activeFilter = "all";
    state.searchQuery = "";
    state.selectedMaterialId = "";
    state.selectedMaterialIds.clear();
    if (els.searchInput) els.searchInput.value = "";
    renderDashboard();
  });
});

els.searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  state.searchQuery = els.searchInput?.value || "";
  state.selectedMaterialId = "";
  state.selectedMaterialIds.clear();
  renderDashboard();
});

els.searchInput?.addEventListener("input", () => {
  if (!els.searchInput.value.trim()) {
    state.searchQuery = "";
    state.selectedMaterialIds.clear();
    renderDashboard();
  }
});

els.scrollTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.scrollBottom?.addEventListener("click", () => {
  const bottom = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );
  window.scrollTo({ top: bottom, behavior: "smooth" });
});

window.blogSession?.ready.then(async (session) => {
  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }

  state.session = session;
  state.id = id;
  renderBlog(id);
  renderDashboard();

  try {
    const profile = await loadBlogProfile(session);
    renderBlog(id, profile);
  } catch {
    renderBlog(id);
  }

  try {
    const treeState = await loadMaterialTree(session);
    state.materialTree = treeState.tree;
    state.collapsedMaterialNodeIds = new Set(treeState.collapsedIds);
  } catch {
    state.materialTree = [];
    state.collapsedMaterialNodeIds = new Set();
  }

  try {
    state.materials = await loadMaterials(session);
    state.materialError = "";
  } catch (error) {
    state.materials = [];
    state.materialError = error.message || "자료실을 불러오지 못했습니다.";
  }

  renderDashboard();
});
