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

const PALETTE = [
  { id: "ink", label: "잉크", color: "#1f3b57" },
  { id: "sky", label: "하늘", color: "#38bdf8" },
  { id: "water", label: "물", color: "#0ea5e9" },
  { id: "grass", label: "풀", color: "#22c55e" },
  { id: "road", label: "길", color: "#94a3b8" },
  { id: "stone", label: "돌", color: "#64748b" },
  { id: "wall", label: "벽", color: "#334155" },
  { id: "warm", label: "장소", color: "#f59e0b" },
];

const MIN_CANVAS_WIDTH = 320;
const MIN_CANVAS_HEIGHT = 240;
const MAX_CANVAS_WIDTH = 6000;
const MAX_CANVAS_HEIGHT = 4200;
const CANVAS_GROW_WIDTH = 240;
const CANVAS_GROW_HEIGHT = 160;

const state = {
  session: null,
  id: "",
  spaceId: new URLSearchParams(window.location.search).get("space") || "",
  space: null,
  map: structuredClone(DEFAULT_MAP),
  tool: "brush",
  tile: PALETTE[0],
  zoom: 1,
  brushSize: 6,
  isDrawing: false,
  currentStroke: null,
  workspaceExpanded: false,
};

const els = {
  brandTitle: document.querySelector("[data-map-brand-title]"),
  initials: document.querySelectorAll("[data-map-brand-initial]"),
  title: document.querySelector("[data-map-title]"),
  note: document.querySelector("[data-map-note]"),
  canvas: document.querySelector("[data-map-canvas]"),
  canvasWrap: document.querySelector("[data-map-canvas-wrap]"),
  palette: document.querySelector("[data-map-palette]"),
  markerList: document.querySelector("[data-map-marker-list]"),
  width: document.querySelector("[data-map-width]"),
  height: document.querySelector("[data-map-height]"),
  resize: document.querySelector("[data-map-resize]"),
  growButtons: document.querySelectorAll("[data-map-grow]"),
  brushSize: document.querySelector("[data-map-brush-size]"),
  zoom: document.querySelector("[data-map-zoom]"),
  fit: document.querySelector("[data-map-fit]"),
  workspaceToggle: document.querySelector("[data-map-workspace-toggle]"),
  save: document.querySelector("[data-map-save]"),
  reset: document.querySelector("[data-map-reset]"),
  saveState: document.querySelector("[data-map-save-state]"),
  status: document.querySelector("[data-map-status]"),
  toolButtons: document.querySelectorAll("[data-map-tool]"),
};

