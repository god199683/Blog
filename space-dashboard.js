const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const DEFAULT_SETTINGS = {
  infiniteGrowth: true,
  growthMode: "stage1",
  pollutionShield: true,
  selfCleaning: true,
  autoClassify: true,
  autoEnvironment: true,
  autoFeed: true,
};

const DEFAULT_MAP = {
  kind: "blog-map",
  version: 3,
  width: 32,
  height: 20,
  tileSize: 32,
  canvasWidth: 1024,
  canvasHeight: 640,
  background: "#fbfdff",
  cells: {},
  strokes: [],
  markers: [],
  zones: [],
  creatures: [],
  relations: { nodes: [], edges: [] },
  appearances: [],
  abilities: [],
  titles: [],
  creations: [],
  items: [],
  manaStones: [],
  byproducts: [],
  accessKeys: [],
  trash: [],
  settings: { ...DEFAULT_SETTINGS },
  note: "",
};

const CATALOG_CONFIGS = {
  byproducts: {
    title: "광물/보석",
    icon: "💎",
    statDescription: "광물과 보석 기록",
    addLabel: "광물/보석 추가",
    editTitle: "광물/보석 수정",
    newTitle: "새 광물/보석",
    listTitle: "광물/보석 목록",
    empty: "등록된 광물이나 보석이 없습니다.",
    defaultType: "광물",
    namePlaceholder: "광물 또는 보석 이름",
    typeLabel: "종류",
    typePlaceholder: "예: 광물, 보석, 결정",
    descriptionPlaceholder: "산출 위치나 특징",
  },
  appearances: {
    title: "색/모양무늬",
    icon: "🎨",
    statDescription: "색과 형태 기록",
    addLabel: "색/모양무늬 추가",
    editTitle: "색/모양무늬 수정",
    newTitle: "새 색/모양무늬",
    listTitle: "색/모양무늬 목록",
    empty: "등록된 색/모양무늬가 없습니다.",
    defaultType: "색",
    namePlaceholder: "색 또는 무늬 이름",
    typeLabel: "구분",
    typePlaceholder: "예: 색, 모양, 무늬",
    descriptionPlaceholder: "외형 설명",
  },
  abilities: {
    title: "능력",
    icon: "✨",
    statDescription: "능력과 효과 기록",
    addLabel: "능력 추가",
    editTitle: "능력 수정",
    newTitle: "새 능력",
    listTitle: "능력 목록",
    empty: "등록된 능력이 없습니다.",
    defaultType: "능력",
    namePlaceholder: "능력 이름",
    typeLabel: "능력 유형",
    typePlaceholder: "예: 전투, 회복, 보조",
    descriptionPlaceholder: "효과와 조건",
  },
  titles: {
    title: "칭호",
    icon: "🏷️",
    statDescription: "칭호와 조건 기록",
    addLabel: "칭호 추가",
    editTitle: "칭호 수정",
    newTitle: "새 칭호",
    listTitle: "칭호 목록",
    empty: "등록된 칭호가 없습니다.",
    defaultType: "칭호",
    namePlaceholder: "칭호 이름",
    typeLabel: "칭호 유형",
    typePlaceholder: "예: 명예, 업적, 직책",
    descriptionPlaceholder: "획득 조건이나 의미",
  },
  creations: {
    title: "제작품/창조품",
    icon: "🛠️",
    statDescription: "제작품과 창조품 기록",
    addLabel: "제작품/창조품 추가",
    editTitle: "제작품/창조품 수정",
    newTitle: "새 제작품/창조품",
    listTitle: "제작품/창조품 목록",
    empty: "등록된 제작품이나 창조품이 없습니다.",
    defaultType: "제작품",
    namePlaceholder: "제작품 또는 창조품 이름",
    typeLabel: "종류",
    typePlaceholder: "예: 제작품, 창조품, 장치",
    descriptionPlaceholder: "제작 방식이나 용도",
  },
  items: {
    title: "물품",
    icon: "📦",
    statDescription: "보관 물품 기록",
    addLabel: "물품 추가",
    editTitle: "물품 수정",
    newTitle: "새 물품",
    listTitle: "물품 목록",
    empty: "등록된 물품이 없습니다.",
    defaultType: "물품",
    namePlaceholder: "물품 이름",
    typeLabel: "물품 종류",
    typePlaceholder: "예: 도구, 소모품, 장비",
    descriptionPlaceholder: "보관 위치나 용도",
  },
  manaStones: {
    title: "마나석",
    icon: "🔷",
    statDescription: "마나석과 속성 기록",
    addLabel: "마나석 추가",
    editTitle: "마나석 수정",
    newTitle: "새 마나석",
    listTitle: "마나석 목록",
    empty: "등록된 마나석이 없습니다.",
    defaultType: "마나석",
    namePlaceholder: "마나석 이름",
    typeLabel: "속성",
    typePlaceholder: "예: 화염, 물, 순수",
    descriptionPlaceholder: "마나 성질이나 사용처",
  },
};

const CATALOG_COLLECTIONS = Object.keys(CATALOG_CONFIGS);
const PAGES = new Set(["dashboard", "map", "zones", "creatures", "relations", ...CATALOG_COLLECTIONS, "settings", "access", "trash"]);

const ZONE_TYPES = [
  { value: "default", label: "기본", icon: "🌳" },
  { value: "sacred", label: "신성림", icon: "✨" },
  { value: "water", label: "수생", icon: "💧" },
  { value: "garden", label: "정원", icon: "🌸" },
  { value: "farm", label: "농경", icon: "🌾" },
  { value: "magic", label: "마법숲", icon: "🍄" },
  { value: "desert", label: "사막", icon: "🔥" },
  { value: "cave", label: "동굴", icon: "🪨" },
  { value: "snow", label: "설원", icon: "❄️" },
];

const ZONE_ICONS = ["🌳", "💧", "🏡", "🌿", "🦊", "🌸", "🍄", "🔥", "❄️", "🌙", "⚡", "🪨"];

const CREATURE_TYPES = [
  { value: "plant", label: "식물", icon: "🌱" },
  { value: "animal", label: "동물", icon: "🦊" },
  { value: "spirit", label: "영체", icon: "✨" },
  { value: "other", label: "기타", icon: "•" },
];

const GROWTH_STAGES = [
  { value: "seed", label: "씨앗" },
  { value: "sprout", label: "새싹" },
  { value: "growing", label: "성장 중" },
  { value: "mature", label: "성숙" },
  { value: "ex", label: "Ex급" },
];

const GROWTH_MODES = [
  { value: "off", label: "OFF", icon: "⏸️", description: "성장을 멈춥니다." },
  { value: "stage1", label: "1단계", icon: "⏩", description: "2배속으로 성장합니다." },
  { value: "stage2", label: "2단계", icon: "⚡", description: "즉시 성장합니다." },
];

const BYPRODUCT_TYPES = [
  { value: "mineral", label: "광물", icon: "⛰️" },
  { value: "gem", label: "보석", icon: "💎" },
  { value: "crystal", label: "결정", icon: "🔷" },
  { value: "magic-stone", label: "마력석", icon: "🪨" },
  { value: "other", label: "기타", icon: "•" },
];

const LEGACY_BYPRODUCT_TYPES = {
  byproduct: "광물",
  collectible: "보석",
  material: "광물",
  seed: "결정",
  부산물: "광물",
  채집품: "보석",
  재료: "광물",
  씨앗: "결정",
};

const ACCESS_ROLES = [
  { value: "owner", label: "소유주" },
  { value: "family", label: "가족" },
  { value: "friend", label: "동료/친구" },
  { value: "guest", label: "손님" },
];

const ACCESS_ROLE_ALIASES = {
  partner: "friend",
  manager: "friend",
  pet: "family",
};

const DEFAULT_ACCESS_PERMISSION_YEARS = 1;

const ACCESS_ROLE_YEAR_MULTIPLIER = {
  owner: null,
  family: null,
  friend: 1,
  guest: 0.5,
};

const DASHBOARD_COLLECTION_LABELS = {
  zones: "구역",
  creatures: "동식물",
  relationNodes: "관계도 노드",
  relationEdges: "관계도 엣지",
  byproducts: "광물/보석",
  appearances: "색/모양무늬",
  abilities: "능력",
  titles: "칭호",
  creations: "제작품/창조품",
  items: "물품",
  manaStones: "마나석",
  accessKeys: "출입 권한",
};

const DASHBOARD_TRASH_COLLECTIONS = Object.keys(DASHBOARD_COLLECTION_LABELS);

const state = {
  session: null,
  id: "",
  spaceId: new URLSearchParams(window.location.search).get("space") || "",
  space: null,
  map: structuredClone(DEFAULT_MAP),
  activePage: readActivePageFromHash(),
  editType: "",
  editId: "",
  selectedZoneId: "",
  selectedCreatureId: "",
  mapZoom: 1,
  creatureTypeFilter: "all",
  sidebarCollapsed: localStorage.getItem("spaceDashboardSidebar") === "collapsed",
};

const dashboardImageCache = new Map();

const els = {
  view: document.querySelector("[data-space-view]"),
  brandTitle: document.querySelector("[data-space-brand-title]"),
  initials: document.querySelectorAll("[data-space-brand-initial]"),
  navLinks: document.querySelectorAll("[data-space-page-link]"),
  sidebarToggle: document.querySelector("[data-space-sidebar-toggle]"),
};

function readActivePageFromHash() {
  const page = window.location.hash.replace("#", "") || "dashboard";
  return PAGES.has(page) ? page : "dashboard";
}

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

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function createId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (value === 1) return true;
  if (value === 0) return false;
  return fallback;
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

function normalizeAccessRole(role = "guest") {
  const value = ACCESS_ROLE_ALIASES[role] || role;
  return ACCESS_ROLES.some((item) => item.value === value) ? value : "guest";
}

function getAccessRole(role = "guest") {
  const value = normalizeAccessRole(role);
  return ACCESS_ROLES.find((item) => item.value === value) || ACCESS_ROLES[ACCESS_ROLES.length - 1];
}

function normalizePermissionYears(value = DEFAULT_ACCESS_PERMISSION_YEARS) {
  const years = Number.parseFloat(value);
  if (!Number.isFinite(years)) return DEFAULT_ACCESS_PERMISSION_YEARS;
  return Math.min(20, Math.max(0.25, years));
}

