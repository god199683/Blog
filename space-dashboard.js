const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const DEFAULT_MAP = {
  kind: "blog-map",
  version: 1,
  width: 32,
  height: 20,
  tileSize: 32,
  cells: {},
  markers: [],
  note: "",
};

const state = {
  session: null,
  id: "",
  spaceId: new URLSearchParams(window.location.search).get("space") || "",
  space: null,
  map: structuredClone(DEFAULT_MAP),
};

const els = {
  brandTitle: document.querySelector("[data-space-brand-title]"),
  initials: document.querySelectorAll("[data-space-brand-initial]"),
  title: document.querySelector("[data-space-title]"),
  summary: document.querySelector("[data-space-summary]"),
  updated: document.querySelector("[data-space-updated]"),
  editLink: document.querySelector("[data-space-edit-link]"),
  preview: document.querySelector("[data-space-preview]"),
  note: document.querySelector("[data-space-note]"),
  markers: document.querySelector("[data-space-markers]"),
  stats: document.querySelectorAll("[data-space-stat]"),
};

const ctx = els.preview?.getContext("2d");

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
  if (!response.ok) throw new Error(payload?.message || "공간 정보를 불러오지 못했습니다.");
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

function formatDate(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function cloneMap(map = DEFAULT_MAP) {
  return {
    ...structuredClone(DEFAULT_MAP),
    ...map,
    cells: map.cells && typeof map.cells === "object" ? map.cells : {},
    markers: Array.isArray(map.markers) ? map.markers : [],
  };
}

function parseMapContent(content = "") {
  try {
    const parsed = JSON.parse(content || "");
    if (parsed?.kind === "blog-map") return cloneMap(parsed);
  } catch {}
  return {
    ...structuredClone(DEFAULT_MAP),
    note: String(content || ""),
  };
}

function setStat(key, value) {
  const item = [...els.stats].find((stat) => stat.dataset.spaceStat === key);
  if (item) item.textContent = value;
}

function syncBrand() {
  const title = `${state.id || "Blog"}'s 자료실`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  els.initials.forEach((initial) => {
    initial.textContent = (state.id || "B").slice(0, 1).toUpperCase();
  });
}

function drawPreview() {
  if (!ctx || !els.preview) return;
  const maxWidth = 960;
  const maxHeight = 560;
  const tile = Math.max(8, Math.floor(Math.min(maxWidth / state.map.width, maxHeight / state.map.height)));
  const width = state.map.width * tile;
  const height = state.map.height * tile;
  els.preview.width = width;
  els.preview.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfdff";
  ctx.fillRect(0, 0, width, height);

  Object.entries(state.map.cells || {}).forEach(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = cell.color || "#dff4ff";
    ctx.fillRect(x * tile, y * tile, tile, tile);
  });

  ctx.strokeStyle = "rgba(186, 230, 253, 0.64)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.map.width; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * tile + 0.5, 0);
    ctx.lineTo(x * tile + 0.5, height);
    ctx.stroke();
  }
  for (let y = 0; y <= state.map.height; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * tile + 0.5);
    ctx.lineTo(width, y * tile + 0.5);
    ctx.stroke();
  }

  state.map.markers.forEach((marker) => {
    const cx = marker.x * tile + tile / 2;
    const cy = marker.y * tile + tile / 2;
    ctx.fillStyle = marker.color || "#0284c7";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4, tile * 0.18), 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderMarkers() {
  if (!els.markers) return;
  if (state.map.markers.length === 0) {
    els.markers.innerHTML = `<p class="space-empty-text">표식이 없습니다.</p>`;
    return;
  }

  els.markers.innerHTML = state.map.markers
    .map(
      (marker) => `
        <article class="space-marker-card">
          <strong>${escapeHtml(marker.label || "표식")}</strong>
          <span>${marker.x + 1}, ${marker.y + 1}</span>
        </article>
      `
    )
    .join("");
}

function renderDashboard() {
  const cells = Object.keys(state.map.cells || {}).length;
  const total = Math.max(1, state.map.width * state.map.height);
  const coverage = Math.round((cells / total) * 100);
  const note = String(state.map.note || "").trim();

  if (els.title) els.title.textContent = state.space?.title || "공간";
  if (els.summary) els.summary.textContent = `${state.map.width} x ${state.map.height} 맵을 기준으로 정리된 공간입니다.`;
  if (els.updated) els.updated.textContent = `수정일 ${formatDate(state.space?.updated_at || state.space?.created_at)}`;
  if (els.editLink) els.editLink.href = `./map-editor.html?space=${encodeURIComponent(state.spaceId)}`;
  if (els.note) els.note.textContent = note || "설명이 없습니다.";

  setStat("size", `${state.map.width} x ${state.map.height}`);
  setStat("tiles", String(cells));
  setStat("markers", String(state.map.markers.length));
  setStat("coverage", `${coverage}%`);
  drawPreview();
  renderMarkers();
}

async function loadSpace(session) {
  const rows = await requestRest(
    `blog_materials?select=id,title,content,material_type,created_at,updated_at&user_id=eq.${encodeURIComponent(session.user.id)}&id=eq.${encodeURIComponent(state.spaceId)}&limit=1`,
    session.access_token
  );
  const space = Array.isArray(rows) ? rows[0] : null;
  if (!space || space.material_type !== "space") throw new Error("공간 정보를 찾지 못했습니다.");
  return space;
}

window.blogSession?.ready.then(async (session) => {
  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }
  if (!state.spaceId) {
    window.location.href = "./materials.html";
    return;
  }

  state.session = session;
  state.id = id;
  syncBrand();

  try {
    state.space = await loadSpace(session);
    state.map = parseMapContent(state.space.content || "");
    document.title = `${state.space.title || "공간 관리"} | 자료실`;
    renderDashboard();
  } catch (error) {
    window.alert(error.message || "공간을 불러오지 못했습니다.");
    window.location.href = "./materials.html";
  }
});