const ctx = els.canvas?.getContext("2d");

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
  if (!response.ok) throw new Error(payload?.message || "맵 정보를 불러오지 못했습니다.");
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

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function createId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function getCanvasWidth(map = state.map) {
  return clampNumber(map.canvasWidth || map.width * map.tileSize, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
}

function getCanvasHeight(map = state.map) {
  return clampNumber(map.canvasHeight || map.height * map.tileSize, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT);
}

function normalizePoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
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
          color: stroke.color || PALETTE[0].color,
          width: clampNumber(stroke.width || DEFAULT_MAP.tileSize / 4, 1, 96),
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
    canvasWidth: clampNumber(canvasWidth, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH),
    canvasHeight: clampNumber(canvasHeight, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT),
    width: Math.ceil(clampNumber(canvasWidth, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH) / tileSize),
    height: Math.ceil(clampNumber(canvasHeight, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT) / tileSize),
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

function setSaveState(text, type = "") {
  if (!els.saveState) return;
  els.saveState.textContent = text;
  els.saveState.dataset.type = type;
}

function updateStatus() {
  if (!els.status) return;
  const strokes = state.map.strokes.length;
  const markers = state.map.markers.length;
  els.status.textContent = `${getCanvasWidth()} × ${getCanvasHeight()}px / 선 ${strokes} / 표식 ${markers} / ${Math.round(state.zoom * 100)}%`;
}

function syncBrand() {
  const title = `${state.id || "Blog"}'s 자료실`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  els.initials.forEach((initial) => {
    initial.textContent = (state.id || "B").slice(0, 1).toUpperCase();
  });
}

function getPointFromEvent(event) {
  if (!els.canvas) return null;
  const rect = els.canvas.getBoundingClientRect();
  const canvasWidth = getCanvasWidth();
  const canvasHeight = getCanvasHeight();
  const x = ((event.clientX - rect.left) / rect.width) * canvasWidth;
  const y = ((event.clientY - rect.top) / rect.height) * canvasHeight;
  if (x < 0 || y < 0 || x > canvasWidth || y > canvasHeight) return null;
  return { x, y };
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function drawLegacyCells() {
  const tile = state.map.tileSize || DEFAULT_MAP.tileSize;
  Object.entries(state.map.cells || {}).forEach(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = cell.color || "#dff4ff";
    ctx.fillRect(x * tile, y * tile, tile, tile);
  });
}

function drawStroke(stroke) {
  const points = stroke.points || [];
  if (points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "erase" ? state.map.background : stroke.color || PALETTE[0].color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = stroke.width || state.brushSize;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, Math.max(1, ctx.lineWidth / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function drawMarker(marker) {
  const x = Number(marker.x) || 0;
  const y = Number(marker.y) || 0;
  const label = marker.label || "표식";
  ctx.save();
  ctx.font = "700 15px sans-serif";
  ctx.textBaseline = "middle";

  if (marker.type === "label") {
    ctx.fillStyle = marker.color || "#0f3f61";
    ctx.fillText(label, x, y);
    ctx.restore();
    return;
  }

  ctx.fillStyle = marker.color || "#0284c7";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17324a";
  ctx.fillText(label, x + 12, y);
  ctx.restore();
}

function drawMap() {
  if (!ctx || !els.canvas) return;
  const canvasWidth = getCanvasWidth();
  const canvasHeight = getCanvasHeight();
  const displayWidth = Math.ceil(canvasWidth * state.zoom);
  const displayHeight = Math.ceil(canvasHeight * state.zoom);
  els.canvas.width = displayWidth;
  els.canvas.height = displayHeight;
  els.canvas.style.width = `${displayWidth}px`;
  els.canvas.style.height = `${displayHeight}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, displayWidth, displayHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.setTransform(state.zoom, 0, 0, state.zoom, 0, 0);
  ctx.fillStyle = state.map.background || DEFAULT_MAP.background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  drawLegacyCells();
  state.map.strokes.forEach(drawStroke);
  state.map.markers.forEach(drawMarker);
  updateStatus();
}

function renderPalette() {
  if (!els.palette) return;
  els.palette.innerHTML = PALETTE.map(
    (tile) => `
      <button class="${tile.id === state.tile.id ? "is-active" : ""}" type="button" data-tile="${escapeHtml(tile.id)}" title="${escapeHtml(tile.label)}" aria-label="${escapeHtml(tile.label)}">
        <span style="background:${escapeHtml(tile.color)}"></span>
      </button>
    `
  ).join("");
}

function renderMarkers() {
  if (!els.markerList) return;
  if (state.map.markers.length === 0) {
    els.markerList.innerHTML = `<p>표식이 없습니다.</p>`;
    return;
  }
  els.markerList.innerHTML = state.map.markers
    .map(
      (marker) => `
        <button type="button" data-marker-remove="${escapeHtml(marker.id)}">
          <span>${escapeHtml(marker.label || "표식")}</span>
          <small>${Math.round(marker.x)}, ${Math.round(marker.y)}</small>
        </button>
      `
    )
    .join("");
}

function renderAll() {
  if (els.title) els.title.value = state.space?.title || "";
  if (els.note) els.note.value = state.map.note || "";
  if (els.width) els.width.value = String(getCanvasWidth());
  if (els.height) els.height.value = String(getCanvasHeight());
  if (els.zoom) els.zoom.value = String(state.zoom);
  if (els.brushSize) els.brushSize.value = String(state.brushSize);
  renderPalette();
  renderMarkers();
  drawMap();
}

function setTool(tool) {
  state.tool = tool;
  els.toolButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mapTool === tool));
  });
}

function removeMarkersNearPoint(point, radius) {
  const before = state.map.markers.length;
  state.map.markers = state.map.markers.filter((marker) => distanceBetween(point, marker) > radius);
  if (before !== state.map.markers.length) renderMarkers();
}

function addMarker(point) {
  const label = window.prompt(state.tool === "label" ? "글자를 입력해주세요." : "표식 이름을 입력해주세요.", "");
  if (!label) return;
  state.map.markers.push({
    id: createId(),
    type: state.tool,
    x: point.x,
    y: point.y,
    label: label.slice(0, 40),
    color: state.tool === "label" ? state.tile.color : "#0284c7",
  });
  renderMarkers();
  drawMap();
}

function beginStroke(point) {
  const isEraser = state.tool === "erase";
  state.currentStroke = {
    id: createId(),
    tool: isEraser ? "erase" : "brush",
    color: state.tile.color,
    width: isEraser ? Math.max(8, state.brushSize * 2.2) : state.brushSize,
    points: [point],
  };
  state.map.strokes.push(state.currentStroke);
  if (isEraser) removeMarkersNearPoint(point, state.currentStroke.width);
  drawMap();
}

function appendStrokePoint(point) {
  if (!state.currentStroke) return;
  const points = state.currentStroke.points;
  const previous = points[points.length - 1];
  if (previous && distanceBetween(previous, point) < 1.2) return;
  points.push(point);
  if (state.currentStroke.tool === "erase") removeMarkersNearPoint(point, state.currentStroke.width);
  drawMap();
}

function handleCanvasAction(point) {
  if (!point) return;
  if (state.tool === "marker" || state.tool === "label") {
    addMarker(point);
    return;
  }
  beginStroke(point);
}

function resizeMap(width, height, { trim = true } = {}) {
  const nextWidth = clampNumber(width, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
  const nextHeight = clampNumber(height, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT);
  state.map.canvasWidth = nextWidth;
  state.map.canvasHeight = nextHeight;
  state.map.width = Math.ceil(nextWidth / state.map.tileSize);
  state.map.height = Math.ceil(nextHeight / state.map.tileSize);

  if (trim) {
    Object.keys(state.map.cells).forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      if (x * state.map.tileSize >= nextWidth || y * state.map.tileSize >= nextHeight) delete state.map.cells[key];
    });
    state.map.markers = state.map.markers.filter((marker) => marker.x <= nextWidth && marker.y <= nextHeight);
  }

  renderAll();
}

function applyResizeFromInputs() {
  const width = clampNumber(els.width?.value || getCanvasWidth(), MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
  const height = clampNumber(els.height?.value || getCanvasHeight(), MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT);
  const isShrinking = width < getCanvasWidth() || height < getCanvasHeight();
  if (isShrinking && !window.confirm("줄어든 영역 밖의 내용은 보이지 않습니다. 적용할까요?")) {
    renderAll();
    return;
  }
  resizeMap(width, height, { trim: true });
}

function growMap(direction = "both") {
  const addWidth = direction === "wide" || direction === "both" ? CANVAS_GROW_WIDTH : 0;
  const addHeight = direction === "tall" || direction === "both" ? CANVAS_GROW_HEIGHT : 0;
  resizeMap(getCanvasWidth() + addWidth, getCanvasHeight() + addHeight, { trim: false });
}

function fitMapToView() {
  if (!els.canvasWrap) return;
  const availableWidth = Math.max(240, els.canvasWrap.clientWidth - 48);
  const availableHeight = Math.max(180, els.canvasWrap.clientHeight - 48);
  const widthRatio = availableWidth / getCanvasWidth();
  const heightRatio = availableHeight / getCanvasHeight();
  const nextZoom = clampNumber(Math.min(widthRatio, heightRatio), 0.35, 2.5);
  state.zoom = Number(nextZoom.toFixed(2));
  if (els.zoom) els.zoom.value = String(state.zoom);
  drawMap();
}

function toggleWorkspace() {
  state.workspaceExpanded = !state.workspaceExpanded;
  document.body.classList.toggle("map-editor-expanded", state.workspaceExpanded);
  if (els.workspaceToggle) {
    els.workspaceToggle.setAttribute("aria-pressed", String(state.workspaceExpanded));
    els.workspaceToggle.textContent = state.workspaceExpanded ? "기본" : "넓게";
  }
  window.setTimeout(fitMapToView, 80);
}

async function loadSpace(session) {
  const rows = await requestRest(
    `blog_materials?select=id,title,content,material_type&user_id=eq.${encodeURIComponent(session.user.id)}&id=eq.${encodeURIComponent(state.spaceId)}&limit=1`,
    session.access_token
  );
  const space = Array.isArray(rows) ? rows[0] : null;
  if (!space || space.material_type !== "space") throw new Error("공간 정보를 찾지 못했습니다.");
  return space;
}

async function saveMap() {
  if (!state.spaceId || !state.session?.access_token) return;
  const title = els.title?.value.trim() || "이름 없는 공간";
  state.map.note = els.note?.value.trim() || "";
  state.map.canvasWidth = getCanvasWidth();
  state.map.canvasHeight = getCanvasHeight();
  state.map.width = Math.ceil(state.map.canvasWidth / state.map.tileSize);
  state.map.height = Math.ceil(state.map.canvasHeight / state.map.tileSize);
  setSaveState("저장 중...");
  await requestRest(
    `blog_materials?id=eq.${encodeURIComponent(state.spaceId)}&user_id=eq.${encodeURIComponent(state.session.user.id)}`,
    state.session.access_token,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        title,
        content: JSON.stringify(state.map),
        updated_at: new Date().toISOString(),
      }),
    }
  );
  state.space.title = title;
  setSaveState("저장됨", "success");
}

els.toolButtons.forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.mapTool || "brush"));
});

els.palette?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tile]");
  if (!button) return;
  const tile = PALETTE.find((item) => item.id === button.dataset.tile);
  if (!tile) return;
  state.tile = tile;
  renderPalette();
});

els.canvas?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  state.isDrawing = true;
  els.canvas.setPointerCapture?.(event.pointerId);
  handleCanvasAction(getPointFromEvent(event));
});

els.canvas?.addEventListener("pointermove", (event) => {
  event.preventDefault();
  if (!state.isDrawing || state.tool === "marker" || state.tool === "label") return;
  appendStrokePoint(getPointFromEvent(event));
});

els.canvas?.addEventListener("pointerleave", () => {
  state.isDrawing = false;
  state.currentStroke = null;
});

window.addEventListener("pointerup", () => {
  state.isDrawing = false;
  state.currentStroke = null;
});

els.markerList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-marker-remove]");
  if (!button) return;
  state.map.markers = state.map.markers.filter((marker) => marker.id !== button.dataset.markerRemove);
  renderMarkers();
  drawMap();
});

els.resize?.addEventListener("click", () => {
  applyResizeFromInputs();
});

els.growButtons.forEach((button) => {
  button.addEventListener("click", () => growMap(button.dataset.mapGrow || "both"));
});

els.brushSize?.addEventListener("input", () => {
  state.brushSize = clampNumber(els.brushSize.value, 1, 44);
  updateStatus();
});

els.zoom?.addEventListener("input", () => {
  state.zoom = Number(els.zoom.value || 1);
  drawMap();
});

els.fit?.addEventListener("click", fitMapToView);

els.workspaceToggle?.addEventListener("click", toggleWorkspace);

els.save?.addEventListener("click", async () => {
  try {
    await saveMap();
  } catch (error) {
    setSaveState(error.message || "저장 실패", "error");
  }
});

els.reset?.addEventListener("click", () => {
  if (!window.confirm("맵을 초기화할까요?")) return;
  state.map = structuredClone(DEFAULT_MAP);
  renderAll();
});

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
  setTool("brush");

  try {
    state.space = await loadSpace(session);
    state.map = parseMapContent(state.space.content || "");
    document.title = `${state.space.title || "맵 제작"} | 자료실`;
    renderAll();
    setSaveState("저장 준비");
  } catch (error) {
    window.alert(error.message || "공간을 불러오지 못했습니다.");
    window.location.href = "./materials.html#spaces";
  }
});