function createAccessExpiry(role = "guest", baseDate = new Date().toISOString(), years = DEFAULT_ACCESS_PERMISSION_YEARS) {
  const multiplier = ACCESS_ROLE_YEAR_MULTIPLIER[normalizeAccessRole(role)];
  if (!multiplier) return "";
  const date = new Date(baseDate);
  if (Number.isNaN(date.getTime())) date.setTime(Date.now());
  const months = Math.max(1, Math.round(normalizePermissionYears(years) * multiplier * 12));
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function formatAccessPeriod(itemOrRole = "guest", years = DEFAULT_ACCESS_PERMISSION_YEARS) {
  const role = typeof itemOrRole === "string" ? normalizeAccessRole(itemOrRole) : normalizeAccessRole(itemOrRole.role);
  if (!ACCESS_ROLE_YEAR_MULTIPLIER[role]) return "영구";
  const permissionYears =
    typeof itemOrRole === "string"
      ? normalizePermissionYears(years)
      : normalizePermissionYears(itemOrRole.permissionYears ?? itemOrRole.permission_years ?? years);
  const expiresAt =
    typeof itemOrRole === "string"
      ? createAccessExpiry(role, new Date().toISOString(), permissionYears)
      : itemOrRole.expiresAt || createAccessExpiry(role, itemOrRole.createdAt, permissionYears);
  return `${formatDate(expiresAt)}까지`;
}

function getSpaceTitle() {
  return state.space?.title || "Ciel's Garden";
}

function getCanvasWidth(map = state.map) {
  return clampNumber(map.canvasWidth || map.width * map.tileSize, 320, 6000);
}

function getCanvasHeight(map = state.map) {
  return clampNumber(map.canvasHeight || map.height * map.tileSize, 240, 4200);
}

function normalizePoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
  };
}

function normalizeSettings(settings = {}) {
  return {
    infiniteGrowth: toBool(settings.infiniteGrowth ?? settings.infinite_growth, DEFAULT_SETTINGS.infiniteGrowth),
    growthMode: ["off", "stage1", "stage2"].includes(settings.growthMode || settings.growth_mode)
      ? settings.growthMode || settings.growth_mode
      : DEFAULT_SETTINGS.growthMode,
    pollutionShield: toBool(settings.pollutionShield ?? settings.pollution_shield, DEFAULT_SETTINGS.pollutionShield),
    selfCleaning: toBool(settings.selfCleaning ?? settings.self_cleaning, DEFAULT_SETTINGS.selfCleaning),
    autoClassify: toBool(settings.autoClassify ?? settings.auto_classify, DEFAULT_SETTINGS.autoClassify),
    autoEnvironment: toBool(settings.autoEnvironment ?? settings.auto_environment, DEFAULT_SETTINGS.autoEnvironment),
    autoFeed: toBool(settings.autoFeed ?? settings.auto_feed, DEFAULT_SETTINGS.autoFeed),
  };
}

function getZoneType(type = "default") {
  return ZONE_TYPES.find((item) => item.value === type) || ZONE_TYPES[0];
}

function getCreatureType(type = "other") {
  const known = CREATURE_TYPES.find((item) => item.value === type || item.label === type);
  return known || { value: String(type || "other"), label: String(type || "기타"), icon: "•" };
}

function getGrowthStage(stage = "seed") {
  return GROWTH_STAGES.find((item) => item.value === stage) || GROWTH_STAGES[0];
}

function isPlantCreature(creature = {}) {
  const type = String(creature.type || "").trim().toLowerCase();
  return type === "plant" || type === "식물";
}

function getCreatureTypeOptions() {
  const values = [...new Set(state.map.creatures.map((item) => String(item.type || "").trim()).filter(Boolean))];
  return values.map((value) => ({ value, label: getCreatureType(value).label }));
}

function getByproductType(type = "byproduct") {
  const normalized = LEGACY_BYPRODUCT_TYPES[type] || type || "광물";
  const known = BYPRODUCT_TYPES.find((item) => item.value === normalized || item.value === type || item.label === normalized || item.label === type);
  return known || { value: String(normalized || "기타"), label: String(normalized || "기타"), icon: "•" };
}

function getCatalogConfig(collection = "byproducts") {
  return CATALOG_CONFIGS[collection] || CATALOG_CONFIGS.byproducts;
}

function getCatalogType(collection = "byproducts", type = "") {
  if (collection === "byproducts") return getByproductType(type || getCatalogConfig(collection).defaultType);
  const config = getCatalogConfig(collection);
  const label = String(type || config.defaultType || "항목").slice(0, 60);
  return { value: label, label, icon: config.icon || "•" };
}

function normalizeZone(zone = {}) {
  const ecosystem = ZONE_TYPES.some((item) => item.value === zone.ecosystem) ? zone.ecosystem : "default";
  return {
    id: zone.id || createId(),
    name: String(zone.name || "새 구역").slice(0, 60),
    ecosystem,
    climate: String(zone.climate || "온화").slice(0, 60),
    icon: zone.icon || getZoneType(ecosystem).icon,
    color: /^#[0-9a-f]{6}$/i.test(zone.color || "") ? zone.color : "#4aa8d8",
    description: String(zone.description || "").slice(0, 700),
    autoFeed: toBool(zone.autoFeed ?? zone.auto_feed, true),
    autoEnvironment: toBool(zone.autoEnvironment ?? zone.auto_environment, true),
    createdAt: zone.createdAt || zone.created_at || new Date().toISOString(),
  };
}

function normalizeCreature(creature = {}) {
  const knownType = getCreatureType(creature.type || creature.type_label || "식물");
  return {
    id: creature.id || createId(),
    name: String(creature.name || "이름 없는 개체").slice(0, 80),
    type: String(knownType.label || knownType.value || "식물").slice(0, 60),
    zoneId: creature.zoneId || creature.zone_id || "",
    description: String(creature.description || "").slice(0, 700),
    createdAt: creature.createdAt || creature.created_at || new Date().toISOString(),
  };
}

