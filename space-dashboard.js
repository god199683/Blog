const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const DEFAULT_MAP = {
  kind: "blog-map",
  version: 2,
  width: 32,
  height: 20,
  tileSize: 32,
  canvasWidth: 1024,
  canvasHeight: 640,
  background: "#fbfdff",
  cells: {},
  strokes: [],
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

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function createId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function normalizePoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function getCanvasWidth(map = state.map) {
  return clampNumber(map.canvasWidth || map.width * map.tileSize, 320, 6000);
}

function getCanvasHeight(map = state.map) {
  return clampNumber(map.canvasHeight || map.height * map.tileSize, 240, 4200);
}

function cloneMap(map = DEFAULT_MAP) {
  const tileSize = Number(map.tileSize) || DEFAULT_MAP.tileSize;
  const legacyWidth = Number(map.width) || DEFAULT_MAP.width;
  const legacyHeight = Number(map.height) || DEFAULT_MAP.height;
  const hasCanvasSize = Number.isFinite(Number(map.canvasWidth)) && Number.isFinite(Number(map.canvasHeight));
  const canvasWidth = hasCanvasSize ? Number(map.canvasWidth) : legacyWidth * tileSize;
  const canvasHeight = hasCanvasSize ? Number(map.canvasHeight) : legacyHeight * tileSize;
  const cells = map.cells && typeof map.cells === "object" ? map.cells : {};
  const strokes = Array.isArray(map.strokes)
    ? map.strokes
        .filter((stroke) => Array.isArray(stroke.points) && stroke.points.length > 0)
        .map((stroke) => ({
          id: stroke.id || createId(),
          tool: stroke.tool === "erase" ? "erase" : "brush",
          color: stroke.color || "#1f3b57",
          width: clampNumber(stroke.width || 6, 1, 96),
          points: stroke.points.map(normalizePoint),
        }))
    : [];
  const markers = Array.isArray(map.markers)
    ? map.markers.map((marker) => ({
        ...marker,
        id: marker.id || createId(),
        x: hasCanvasSize ? Number(marker.x) || 0 : (Number(marker.x) || 0) * tileSize + tileSize / 2,
        y: hasCanvasSize ? Number(marker.y) || 0 : (Number(marker.y) || 0) * tileSize + tileSize / 2,
      }))
    : [];

  return {
    ...structuredClone(DEFAULT_MAP),
    ...map,
    version: 2,
    tileSize,
    canvasWidth,
    canvasHeight,
    width: Math.ceil(canvasWidth / tileSize),
    height: Math.ceil(canvasHeight / tileSize),
    background: map.background || DEFAULT_MAP.background,
    cells,
    strokes,
    markers,
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

function drawLegacyCells(scale) {
  const tile = (state.map.tileSize || DEFAULT_MAP.tileSize) * scale;
  Object.entries(state.map.cells || {}).forEach(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = cell.color || "#dff4ff";
    ctx.fillRect(x * tile, y * tile, tile, tile);
  });
}

function drawStroke(stroke, scale) {
  const points = stroke.points || [];
  if (points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "erase" ? state.map.background : stroke.color || "#1f3b57";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1, (stroke.width || 6) * scale);

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * scale, points[0].y * scale, Math.max(1, ctx.lineWidth / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x * scale, points[0].y * scale);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = ((previous.x + current.x) / 2) * scale;
    const midY = ((previous.y + current.y) / 2) * scale;
    ctx.quadraticCurveTo(previous.x * scale, previous.y * scale, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x * scale, last.y * scale);
  ctx.stroke();
  ctx.restore();
}

function drawMarker(marker, scale) {
  const x = (Number(marker.x) || 0) * scale;
  const y = (Number(marker.y) || 0) * scale;
  const label = marker.label || "표식";
  ctx.save();
  ctx.font = `700 ${Math.max(10, 15 * scale)}px sans-serif`;
  ctx.textBaseline = "middle";

  if (marker.type === "label") {
    ctx.fillStyle = marker.color || "#0f3f61";
    ctx.fillText(label, x, y);
    ctx.restore();
    return;
  }

  ctx.fillStyle = marker.color || "#0284c7";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(4, 7 * scale), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17324a";
  ctx.fillText(label, x + 12 * scale, y);
  ctx.restore();
}

function drawPreview() {
  if (!ctx || !els.preview) return;
  const maxWidth = 960;
  const maxHeight = 560;
  const scale = Math.min(maxWidth / getCanvasWidth(), maxHeight / getCanvasHeight(), 1);
  const width = Math.max(1, Math.round(getCanvasWidth() * scale));
  const height = Math.max(1, Math.round(getCanvasHeight() * scale));
  els.preview.width = width;
  els.preview.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = state.map.background || DEFAULT_MAP.background;
  ctx.fillRect(0, 0, width, height);
  drawLegacyCells(scale);
  state.map.strokes.forEach((stroke) => drawStroke(stroke, scale));
  state.map.markers.forEach((marker) => drawMarker(marker, scale));
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
          <span>${Math.round(marker.x)}, ${Math.round(marker.y)}</span>
        </article>
      `
    )
    .join("");
}

function renderDashboard() {
  const strokes = state.map.strokes.length;
  const cells = Object.keys(state.map.cells || {}).length;
  const elements = strokes + cells + state.map.markers.length;
  const note = String(state.map.note || "").trim();

  if (els.title) els.title.textContent = state.space?.title || "공간";
  if (els.summary) els.summary.textContent = `${getCanvasWidth()} x ${getCanvasHeight()} 캔버스에 저장된 공간입니다.`;
  if (els.updated) els.updated.textContent = `수정일 ${formatDate(state.space?.updated_at || state.space?.created_at)}`;
  if (els.editLink) els.editLink.href = `./map-editor.html?space=${encodeURIComponent(state.spaceId)}`;
  if (els.note) els.note.textContent = note || "설명이 없습니다.";

  setStat("size", `${getCanvasWidth()} x ${getCanvasHeight()}`);
  setStat("tiles", String(strokes));
  setStat("markers", String(state.map.markers.length));
  setStat("coverage", String(elements));
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
    window.location.href = "./materials.html#spaces";
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
    window.location.href = "./materials.html#spaces";
  }
});