function normalizeByproduct(item = {}) {
  const knownType = getByproductType(item.type || item.type_label || "광물");
  return {
    id: item.id || createId(),
    name: String(item.name || "이름 없는 항목").slice(0, 80),
    type: String(knownType.label || knownType.value || "광물").slice(0, 60),
    zoneId: item.zoneId || item.zone_id || "",
    description: String(item.description || "").slice(0, 700),
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
}

function normalizeCatalogItem(collection, item = {}) {
  if (collection === "byproducts") return normalizeByproduct(item);
  const config = getCatalogConfig(collection);
  return {
    id: item.id || createId(),
    name: String(item.name || "이름 없는 항목").slice(0, 80),
    type: String(item.type || item.type_label || config.defaultType || "항목").slice(0, 60),
    zoneId: item.zoneId || item.zone_id || "",
    description: String(item.description || "").slice(0, 700),
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
}

function normalizeRelationNode(item = {}) {
  return {
    id: item.id || createId(),
    name: String(item.name || item.label || "이름 없는 노드").slice(0, 80),
    type: String(item.type || "관계 대상").slice(0, 60),
    color: /^#[0-9a-f]{6}$/i.test(item.color || "") ? item.color : "#4aa8d8",
    description: String(item.description || "").slice(0, 700),
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
}

function normalizeRelationEdge(item = {}) {
  return {
    id: item.id || createId(),
    sourceId: item.sourceId || item.source_id || "",
    targetId: item.targetId || item.target_id || "",
    label: String(item.label || item.name || "관계").slice(0, 80),
    description: String(item.description || "").slice(0, 700),
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  };
}

function normalizeRelations(relations = {}) {
  if (Array.isArray(relations)) {
    return {
      nodes: relations.map((item) => normalizeRelationNode(item)),
      edges: [],
    };
  }

  const nodes = Array.isArray(relations?.nodes) ? relations.nodes.map(normalizeRelationNode) : [];
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(relations?.edges)
    ? relations.edges
        .map(normalizeRelationEdge)
        .filter((edge) => !edge.sourceId || !edge.targetId || (validNodeIds.has(edge.sourceId) && validNodeIds.has(edge.targetId)))
    : [];

  return { nodes, edges };
}

function normalizeAccessKey(item = {}) {
  const role = normalizeAccessRole(item.role);
  const createdAt = item.createdAt || item.created_at || new Date().toISOString();
  const permissionYears = normalizePermissionYears(item.permissionYears ?? item.permission_years ?? DEFAULT_ACCESS_PERMISSION_YEARS);
  return {
    id: item.id || createId(),
    name: String(item.name || "출입자").slice(0, 80),
    role,
    permissionYears,
    expiresAt:
      item.expiresAt || item.expires_at || item.permissionExpiresAt || item.permission_expires_at || createAccessExpiry(role, createdAt, permissionYears),
    active: toBool(item.active, true),
    createdAt,
  };
}

function normalizeDashboardItem(collection, item = {}) {
  if (collection === "zones") return normalizeZone(item);
  if (collection === "creatures") return normalizeCreature(item);
  if (collection === "relationNodes") return normalizeRelationNode(item);
  if (collection === "relationEdges") return normalizeRelationEdge(item);
  if (CATALOG_COLLECTIONS.includes(collection)) return normalizeCatalogItem(collection, item);
  if (collection === "accessKeys") return normalizeAccessKey(item);
  return { ...item, id: item.id || createId(), name: String(item.name || "항목").slice(0, 80) };
}

function getDashboardItemTitle(collection, item = {}) {
  if (collection === "zones") return item.name || "이름 없는 구역";
  if (collection === "creatures") return item.name || "이름 없는 동식물";
  if (collection === "relationNodes") return item.name || "이름 없는 노드";
  if (collection === "relationEdges") return item.label || "관계";
  if (CATALOG_COLLECTIONS.includes(collection)) return item.name || "이름 없는 항목";
  if (collection === "accessKeys") return item.name || "출입자";
  return item.name || "항목";
}

function normalizeDashboardTrashEntry(entry = {}) {
  const collection = DASHBOARD_TRASH_COLLECTIONS.includes(entry.collection) ? entry.collection : "byproducts";
  const item = normalizeDashboardItem(collection, entry.item || entry.snapshot || {});
  return {
    id: entry.id || createId(),
    collection,
    item,
    deletedAt: entry.deletedAt || entry.deleted_at || new Date().toISOString(),
  };
}

function normalizeCatalogCollections(map = {}) {
  return Object.fromEntries(
    CATALOG_COLLECTIONS.map((collection) => [
      collection,
      Array.isArray(map[collection]) ? map[collection].map((item) => normalizeCatalogItem(collection, item)) : [],
    ])
  );
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
    kind: "blog-map",
    version: 3,
    tileSize,
    canvasWidth: clampNumber(canvasWidth, 320, 6000),
    canvasHeight: clampNumber(canvasHeight, 240, 4200),
    width: Math.ceil(clampNumber(canvasWidth, 320, 6000) / tileSize),
    height: Math.ceil(clampNumber(canvasHeight, 240, 4200) / tileSize),
    background: map.background || DEFAULT_MAP.background,
    cells,
    strokes,
    markers,
    zones: Array.isArray(map.zones) ? map.zones.map(normalizeZone) : [],
    creatures: Array.isArray(map.creatures) ? map.creatures.map(normalizeCreature) : [],
    relations: normalizeRelations(map.relations),
    ...normalizeCatalogCollections(map),
    accessKeys: Array.isArray(map.accessKeys || map.access_keys)
      ? (map.accessKeys || map.access_keys).map(normalizeAccessKey)
      : [],
    trash: Array.isArray(map.trash || map.dashboardTrash || map.dashboard_trash)
      ? (map.trash || map.dashboardTrash || map.dashboard_trash).map(normalizeDashboardTrashEntry)
      : [],
    settings: normalizeSettings(map.settings || {}),
    note: String(map.note || ""),
  };
}

function parseMapContent(content = "") {
  try {
    const parsed = JSON.parse(content || "");
    if (parsed?.kind === "blog-map") return cloneMap(parsed);
  } catch {}
  return cloneMap({
    ...DEFAULT_MAP,
    note: String(content || ""),
  });
}

function getZoneName(zoneId = "") {
  if (!zoneId) return "전체 정원";
  return state.map.zones.find((zone) => zone.id === zoneId)?.name || "알 수 없는 구역";
}

function getZonePath(zoneId = "") {
  const zone = state.map.zones.find((item) => item.id === zoneId);
  if (!zone) return "전체 정원";
  return `${zone.icon} ${zone.name}`;
}

function getZoneCounts(zoneId = "") {
  const creatures = state.map.creatures.filter((item) => item.zoneId === zoneId);
  return {
    plants: creatures.filter(isPlantCreature).length,
    creatures: creatures.filter((item) => !isPlantCreature(item)).length,
    total: creatures.length,
    byproducts: state.map.byproducts.filter((item) => item.zoneId === zoneId).length,
  };
}

function renderOptions(items, selectedValue = "") {
  return items
    .map((item) => {
      const value = typeof item === "string" ? item : item.value;
      const label = typeof item === "string" ? item : item.label;
      return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderZoneOptions(selectedValue = "", includeEmpty = true) {
  const empty = includeEmpty ? `<option value="" ${selectedValue ? "" : "selected"}>전체 정원</option>` : "";
  return `${empty}${state.map.zones
    .map((zone) => `<option value="${escapeHtml(zone.id)}" ${zone.id === selectedValue ? "selected" : ""}>${escapeHtml(zone.name)}</option>`)
    .join("")}`;
}

function syncChrome() {
  const title = getSpaceTitle();
  document.body.classList.toggle("is-garden-sidebar-collapsed", state.sidebarCollapsed);
  if (els.brandTitle) els.brandTitle.textContent = title;
  els.initials.forEach((initial) => {
    initial.textContent = (title || state.id || "B").slice(0, 1).toUpperCase();
  });
  if (els.sidebarToggle) {
    els.sidebarToggle.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
    els.sidebarToggle.setAttribute("aria-label", state.sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기");
    els.sidebarToggle.title = state.sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기";
  }
  document.title = `${title} | 공간 관리`;
  els.navLinks.forEach((link) => {
    const active = link.dataset.spacePageLink === state.activePage;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function getPageIntro() {
  const title = getSpaceTitle();
  const updated = formatDate(state.space?.updated_at || state.space?.created_at);
  const copy = {
    dashboard: ["대시보드", `${title}의 정원 현황을 한눈에 확인합니다.`],
    map: ["정원 맵", "정원 맵을 미리 보고 구역 흐름을 관리합니다."],
    zones: ["구역 관리", "정원 내부 구역과 생태계 정보를 관리합니다."],
    creatures: ["동식물 관리", "정원 안의 식물, 동물, 영체를 기록합니다."],
    byproducts: ["광물/보석", "구역에서 얻은 광물과 보석을 정리합니다."],
    relations: ["관계도", "인물, 생물, 구역 사이의 관계 흐름을 기록합니다."],
    appearances: ["색/모양무늬", "색상과 형태, 무늬 정보를 정리합니다."],
    abilities: ["능력", "능력의 유형과 효과를 정리합니다."],
    titles: ["칭호", "칭호와 획득 조건을 관리합니다."],
    creations: ["제작품/창조품", "제작품과 창조품의 용도와 특징을 기록합니다."],
    items: ["물품", "보관 중인 물품과 사용처를 정리합니다."],
    manaStones: ["마나석", "마나석의 속성과 사용처를 관리합니다."],
    settings: ["시스템 설정", "정원의 성장, 보호, 자동화 설정을 조정합니다."],
    access: ["출입 관리", "정원에 들어올 수 있는 대상과 권한 기간을 관리합니다."],
    trash: ["휴지통", "삭제한 대시보드 항목을 복원하거나 완전히 비웁니다."],
  }[state.activePage] || ["대시보드", ""];

  return `
    <header class="garden-page-heading">
      <p class="garden-kicker">${escapeHtml(title)}</p>
      <div>
        <h1>${escapeHtml(copy[0])}</h1>
        <p>${escapeHtml(copy[1])}</p>
      </div>
      <small>마지막 수정 ${escapeHtml(updated)}</small>
    </header>
  `;
}

function renderCard(title, body, actions = "") {
  return `
    <section class="garden-card">
      <div class="garden-card-head">
        <h2>${title}</h2>
        ${actions}
      </div>
      ${body}
    </section>
  `;
}

function renderStatCard(icon, label, value, description = "", page = "") {
  const action = page
    ? `data-action="go-page" data-page="${escapeHtml(page)}" role="button" tabindex="0" aria-label="${escapeHtml(label)} 관리로 이동"`
    : "";
  return `
    <article class="garden-stat-card ${page ? "is-clickable" : ""}" ${action}>
      <span>${icon} ${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function getStatusRows() {
  const settings = state.map.settings;
  const growthMode = GROWTH_MODES.find((item) => item.value === settings.growthMode) || GROWTH_MODES[1];
  return [
    ["성장 모드", `${growthMode.label} - ${growthMode.description}`],
    ["오염 방지", settings.pollutionShield ? "활성" : "비활성"],
    ["자가 세척", settings.selfCleaning ? "활성" : "비활성"],
    ["출입 권한", `${state.map.accessKeys.length}개`],
    ["동식물", `${state.map.creatures.length}개`],
    ["광물/보석", `${state.map.byproducts.length}개`],
    ["관계도", `${state.map.relations.nodes.length}개 노드 / ${state.map.relations.edges.length}개 엣지`],
    ["휴지통", `${state.map.trash.length}개`],
  ];
}

function renderDashboard() {
  const zones = state.map.zones;
  const creatures = state.map.creatures;
  const plants = creatures.filter(isPlantCreature).length;
  const living = creatures.filter((item) => !isPlantCreature(item)).length;
  const accessKeys = state.map.accessKeys;
  const catalogCards = CATALOG_COLLECTIONS.map((collection) => {
    const config = getCatalogConfig(collection);
    return renderStatCard(config.icon, config.title, String(state.map[collection]?.length || 0), config.statDescription, collection);
  }).join("");

  return `
    ${getPageIntro()}
    <section class="garden-stats">
      ${renderStatCard("🗺️", "구역", String(zones.length), "정원에 등록된 구역", "zones")}
      ${renderStatCard("🌱", "식물", String(plants), "식물형 개체", "creatures")}
      ${renderStatCard("🦊", "생물", String(living), "동물과 영체", "creatures")}
      ${renderStatCard("🔗", "관계도", `${state.map.relations.nodes.length}/${state.map.relations.edges.length}`, "노드와 엣지", "relations")}
      ${catalogCards}
      ${renderStatCard("🔑", "출입", String(accessKeys.length), "출입 권한", "access")}
    </section>

    <section class="garden-dashboard-layout">
      ${renderCard(
        "시스템 상태",
        `<div class="garden-status-list">
          ${getStatusRows()
            .map(
              ([label, value]) => `
                <div>
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                </div>
              `
            )
            .join("")}
        </div>`
      )}

      ${renderCard(
        "구역 현황",
        zones.length
          ? `<div class="garden-zone-list">
              ${zones
                .map((zone) => {
                  const counts = getZoneCounts(zone.id);
                  return `
                    <button class="garden-zone-row" type="button" data-action="go-zone" data-id="${escapeHtml(zone.id)}">
                      <i style="--zone-color:${escapeHtml(zone.color)}">${zone.icon}</i>
                      <span>
                        <strong>${escapeHtml(zone.name)}</strong>
                        <small>${escapeHtml(getZoneType(zone.ecosystem).label)} · ${escapeHtml(zone.climate)}</small>
                      </span>
                      <b>${counts.plants} / ${counts.creatures}</b>
                    </button>
                  `;
                })
                .join("")}
            </div>`
          : `<p class="garden-empty">등록된 구역이 없습니다. 구역 관리에서 첫 구역을 만들어주세요.</p>`
      )}
    </section>

    ${renderCard(
      "출입 관리",
      accessKeys.length
        ? `<div class="garden-table">
            <div class="garden-table-head garden-access-row">
              <span>이름</span><span>역할</span><span>권한 기간</span><span>상태</span><span>관리</span>
            </div>
            ${accessKeys
              .slice(0, 6)
              .map((item) => {
                return `
                  <div class="garden-table-row garden-access-row">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(getAccessRole(item.role).label)}</span>
                    <span>${escapeHtml(formatAccessPeriod(item))}</span>
                    <span>${item.active ? "활성" : "비활성"}</span>
                    <span class="garden-inline-actions">
                      <button type="button" data-action="go-page" data-page="access">열기</button>
                    </span>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : `<p class="garden-empty">등록된 출입 권한이 없습니다. 출입 관리에서 권한을 추가해주세요.</p>`,
      `<button class="garden-button" type="button" data-action="go-page" data-page="access">출입 관리</button>`
    )}
  `;
}

function drawLegacyCells(ctx, scale) {
  const tile = (state.map.tileSize || DEFAULT_MAP.tileSize) * scale;
  Object.entries(state.map.cells || {}).forEach(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = cell.color || "#dff4ff";
    ctx.fillRect(x * tile, y * tile, tile, tile);
  });
}

function drawStroke(ctx, stroke, scale) {
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

function drawMarker(ctx, marker, scale) {
  const x = (Number(marker.x) || 0) * scale;
  const y = (Number(marker.y) || 0) * scale;
  const label = marker.label || "표식";
  ctx.save();
  ctx.font = `700 ${Math.max(10, 14 * scale)}px sans-serif`;
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

function getDashboardShapeBounds(shape = {}, scale = 1) {
  const x = (Number(shape.x) || 0) * scale;
  const y = (Number(shape.y) || 0) * scale;
  const width = (Number(shape.width) || 0) * scale;
  const height = (Number(shape.height) || 0) * scale;
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  return {
    left,
    top,
    width: Math.abs(width),
    height: Math.abs(height),
    right: left + Math.abs(width),
    bottom: top + Math.abs(height),
  };
}

function getDashboardImage(src, onload) {
  if (!src) return null;
  if (dashboardImageCache.has(src)) return dashboardImageCache.get(src);
  const image = new Image();
  image.onload = onload;
  image.src = src;
  dashboardImageCache.set(src, image);
  return image;
}

function drawDashboardPolygon(ctx, points = []) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

function drawDashboardShapePath(ctx, shape, bounds, scale) {
  const { left, top, width, height, right, bottom } = bounds;
  const cx = left + width / 2;
  const cy = top + height / 2;
  ctx.beginPath();
  if (shape.type === "line") {
    ctx.moveTo((Number(shape.x) || 0) * scale, (Number(shape.y) || 0) * scale);
    ctx.lineTo(((Number(shape.x) || 0) + (Number(shape.width) || 0)) * scale, ((Number(shape.y) || 0) + (Number(shape.height) || 0)) * scale);
    return;
  }
  if (shape.type === "curve") {
    ctx.moveTo(left, bottom);
    ctx.quadraticCurveTo(cx, top - Math.max(16, height * 0.28), right, bottom);
    return;
  }
  if (shape.type === "ellipse") {
    ctx.ellipse(cx, cy, Math.max(1, width / 2), Math.max(1, height / 2), 0, 0, Math.PI * 2);
    return;
  }
  if (shape.type === "triangle") {
    drawDashboardPolygon(ctx, [{ x: cx, y: top }, { x: right, y: bottom }, { x: left, y: bottom }]);
    return;
  }
  if (shape.type === "right-triangle") {
    drawDashboardPolygon(ctx, [{ x: left, y: top }, { x: right, y: bottom }, { x: left, y: bottom }]);
    return;
  }
  if (shape.type === "diamond") {
    drawDashboardPolygon(ctx, [{ x: cx, y: top }, { x: right, y: cy }, { x: cx, y: bottom }, { x: left, y: cy }]);
    return;
  }
  if (shape.type?.startsWith("arrow-")) {
    drawDashboardPolygon(ctx, [
      { x: left, y: top + height * 0.25 },
      { x: right - width * 0.35, y: top + height * 0.25 },
      { x: right - width * 0.35, y: top },
      { x: right, y: cy },
      { x: right - width * 0.35, y: bottom },
      { x: right - width * 0.35, y: top + height * 0.75 },
      { x: left, y: top + height * 0.75 },
    ]);
    return;
  }
  if (shape.type === "star" || shape.type === "burst") {
    const count = shape.type === "star" ? 5 : 8;
    const outer = Math.min(width, height) / 2;
    const inner = outer * 0.45;
    drawDashboardPolygon(
      ctx,
      Array.from({ length: count * 2 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / count;
        const radius = index % 2 === 0 ? outer : inner;
        return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
      })
    );
    return;
  }
  if (shape.type === "roundrect" || shape.type === "speech") {
    drawRoundedRect(ctx, left, top, width, shape.type === "speech" ? height * 0.78 : height, Math.min(18, width / 5, height / 5));
    return;
  }
  ctx.rect(left, top, width, height);
}

function drawDashboardShape(ctx, shape, scale, canvas) {
  const bounds = getDashboardShapeBounds(shape, scale);
  if (bounds.width < 1 || bounds.height < 1) return;
  if (shape.type === "image") {
    const image = getDashboardImage(shape.src, () => drawPreview(canvas));
    if (image?.complete && image.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = Number(shape.opacity) || 1;
      ctx.drawImage(image, bounds.left, bounds.top, bounds.width, bounds.height);
      ctx.restore();
    }
    return;
  }
  ctx.save();
  ctx.globalAlpha = Number(shape.opacity) || 1;
  ctx.strokeStyle = shape.color || "#1f3b57";
  ctx.fillStyle = shape.fillColor || "transparent";
  ctx.lineWidth = Math.max(1, (Number(shape.lineWidth) || 3) * scale);
  if (shape.lineStyle === "dash") ctx.setLineDash([8 * scale, 6 * scale]);
  drawDashboardShapePath(ctx, shape, bounds, scale);
  if (shape.filled && shape.fillColor && shape.fillColor !== "transparent" && shape.type !== "line" && shape.type !== "curve") ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRect(ctx, left, top, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(left + safeRadius, top);
  ctx.lineTo(left + width - safeRadius, top);
  ctx.quadraticCurveTo(left + width, top, left + width, top + safeRadius);
  ctx.lineTo(left + width, top + height - safeRadius);
  ctx.quadraticCurveTo(left + width, top + height, left + width - safeRadius, top + height);
  ctx.lineTo(left + safeRadius, top + height);
  ctx.quadraticCurveTo(left, top + height, left, top + height - safeRadius);
  ctx.lineTo(left, top + safeRadius);
  ctx.quadraticCurveTo(left, top, left + safeRadius, top);
  ctx.closePath();
}

function drawZoneBadges(ctx, scale) {
  if (state.map.zones.length === 0) return;
  const width = getCanvasWidth() * scale;
  const height = getCanvasHeight() * scale;
  const radiusX = width * 0.32;
  const radiusY = height * 0.26;
  const centerX = width / 2;
  const centerY = height / 2;

  state.map.zones.forEach((zone, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(state.map.zones.length, 1) - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radiusX;
    const y = centerY + Math.sin(angle) * radiusY;
    const label = `${zone.icon} ${zone.name}`;
    ctx.save();
    ctx.font = "700 13px sans-serif";
    const textWidth = ctx.measureText(label).width;
    const boxWidth = Math.min(Math.max(textWidth + 24, 86), 180);
    const boxHeight = 34;
    const left = Math.max(12, Math.min(width - boxWidth - 12, x - boxWidth / 2));
    const top = Math.max(12, Math.min(height - boxHeight - 12, y - boxHeight / 2));
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.strokeStyle = zone.color || "#4aa8d8";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, left, top, boxWidth, boxHeight, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1e3a5f";
    ctx.textBaseline = "middle";
    ctx.fillText(label.slice(0, 18), left + 12, top + boxHeight / 2);
    ctx.restore();
  });
}

function drawPreview(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const holder = canvas.closest(".garden-map-preview");
  const holderWidth = holder?.clientWidth ? holder.clientWidth - 34 : 960;
  const maxWidth = Math.max(320, holderWidth);
  const maxHeight = state.activePage === "map" ? 620 : 420;
  const baseScale = Math.min(maxWidth / getCanvasWidth(), maxHeight / getCanvasHeight(), 1);
  const scale = baseScale * state.mapZoom;
  const width = Math.max(1, Math.round(getCanvasWidth() * scale));
  const height = Math.max(1, Math.round(getCanvasHeight() * scale));
  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = state.map.background || DEFAULT_MAP.background;
  ctx.fillRect(0, 0, width, height);
  drawLegacyCells(ctx, scale);
  (state.map.shapes || []).forEach((shape) => drawDashboardShape(ctx, shape, scale, canvas));
  state.map.strokes.forEach((stroke) => drawStroke(ctx, stroke, scale));
  state.map.markers.forEach((marker) => drawMarker(ctx, marker, scale));
  drawZoneBadges(ctx, scale);
}

function renderMapPage() {
  const selectedZone = state.map.zones.find((zone) => zone.id === state.selectedZoneId) || null;
  const editHref = `./map-editor.html?space=${encodeURIComponent(state.spaceId)}`;
  return `
    ${getPageIntro()}
    <section class="garden-map-toolbar">
      <a class="garden-button is-primary" href="${editHref}">맵 편집</a>
      <button class="garden-button" type="button" data-action="map-zoom-out">-</button>
      <span>${Math.round(state.mapZoom * 100)}%</span>
      <button class="garden-button" type="button" data-action="map-zoom-in">+</button>
      <button class="garden-button" type="button" data-action="map-zoom-reset">맞춤</button>
    </section>

    <section class="garden-map-layout">
      <div class="garden-card garden-map-preview">
        <div class="garden-card-head">
          <h2>맵 미리보기</h2>
          <span>${getCanvasWidth()} x ${getCanvasHeight()}</span>
        </div>
        <div class="garden-canvas-stage">
          <canvas data-garden-map-canvas aria-label="정원 맵 미리보기"></canvas>
        </div>
      </div>

      <aside class="garden-card garden-map-detail">
        <div class="garden-card-head">
          <h2>상세 정보</h2>
        </div>
        ${
          selectedZone
            ? `<div class="garden-detail-body">
                <b style="--zone-color:${escapeHtml(selectedZone.color)}">${selectedZone.icon}</b>
                <h3>${escapeHtml(selectedZone.name)}</h3>
                <p>${escapeHtml(getZoneType(selectedZone.ecosystem).label)} · ${escapeHtml(selectedZone.climate)}</p>
                <small>${escapeHtml(selectedZone.description || "설명이 없습니다.")}</small>
              </div>`
            : `<p class="garden-empty">아래 구역을 선택하면 상세 정보가 여기에 표시됩니다.</p>`
        }
      </aside>
    </section>

    ${renderCard(
      "구역 바로가기",
      state.map.zones.length
        ? `<div class="garden-zone-chip-grid">
            ${state.map.zones
              .map(
                (zone) => `
                  <button class="garden-zone-chip ${zone.id === state.selectedZoneId ? "is-selected" : ""}" type="button" data-action="select-zone" data-id="${escapeHtml(zone.id)}">
                    <i style="--zone-color:${escapeHtml(zone.color)}">${zone.icon}</i>
                    <span>${escapeHtml(zone.name)}</span>
                  </button>
                `
              )
              .join("")}
          </div>`
        : `<p class="garden-empty">구역 관리에서 구역을 추가하면 맵에도 함께 표시됩니다.</p>`
    )}
  `;
}

function renderZoneForm(zone = null) {
  const item = zone || normalizeZone({ name: "" });
  return `
    <form class="garden-form" data-form="zone">
      <input type="hidden" name="id" value="${zone ? escapeHtml(zone.id) : ""}">
      <label>
        <span>구역 이름</span>
        <input name="name" required maxlength="60" value="${zone ? escapeHtml(item.name) : ""}" placeholder="구역 이름">
      </label>
      <label>
        <span>생태계 유형</span>
        <select name="ecosystem">${renderOptions(ZONE_TYPES, item.ecosystem)}</select>
      </label>
      <label>
        <span>기후</span>
        <input name="climate" maxlength="60" value="${escapeHtml(item.climate)}" placeholder="온화">
      </label>
      <label>
        <span>아이콘</span>
        <select name="icon">${renderOptions(ZONE_ICONS, item.icon)}</select>
      </label>
      <label>
        <span>색상</span>
        <input name="color" type="color" value="${escapeHtml(item.color)}">
      </label>
      <label class="garden-form-wide">
        <span>설명</span>
        <textarea name="description" rows="3" maxlength="700" placeholder="구역 설명">${escapeHtml(item.description)}</textarea>
      </label>
      <label class="garden-check">
        <input type="checkbox" name="autoEnvironment" ${item.autoEnvironment ? "checked" : ""}>
        <span>맞춤 환경 자동 제공</span>
      </label>
      <label class="garden-check">
        <input type="checkbox" name="autoFeed" ${item.autoFeed ? "checked" : ""}>
        <span>먹이 자동 제공</span>
      </label>
      <div class="garden-form-actions">
        <button class="garden-button is-primary" type="submit">${zone ? "구역 수정" : "구역 추가"}</button>
        <button class="garden-button" type="button" data-action="cancel-edit">취소</button>
      </div>
    </form>
  `;
}

function renderZonesPage() {
  const editingZone = state.editType === "zone" ? state.map.zones.find((zone) => zone.id === state.editId) || null : null;
  return `
    ${getPageIntro()}
    <section class="garden-page-actions">
      <button class="garden-button is-primary" type="button" data-action="open-zone-form">구역 추가</button>
    </section>
    ${state.editType === "zone" ? renderCard(editingZone ? "구역 수정" : "새 구역", renderZoneForm(editingZone)) : ""}
    ${renderCard(
      "구역 목록",
      state.map.zones.length
        ? `<div class="garden-card-grid">
            ${state.map.zones
              .map((zone) => {
                const counts = getZoneCounts(zone.id);
                return `
                  <article class="garden-entity-card">
                    <div class="garden-entity-top">
                      <i style="--zone-color:${escapeHtml(zone.color)}">${zone.icon}</i>
                      <span>
                        <strong>${escapeHtml(zone.name)}</strong>
                        <small>${escapeHtml(getZoneType(zone.ecosystem).label)} · ${escapeHtml(zone.climate)}</small>
                      </span>
                    </div>
                    <p>${escapeHtml(zone.description || "설명이 없습니다.")}</p>
                    <dl>
                      <div><dt>식물</dt><dd>${counts.plants}</dd></div>
                      <div><dt>생물</dt><dd>${counts.creatures}</dd></div>
                      <div><dt>광물/보석</dt><dd>${counts.byproducts}</dd></div>
                    </dl>
                    <div class="garden-card-actions">
                      <button class="garden-button" type="button" data-action="edit-zone" data-id="${escapeHtml(zone.id)}">수정</button>
                      <button class="garden-button is-danger" type="button" data-action="delete-zone" data-id="${escapeHtml(zone.id)}">삭제</button>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>`
        : `<p class="garden-empty">등록된 구역이 없습니다.</p>`
    )}
  `;
}

function renderCreatureForm(creature = null) {
  const item = creature || normalizeCreature({ name: "" });
  return `
    <form class="garden-form" data-form="creature">
      <input type="hidden" name="id" value="${creature ? escapeHtml(creature.id) : ""}">
      <label>
        <span>이름</span>
        <input name="name" required maxlength="80" value="${creature ? escapeHtml(item.name) : ""}" placeholder="개체 이름">
      </label>
      <label>
        <span>유형</span>
        <input name="type" required maxlength="60" value="${escapeHtml(item.type || "")}" placeholder="예: 식물, 동물, 영체">
      </label>
      <label>
        <span>구역</span>
        <select name="zoneId">${renderZoneOptions(item.zoneId)}</select>
      </label>
      <label class="garden-form-wide">
        <span>설명</span>
        <textarea name="description" rows="3" maxlength="700" placeholder="개체 설명">${escapeHtml(item.description)}</textarea>
      </label>
      <div class="garden-form-actions">
        <button class="garden-button is-primary" type="submit">${creature ? "개체 수정" : "개체 추가"}</button>
        <button class="garden-button" type="button" data-action="cancel-edit">취소</button>
      </div>
    </form>
  `;
}

function getFilteredCreatures() {
  return state.map.creatures.filter((item) => {
    return state.creatureTypeFilter === "all" || item.type === state.creatureTypeFilter;
  });
}

function renderCreatureDetail(creature = null) {
  if (!creature) {
    return `<section class="garden-creature-detail" hidden></section>`;
  }
  const type = getCreatureType(creature.type);
  return `
    <section class="garden-creature-detail" aria-label="동식물 상세 설명">
      <div class="garden-creature-detail-head">
        <span aria-hidden="true">${type.icon}</span>
        <div>
          <strong>${escapeHtml(creature.name)}</strong>
          <small>${escapeHtml(type.label)} · ${escapeHtml(getZoneName(creature.zoneId))}</small>
        </div>
      </div>
      <p>${escapeHtml(creature.description || "상세 설명이 없습니다.")}</p>
    </section>
  `;
}

function renderCreaturesPage() {
  const editingCreature =
    state.editType === "creature" ? state.map.creatures.find((item) => item.id === state.editId) || null : null;
  const creatures = getFilteredCreatures();
  const selectedExists = creatures.some((item) => item.id === state.selectedCreatureId);
  if (!selectedExists) state.selectedCreatureId = "";
  const selectedCreature = creatures.find((item) => item.id === state.selectedCreatureId) || null;
  return `
    ${getPageIntro()}
    <section class="garden-page-actions">
      <button class="garden-button is-primary" type="button" data-action="open-creature-form">동식물 추가</button>
      <select data-creature-type-filter aria-label="유형 필터">
        <option value="all" ${state.creatureTypeFilter === "all" ? "selected" : ""}>전체 유형</option>
        ${renderOptions(getCreatureTypeOptions(), state.creatureTypeFilter)}
      </select>
    </section>
    ${state.editType === "creature" ? renderCard(editingCreature ? "동식물 수정" : "새 동식물", renderCreatureForm(editingCreature)) : ""}
    ${renderCard(
      "동식물 목록",
      creatures.length
        ? `<div class="garden-table">
            <div class="garden-table-head garden-creature-list-row">
              <span>이름</span><span>유형</span><span>구역</span><span>관리</span>
            </div>
            ${creatures
              .map((item) => {
                const type = getCreatureType(item.type);
                return `
                  <div class="garden-table-row garden-creature-list-row ${item.id === state.selectedCreatureId ? "is-selected" : ""}" data-action="select-creature" data-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-pressed="${item.id === state.selectedCreatureId ? "true" : "false"}">
                    <strong>${type.icon} ${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(type.label)}</span>
                    <span>${escapeHtml(getZoneName(item.zoneId))}</span>
                    <span class="garden-inline-actions">
                      <button type="button" data-action="edit-creature" data-id="${escapeHtml(item.id)}">수정</button>
                      <button type="button" data-action="delete-creature" data-id="${escapeHtml(item.id)}">삭제</button>
                    </span>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : `<p class="garden-empty">조건에 맞는 동식물이 없습니다.</p>`
    )}
    ${renderCreatureDetail(selectedCreature)}
  `;
}

function getRelationNodeName(nodeId = "") {
  return state.map.relations.nodes.find((node) => node.id === nodeId)?.name || "알 수 없는 노드";
}

function renderRelationNodeOptions(selectedValue = "") {
  return state.map.relations.nodes
    .map((node) => `<option value="${escapeHtml(node.id)}" ${node.id === selectedValue ? "selected" : ""}>${escapeHtml(node.name)}</option>`)
    .join("");
}

function renderRelationNodeForm(node = null) {
  const item = node || normalizeRelationNode({ name: "" });
  return `
    <form class="garden-form" data-form="relation-node">
      <input type="hidden" name="id" value="${node ? escapeHtml(node.id) : ""}">
      <label>
        <span>노드 이름</span>
        <input name="name" required maxlength="80" value="${node ? escapeHtml(item.name) : ""}" placeholder="인물, 생물, 구역 이름">
      </label>
      <label>
        <span>노드 유형</span>
        <input name="type" required maxlength="60" value="${escapeHtml(item.type || "")}" placeholder="예: 인물, 생물, 구역">
      </label>
      <label>
        <span>색상</span>
        <input name="color" type="color" value="${escapeHtml(item.color)}">
      </label>
      <label class="garden-form-wide">
        <span>설명</span>
        <textarea name="description" rows="3" maxlength="700" placeholder="노드 설명">${escapeHtml(item.description)}</textarea>
      </label>
      <div class="garden-form-actions">
        <button class="garden-button is-primary" type="submit">${node ? "노드 수정" : "노드 추가"}</button>
        <button class="garden-button" type="button" data-action="cancel-edit">취소</button>
      </div>
    </form>
  `;
}

function renderRelationEdgeForm(edge = null) {
  const item = edge || normalizeRelationEdge({});
  return `
    <form class="garden-form" data-form="relation-edge">
      <input type="hidden" name="id" value="${edge ? escapeHtml(edge.id) : ""}">
      <label>
        <span>시작 노드</span>
        <select name="sourceId" required>${renderRelationNodeOptions(item.sourceId)}</select>
      </label>
      <label>
        <span>대상 노드</span>
        <select name="targetId" required>${renderRelationNodeOptions(item.targetId)}</select>
      </label>
      <label class="garden-form-wide">
        <span>관계 이름</span>
        <input name="label" required maxlength="80" value="${edge ? escapeHtml(item.label) : ""}" placeholder="예: 가족, 동맹, 경쟁">
      </label>
      <label class="garden-form-wide">
        <span>설명</span>
        <textarea name="description" rows="3" maxlength="700" placeholder="관계 설명">${escapeHtml(item.description)}</textarea>
      </label>
      <div class="garden-form-actions">
        <button class="garden-button is-primary" type="submit">${edge ? "엣지 수정" : "엣지 추가"}</button>
        <button class="garden-button" type="button" data-action="cancel-edit">취소</button>
      </div>
    </form>
  `;
}

function renderRelationsPage() {
  const relations = state.map.relations;
  const editingNode =
    state.editType === "relation-node" ? relations.nodes.find((node) => node.id === state.editId) || null : null;
  const editingEdge =
    state.editType === "relation-edge" ? relations.edges.find((edge) => edge.id === state.editId) || null : null;

  return `
    ${getPageIntro()}
    <section class="garden-page-actions">
      <button class="garden-button is-primary" type="button" data-action="open-relation-node-form">노드 추가</button>
      <button class="garden-button" type="button" data-action="open-relation-edge-form" ${relations.nodes.length < 2 ? "disabled" : ""}>엣지 추가</button>
    </section>
    ${state.editType === "relation-node" ? renderCard(editingNode ? "노드 수정" : "새 노드", renderRelationNodeForm(editingNode)) : ""}
    ${state.editType === "relation-edge" ? renderCard(editingEdge ? "엣지 수정" : "새 엣지", renderRelationEdgeForm(editingEdge)) : ""}
    ${renderCard(
      "관계도 보기",
      relations.nodes.length
        ? `<div class="garden-relation-board">
            <div class="garden-relation-nodes">
              ${relations.nodes
                .map(
                  (node) => `
                    <span class="garden-relation-node" style="--node-color:${escapeHtml(node.color)}">
                      <b>${escapeHtml(node.name.slice(0, 1))}</b>
                      <strong>${escapeHtml(node.name)}</strong>
                      <small>${escapeHtml(node.type)}</small>
                    </span>
                  `
                )
                .join("")}
            </div>
            <div class="garden-relation-edges">
              ${
                relations.edges.length
                  ? relations.edges
                      .map(
                        (edge) => `
                          <span>
                            <strong>${escapeHtml(getRelationNodeName(edge.sourceId))}</strong>
                            <i>${escapeHtml(edge.label)}</i>
                            <strong>${escapeHtml(getRelationNodeName(edge.targetId))}</strong>
                          </span>
                        `
                      )
                      .join("")
                  : `<p class="garden-empty">엣지를 추가하면 노드 사이의 관계가 표시됩니다.</p>`
              }
            </div>
          </div>`
        : `<p class="garden-empty">노드를 추가하면 관계도를 만들 수 있습니다.</p>`
    )}
    ${renderCard(
      "노드 목록",
      relations.nodes.length
        ? `<div class="garden-card-grid">
            ${relations.nodes
              .map(
                (node) => `
                  <article class="garden-entity-card">
                    <div class="garden-entity-top">
                      <i style="--zone-color:${escapeHtml(node.color)}">${escapeHtml(node.name.slice(0, 1))}</i>
                      <span>
                        <strong>${escapeHtml(node.name)}</strong>
                        <small>${escapeHtml(node.type)}</small>
                      </span>
                    </div>
                    <p>${escapeHtml(node.description || "설명이 없습니다.")}</p>
                    <div class="garden-card-actions">
                      <button class="garden-button" type="button" data-action="edit-relation-node" data-id="${escapeHtml(node.id)}">수정</button>
                      <button class="garden-button is-danger" type="button" data-action="delete-relation-node" data-id="${escapeHtml(node.id)}">삭제</button>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>`
        : `<p class="garden-empty">등록된 노드가 없습니다.</p>`
    )}
    ${renderCard(
      "엣지 목록",
      relations.edges.length
        ? `<div class="garden-table">
            <div class="garden-table-head garden-relation-edge-row">
              <span>관계</span><span>시작</span><span>대상</span><span>관리</span>
            </div>
            ${relations.edges
              .map(
                (edge) => `
                  <div class="garden-table-row garden-relation-edge-row">
                    <strong>${escapeHtml(edge.label)}</strong>
                    <span>${escapeHtml(getRelationNodeName(edge.sourceId))}</span>
                    <span>${escapeHtml(getRelationNodeName(edge.targetId))}</span>
                    <span class="garden-inline-actions">
                      <button type="button" data-action="edit-relation-edge" data-id="${escapeHtml(edge.id)}">수정</button>
                      <button type="button" data-action="delete-relation-edge" data-id="${escapeHtml(edge.id)}">삭제</button>
                    </span>
                  </div>
                `
              )
              .join("")}
          </div>`
        : `<p class="garden-empty">등록된 엣지가 없습니다.</p>`
    )}
  `;
}

function renderCatalogForm(collection = "byproducts", item = null) {
  const config = getCatalogConfig(collection);
  const entry = item || normalizeCatalogItem(collection, { name: "", type: config.defaultType });
  return `
    <form class="garden-form" data-form="catalog" data-collection="${escapeHtml(collection)}">
      <input type="hidden" name="id" value="${item ? escapeHtml(item.id) : ""}">
      <label>
        <span>이름</span>
        <input name="name" required maxlength="80" value="${item ? escapeHtml(entry.name) : ""}" placeholder="${escapeHtml(config.namePlaceholder || "항목 이름")}">
      </label>
      <label>
        <span>${escapeHtml(config.typeLabel || "종류")}</span>
        <input name="type" required maxlength="60" value="${escapeHtml(entry.type || "")}" placeholder="${escapeHtml(config.typePlaceholder || "예: 종류")}">
      </label>
      <label>
        <span>구역</span>
        <select name="zoneId">${renderZoneOptions(entry.zoneId)}</select>
      </label>
      <label class="garden-form-wide">
        <span>설명</span>
        <textarea name="description" rows="3" maxlength="700" placeholder="${escapeHtml(config.descriptionPlaceholder || "설명")}">${escapeHtml(entry.description)}</textarea>
      </label>
      <div class="garden-form-actions">
        <button class="garden-button is-primary" type="submit">${item ? escapeHtml(config.editTitle) : escapeHtml(config.addLabel)}</button>
        <button class="garden-button" type="button" data-action="cancel-edit">취소</button>
      </div>
    </form>
  `;
}

function renderCatalogPage(collection = "byproducts") {
  const config = getCatalogConfig(collection);
  const items = Array.isArray(state.map[collection]) ? state.map[collection] : [];
  const editingItem = state.editType === collection ? items.find((item) => item.id === state.editId) || null : null;
  return `
    ${getPageIntro()}
    <section class="garden-page-actions">
      <button class="garden-button is-primary" type="button" data-action="open-catalog-form" data-collection="${escapeHtml(collection)}">${escapeHtml(config.addLabel)}</button>
    </section>
    ${state.editType === collection ? renderCard(editingItem ? escapeHtml(config.editTitle) : escapeHtml(config.newTitle), renderCatalogForm(collection, editingItem)) : ""}
    ${renderCard(
      escapeHtml(config.listTitle),
      items.length
        ? `<div class="garden-card-grid">
            ${items
              .map((item) => {
                const type = getCatalogType(collection, item.type);
                return `
                  <article class="garden-entity-card">
                    <div class="garden-entity-top">
                      <i>${type.icon}</i>
                      <span>
                        <strong>${escapeHtml(item.name)}</strong>
                        <small>${escapeHtml(type.label)} · ${escapeHtml(getZoneName(item.zoneId))}</small>
                      </span>
                    </div>
                    <p>${escapeHtml(item.description || "설명이 없습니다.")}</p>
                    <div class="garden-card-actions">
                      <button class="garden-button" type="button" data-action="edit-catalog" data-collection="${escapeHtml(collection)}" data-id="${escapeHtml(item.id)}">수정</button>
                      <button class="garden-button is-danger" type="button" data-action="delete-catalog" data-collection="${escapeHtml(collection)}" data-id="${escapeHtml(item.id)}">삭제</button>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>`
        : `<p class="garden-empty">${escapeHtml(config.empty)}</p>`
    )}
  `;
}

function renderByproductsPage() {
  return renderCatalogPage("byproducts");
}

function renderToggleRow(key, title, description) {
  const active = Boolean(state.map.settings[key]);
  return `
    <div class="garden-setting-row">
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
      <button class="garden-toggle ${active ? "is-active" : ""}" type="button" data-action="toggle-setting" data-key="${escapeHtml(key)}" aria-pressed="${active}">
        <i></i>
      </button>
    </div>
  `;
}

function renderSettingsPage() {
  return `
    ${getPageIntro()}
    <p class="garden-warning">※ 소유주와 가족은 권한 기간이 영구 적용됩니다.</p>
    ${renderCard(
      "🌱 성장 시스템",
      `<div class="garden-settings-list">
        ${renderToggleRow("infiniteGrowth", "무한 재배 및 성장", "기본 On - Ex급 도달 시 성장 자동 정지")}
        <div class="garden-growth-grid">
          ${GROWTH_MODES
            .map(
              (mode) => `
                <button class="${state.map.settings.growthMode === mode.value ? "is-selected" : ""}" type="button" data-action="set-growth-mode" data-value="${escapeHtml(mode.value)}">
                  <b>${mode.icon}</b>
                  <strong>${escapeHtml(mode.label)}</strong>
                  <span>${escapeHtml(mode.description)}</span>
                </button>
              `
            )
            .join("")}
        </div>
      </div>`
    )}
    ${renderCard(
      "🛡️ 환경 보호",
      `<div class="garden-settings-list">
        ${renderToggleRow("pollutionShield", "오염 방지 마법", "정원 전체의 오염을 막습니다.")}
        ${renderToggleRow("selfCleaning", "자가 세척 마법", "불순물과 흔적을 자동으로 정리합니다.")}
      </div>`
    )}
    ${renderCard(
      "🤖 자동화",
      `<div class="garden-settings-list">
        ${renderToggleRow("autoClassify", "동식물 자동 분류", "등록한 개체를 자동으로 유형별 분류합니다.")}
        ${renderToggleRow("autoEnvironment", "맞춤 환경 자동 제공", "구역별 환경을 자동으로 맞춥니다.")}
        ${renderToggleRow("autoFeed", "먹이 자동 제공", "필요한 먹이를 자동으로 공급합니다.")}
      </div>`
    )}
  `;
}

function renderAccessForm(item = null) {
  const entry = item || normalizeAccessKey({ name: "", role: "guest" });
  return `
    <form class="garden-form" data-form="access">
      <input type="hidden" name="id" value="${item ? escapeHtml(item.id) : ""}">
      <label>
        <span>이름</span>
        <input name="name" required maxlength="80" value="${item ? escapeHtml(entry.name) : ""}" placeholder="출입자 이름">
      </label>
      <label>
        <span>역할</span>
        <select name="role">${renderOptions(ACCESS_ROLES, entry.role)}</select>
      </label>
      <label>
        <span>권한 기간</span>
        <input name="permissionPeriod" data-access-period-preview value="${escapeHtml(formatAccessPeriod(entry))}" readonly aria-readonly="true">
      </label>
      <label>
        <span>기간 기준(년)</span>
        <input name="permissionYears" type="number" min="0.25" max="20" step="0.25" value="${escapeHtml(entry.permissionYears || DEFAULT_ACCESS_PERMISSION_YEARS)}">
      </label>
      <label class="garden-check">
        <input type="checkbox" name="active" ${entry.active ? "checked" : ""}>
        <span>활성화</span>
      </label>
      <div class="garden-form-actions">
        <button class="garden-button is-primary" type="submit">${item ? "권한 수정" : "권한 추가"}</button>
        <button class="garden-button" type="button" data-action="cancel-edit">취소</button>
      </div>
    </form>
  `;
}

function renderAccessPage() {
  const editingItem =
    state.editType === "access" ? state.map.accessKeys.find((item) => item.id === state.editId) || null : null;
  return `
    ${getPageIntro()}
    <section class="garden-page-actions">
      <button class="garden-button is-primary" type="button" data-action="open-access-form">권한 추가</button>
    </section>
    ${state.editType === "access" ? renderCard(editingItem ? "권한 수정" : "새 권한", renderAccessForm(editingItem)) : ""}
    ${renderCard(
      "출입 권한",
      state.map.accessKeys.length
        ? `<div class="garden-table">
            <div class="garden-table-head garden-access-row">
              <span>이름</span><span>역할</span><span>권한 기간</span><span>상태</span><span>관리</span>
            </div>
            ${state.map.accessKeys
              .map(
                (item) => `
                  <div class="garden-table-row garden-access-row">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(getAccessRole(item.role).label)}</span>
                    <span>${escapeHtml(formatAccessPeriod(item))}</span>
                    <span>${item.active ? "활성" : "비활성"}</span>
                    <span class="garden-inline-actions">
                      <button type="button" data-action="edit-access" data-id="${escapeHtml(item.id)}">수정</button>
                      <button type="button" data-action="delete-access" data-id="${escapeHtml(item.id)}">삭제</button>
                    </span>
                  </div>
                `
              )
              .join("")}
          </div>`
        : `<p class="garden-empty">등록된 출입 권한이 없습니다.</p>`
    )}
  `;
}

function renderTrashPage() {
  const trash = state.map.trash || [];
  return `
    ${getPageIntro()}
    <section class="garden-page-actions">
      <button class="garden-button is-danger" type="button" data-action="empty-dashboard-trash" ${trash.length ? "" : "disabled"}>비우기</button>
    </section>
    ${renderCard(
      "삭제된 항목",
      trash.length
        ? `<div class="garden-table">
            <div class="garden-table-head garden-trash-row">
              <span>이름</span><span>종류</span><span>삭제일</span><span>관리</span>
            </div>
            ${trash
              .map((entry) => {
                const title = getDashboardItemTitle(entry.collection, entry.item);
                return `
                  <div class="garden-table-row garden-trash-row">
                    <strong>${escapeHtml(title)}</strong>
                    <span>${escapeHtml(DASHBOARD_COLLECTION_LABELS[entry.collection] || "항목")}</span>
                    <span>${escapeHtml(formatDate(entry.deletedAt))}</span>
                    <span class="garden-inline-actions">
                      <button type="button" data-action="restore-dashboard-trash" data-id="${escapeHtml(entry.id)}">복원</button>
                      <button type="button" data-action="delete-dashboard-trash" data-id="${escapeHtml(entry.id)}">삭제</button>
                    </span>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : `<p class="garden-empty">휴지통이 비어 있습니다.</p>`
    )}
  `;
}

function render() {
  if (!els.view) return;
  syncChrome();
  const renderers = {
    dashboard: renderDashboard,
    map: renderMapPage,
    zones: renderZonesPage,
    creatures: renderCreaturesPage,
    byproducts: renderByproductsPage,
    relations: renderRelationsPage,
    appearances: () => renderCatalogPage("appearances"),
    abilities: () => renderCatalogPage("abilities"),
    titles: () => renderCatalogPage("titles"),
    creations: () => renderCatalogPage("creations"),
    items: () => renderCatalogPage("items"),
    manaStones: () => renderCatalogPage("manaStones"),
    settings: renderSettingsPage,
    access: renderAccessPage,
    trash: renderTrashPage,
  };
  els.view.innerHTML = renderers[state.activePage]?.() || renderDashboard();
  requestAnimationFrame(() => {
    document.querySelectorAll("[data-garden-map-canvas]").forEach(drawPreview);
  });
}

function setActivePage(page, syncHash = true) {
  state.activePage = PAGES.has(page) ? page : "dashboard";
  state.editType = "";
  state.editId = "";
  if (syncHash) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${state.activePage}`);
  }
  render();
}

async function saveSpaceContent() {
  const content = JSON.stringify(state.map);
  const updatedAt = new Date().toISOString();
  const rows = await requestRest(
    `blog_materials?id=eq.${encodeURIComponent(state.spaceId)}&user_id=eq.${encodeURIComponent(state.session.user.id)}`,
    state.session.access_token,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        content,
        updated_at: updatedAt,
      }),
    }
  );
  state.space = {
    ...(state.space || {}),
    ...(Array.isArray(rows) ? rows[0] || {} : {}),
    content,
    updated_at: updatedAt,
  };
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

function openEditor(type, id = "") {
  state.editType = type;
  state.editId = id;
  render();
}

function closeEditor() {
  state.editType = "";
  state.editId = "";
  render();
}

async function deleteEntity(collection, id, message = "삭제할까요?") {
  if (!id || !window.confirm(message)) return;
  const entries = Array.isArray(state.map[collection]) ? state.map[collection] : [];
  const item = entries.find((entry) => entry.id === id);
  if (!item) return;
  state.map.trash = [
    normalizeDashboardTrashEntry({
      collection,
      item: structuredClone(item),
      deletedAt: new Date().toISOString(),
    }),
    ...(state.map.trash || []),
  ];
  state.map[collection] = entries.filter((entry) => entry.id !== id);
  if (collection === "zones") {
    if (state.selectedZoneId === id) state.selectedZoneId = "";
  }
  if (collection === "creatures" && state.selectedCreatureId === id) {
    state.selectedCreatureId = "";
  }
  if (state.editType && state.editId === id) {
    state.editType = "";
    state.editId = "";
  }
  await saveSpaceContent();
  render();
}

async function deleteRelationEntity(kind, id, message = "삭제할까요?") {
  if (!id || !window.confirm(message)) return;
  const relations = state.map.relations;
  if (kind === "node") {
    const node = relations.nodes.find((entry) => entry.id === id);
    if (!node) return;
    const connectedEdges = relations.edges.filter((edge) => edge.sourceId === id || edge.targetId === id);
    state.map.trash = [
      normalizeDashboardTrashEntry({
        collection: "relationNodes",
        item: structuredClone(node),
        deletedAt: new Date().toISOString(),
      }),
      ...connectedEdges.map((edge) =>
        normalizeDashboardTrashEntry({
          collection: "relationEdges",
          item: structuredClone(edge),
          deletedAt: new Date().toISOString(),
        })
      ),
      ...(state.map.trash || []),
    ];
    relations.nodes = relations.nodes.filter((entry) => entry.id !== id);
    relations.edges = relations.edges.filter((edge) => edge.sourceId !== id && edge.targetId !== id);
  } else {
    const edge = relations.edges.find((entry) => entry.id === id);
    if (!edge) return;
    state.map.trash = [
      normalizeDashboardTrashEntry({
        collection: "relationEdges",
        item: structuredClone(edge),
        deletedAt: new Date().toISOString(),
      }),
      ...(state.map.trash || []),
    ];
    relations.edges = relations.edges.filter((entry) => entry.id !== id);
  }
  if (state.editType && state.editId === id) {
    state.editType = "";
    state.editId = "";
  }
  await saveSpaceContent();
  render();
}

function clearDeletedZoneReferences(zoneIds = []) {
  const deletedIds = new Set(zoneIds.filter(Boolean));
  if (deletedIds.size === 0) return;
  state.map.creatures = state.map.creatures.map((item) => (deletedIds.has(item.zoneId) ? { ...item, zoneId: "" } : item));
  CATALOG_COLLECTIONS.forEach((collection) => {
    state.map[collection] = (state.map[collection] || []).map((item) => (deletedIds.has(item.zoneId) ? { ...item, zoneId: "" } : item));
  });
}

async function restoreTrashEntry(trashId) {
  const entry = state.map.trash.find((item) => item.id === trashId);
  if (!entry) return;
  const collection = entry.collection;
  const restored = normalizeDashboardItem(collection, entry.item);
  if (collection === "relationNodes") {
    if (state.map.relations.nodes.some((item) => item.id === restored.id)) restored.id = createId();
    state.map.relations.nodes = [...state.map.relations.nodes, restored];
    state.map.trash = state.map.trash.filter((item) => item.id !== trashId);
    await saveSpaceContent();
    render();
    return;
  }
  if (collection === "relationEdges") {
    if (state.map.relations.edges.some((item) => item.id === restored.id)) restored.id = createId();
    state.map.relations.edges = [...state.map.relations.edges, restored];
    state.map.trash = state.map.trash.filter((item) => item.id !== trashId);
    await saveSpaceContent();
    render();
    return;
  }
  const entries = Array.isArray(state.map[collection]) ? state.map[collection] : [];
  if (entries.some((item) => item.id === restored.id)) {
    restored.id = createId();
  }
  state.map[collection] = [...entries, restored];
  state.map.trash = state.map.trash.filter((item) => item.id !== trashId);
  await saveSpaceContent();
  render();
}

async function permanentlyDeleteTrashEntry(trashId) {
  if (!trashId || !window.confirm("내용을 정말로 삭제할까요?")) return;
  const entry = state.map.trash.find((item) => item.id === trashId);
  if (entry?.collection === "zones") clearDeletedZoneReferences([entry.item?.id]);
  state.map.trash = state.map.trash.filter((item) => item.id !== trashId);
  await saveSpaceContent();
  render();
}

async function emptyDashboardTrash() {
  if (!state.map.trash.length || !window.confirm("내용을 정말로 삭제할까요?")) return;
  clearDeletedZoneReferences(state.map.trash.filter((item) => item.collection === "zones").map((item) => item.item?.id));
  state.map.trash = [];
  await saveSpaceContent();
  render();
}

async function handleAction(action, target) {
  if (action === "toggle-sidebar") {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem("spaceDashboardSidebar", state.sidebarCollapsed ? "collapsed" : "expanded");
    syncChrome();
    return;
  }
  if (action === "open-zone-form") return openEditor("zone");
  if (action === "open-creature-form") return openEditor("creature");
  if (action === "open-relation-node-form") return openEditor("relation-node");
  if (action === "open-relation-edge-form") return openEditor("relation-edge");
  if (action === "open-byproduct-form") return openEditor("byproducts");
  if (action === "open-catalog-form") return openEditor(target.dataset.collection || "byproducts");
  if (action === "open-access-form") return openEditor("access");
  if (action === "cancel-edit") return closeEditor();
  if (action === "edit-zone") return openEditor("zone", target.dataset.id || "");
  if (action === "edit-creature") return openEditor("creature", target.dataset.id || "");
  if (action === "edit-relation-node") return openEditor("relation-node", target.dataset.id || "");
  if (action === "edit-relation-edge") return openEditor("relation-edge", target.dataset.id || "");
  if (action === "edit-byproduct") return openEditor("byproducts", target.dataset.id || "");
  if (action === "edit-catalog") return openEditor(target.dataset.collection || "byproducts", target.dataset.id || "");
  if (action === "edit-access") return openEditor("access", target.dataset.id || "");
  if (action === "select-creature") {
    state.selectedCreatureId = target.dataset.id || "";
    render();
    return;
  }
  if (action === "delete-zone") return deleteEntity("zones", target.dataset.id, "구역을 휴지통으로 이동할까요?");
  if (action === "delete-creature") return deleteEntity("creatures", target.dataset.id, "동식물을 휴지통으로 이동할까요?");
  if (action === "delete-relation-node") return deleteRelationEntity("node", target.dataset.id, "노드를 휴지통으로 이동할까요?");
  if (action === "delete-relation-edge") return deleteRelationEntity("edge", target.dataset.id, "엣지를 휴지통으로 이동할까요?");
  if (action === "delete-byproduct") return deleteEntity("byproducts", target.dataset.id, "광물/보석을 휴지통으로 이동할까요?");
  if (action === "delete-catalog") {
    const collection = target.dataset.collection || "byproducts";
    const config = getCatalogConfig(collection);
    return deleteEntity(collection, target.dataset.id, `${config.title}을 휴지통으로 이동할까요?`);
  }
  if (action === "delete-access") return deleteEntity("accessKeys", target.dataset.id, "출입 권한을 휴지통으로 이동할까요?");
  if (action === "restore-dashboard-trash") return restoreTrashEntry(target.dataset.id || "");
  if (action === "delete-dashboard-trash") return permanentlyDeleteTrashEntry(target.dataset.id || "");
  if (action === "empty-dashboard-trash") return emptyDashboardTrash();
  if (action === "go-page") return setActivePage(target.dataset.page || "dashboard");
  if (action === "go-zone") return setActivePage("zones");
  if (action === "select-zone") {
    state.selectedZoneId = target.dataset.id || "";
    render();
    return;
  }
  if (action === "map-zoom-in") {
    state.mapZoom = clampNumber(state.mapZoom + 0.1, 0.5, 2);
    render();
    return;
  }
  if (action === "map-zoom-out") {
    state.mapZoom = clampNumber(state.mapZoom - 0.1, 0.5, 2);
    render();
    return;
  }
  if (action === "map-zoom-reset") {
    state.mapZoom = 1;
    render();
    return;
  }
  if (action === "toggle-setting") {
    const key = target.dataset.key;
    if (!Object.prototype.hasOwnProperty.call(state.map.settings, key)) return;
    state.map.settings[key] = !state.map.settings[key];
    await saveSpaceContent();
    render();
    return;
  }
  if (action === "set-growth-mode") {
    state.map.settings.growthMode = target.dataset.value || DEFAULT_SETTINGS.growthMode;
    await saveSpaceContent();
    render();
    return;
  }
}

async function handleZoneSubmit(form) {
  const formData = new FormData(form);
  const id = String(formData.get("id") || "");
  const item = normalizeZone({
    id: id || createId(),
    name: formData.get("name"),
    ecosystem: formData.get("ecosystem"),
    climate: formData.get("climate"),
    icon: formData.get("icon"),
    color: formData.get("color"),
    description: formData.get("description"),
    autoEnvironment: formData.has("autoEnvironment"),
    autoFeed: formData.has("autoFeed"),
    createdAt: state.map.zones.find((zone) => zone.id === id)?.createdAt,
  });
  state.map.zones = id ? state.map.zones.map((zone) => (zone.id === id ? item : zone)) : [...state.map.zones, item];
  await saveSpaceContent();
  closeEditor();
}

async function handleCreatureSubmit(form) {
  const formData = new FormData(form);
  const id = String(formData.get("id") || "");
  const item = normalizeCreature({
    id: id || createId(),
    name: formData.get("name"),
    type: formData.get("type"),
    zoneId: formData.get("zoneId"),
    description: formData.get("description"),
    createdAt: state.map.creatures.find((creature) => creature.id === id)?.createdAt,
  });
  state.map.creatures = id
    ? state.map.creatures.map((creature) => (creature.id === id ? item : creature))
    : [...state.map.creatures, item];
  await saveSpaceContent();
  closeEditor();
}

async function handleRelationNodeSubmit(form) {
  const formData = new FormData(form);
  const id = String(formData.get("id") || "");
  const item = normalizeRelationNode({
    id: id || createId(),
    name: formData.get("name"),
    type: formData.get("type"),
    color: formData.get("color"),
    description: formData.get("description"),
    createdAt: state.map.relations.nodes.find((node) => node.id === id)?.createdAt,
  });
  state.map.relations.nodes = id
    ? state.map.relations.nodes.map((node) => (node.id === id ? item : node))
    : [...state.map.relations.nodes, item];
  await saveSpaceContent();
  closeEditor();
}

async function handleRelationEdgeSubmit(form) {
  const formData = new FormData(form);
  const id = String(formData.get("id") || "");
  const sourceId = String(formData.get("sourceId") || "");
  const targetId = String(formData.get("targetId") || "");
  if (!sourceId || !targetId) throw new Error("시작 노드와 대상 노드를 선택해주세요.");
  if (sourceId === targetId) throw new Error("서로 다른 노드를 선택해주세요.");
  const item = normalizeRelationEdge({
    id: id || createId(),
    sourceId,
    targetId,
    label: formData.get("label"),
    description: formData.get("description"),
    createdAt: state.map.relations.edges.find((edge) => edge.id === id)?.createdAt,
  });
  state.map.relations.edges = id
    ? state.map.relations.edges.map((edge) => (edge.id === id ? item : edge))
    : [...state.map.relations.edges, item];
  await saveSpaceContent();
  closeEditor();
}

async function handleByproductSubmit(form) {
  form.dataset.collection = "byproducts";
  await handleCatalogSubmit(form);
}

async function handleCatalogSubmit(form) {
  const formData = new FormData(form);
  const collection = form.dataset.collection || "byproducts";
  if (!CATALOG_COLLECTIONS.includes(collection)) return;
  const entries = Array.isArray(state.map[collection]) ? state.map[collection] : [];
  const id = String(formData.get("id") || "");
  const item = normalizeCatalogItem(collection, {
    id: id || createId(),
    name: formData.get("name"),
    type: formData.get("type"),
    zoneId: formData.get("zoneId"),
    description: formData.get("description"),
    createdAt: entries.find((entry) => entry.id === id)?.createdAt,
  });
  state.map[collection] = id ? entries.map((entry) => (entry.id === id ? item : entry)) : [...entries, item];
  await saveSpaceContent();
  closeEditor();
}

async function handleAccessSubmit(form) {
  const formData = new FormData(form);
  const id = String(formData.get("id") || "");
  const existing = state.map.accessKeys.find((entry) => entry.id === id);
  const role = normalizeAccessRole(String(formData.get("role") || "guest"));
  const permissionYears = normalizePermissionYears(formData.get("permissionYears"));
  const createdAt = existing?.createdAt || new Date().toISOString();
  const expiresAt = createAccessExpiry(role, createdAt, permissionYears);
  const item = normalizeAccessKey({
    id: id || createId(),
    name: formData.get("name"),
    role,
    permissionYears,
    expiresAt,
    active: formData.has("active"),
    createdAt,
  });
  state.map.accessKeys = id
    ? state.map.accessKeys.map((entry) => (entry.id === id ? item : entry))
    : [...state.map.accessKeys, item];
  await saveSpaceContent();
  closeEditor();
}

document.addEventListener("click", async (event) => {
  const pageLink = event.target.closest("[data-space-page-link]");
  if (pageLink) {
    event.preventDefault();
    setActivePage(pageLink.dataset.spacePageLink || "dashboard");
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  event.preventDefault();
  try {
    await handleAction(actionTarget.dataset.action, actionTarget);
  } catch (error) {
    window.alert(error.message || "작업을 처리하지 못했습니다.");
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (form.dataset.form === "zone") await handleZoneSubmit(form);
    if (form.dataset.form === "creature") await handleCreatureSubmit(form);
    if (form.dataset.form === "relation-node") await handleRelationNodeSubmit(form);
    if (form.dataset.form === "relation-edge") await handleRelationEdgeSubmit(form);
    if (form.dataset.form === "byproduct") await handleByproductSubmit(form);
    if (form.dataset.form === "catalog") await handleCatalogSubmit(form);
    if (form.dataset.form === "access") await handleAccessSubmit(form);
  } catch (error) {
    window.alert(error.message || "저장하지 못했습니다.");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

document.addEventListener("change", (event) => {
  const typeFilter = event.target.closest("[data-creature-type-filter]");
  if (typeFilter) {
    state.creatureTypeFilter = typeFilter.value || "all";
    state.selectedCreatureId = "";
    render();
    return;
  }

  const accessRole = event.target.closest('form[data-form="access"] select[name="role"]');
  if (accessRole) {
    const preview = accessRole.form?.querySelector("[data-access-period-preview]");
    const years = accessRole.form?.querySelector('input[name="permissionYears"]')?.value;
    if (preview) preview.value = formatAccessPeriod(accessRole.value, years);
  }

  const accessYears = event.target.closest('form[data-form="access"] input[name="permissionYears"]');
  if (accessYears) {
    const role = accessYears.form?.querySelector('select[name="role"]')?.value || "guest";
    const preview = accessYears.form?.querySelector("[data-access-period-preview]");
    accessYears.value = normalizePermissionYears(accessYears.value);
    if (preview) preview.value = formatAccessPeriod(role, accessYears.value);
  }
});

document.addEventListener("input", (event) => {
  const accessYears = event.target.closest('form[data-form="access"] input[name="permissionYears"]');
  if (!accessYears) return;
  const role = accessYears.form?.querySelector('select[name="role"]')?.value || "guest";
  const preview = accessYears.form?.querySelector("[data-access-period-preview]");
  if (preview) preview.value = formatAccessPeriod(role, accessYears.value);
});

document.addEventListener("keydown", (event) => {
  const statCard = event.target.closest(".garden-stat-card[data-action]");
  if (statCard && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    handleAction(statCard.dataset.action, statCard);
    return;
  }

  if (event.target.closest("button, input, select, textarea, a")) return;
  const row = event.target.closest('[data-action="select-creature"]');
  if (!row || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  state.selectedCreatureId = row.dataset.id || "";
  render();
});

window.addEventListener("hashchange", () => {
  setActivePage(readActivePageFromHash(), false);
});

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

  try {
    state.space = await loadSpace(session);
    state.map = parseMapContent(state.space.content || "");
    render();
  } catch (error) {
    window.alert(error.message || "공간을 불러오지 못했습니다.");
    window.location.href = "./materials.html#spaces";
  }
});
