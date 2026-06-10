(() => {
  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

  const TREE_CACHE_KEY = "blog.cached.tree.response";
  const POSTS_CACHE_KEY = "blog.cached.posts.response";

  function patchPostsUrl(value) {
    const raw = String(value || "");
    if (!raw.includes("/rest/v1/posts")) return raw;

    try {
      const url = new URL(raw, window.location.href);
      if (!url.pathname.includes("/rest/v1/posts")) return raw;
      const currentLimit = Number(url.searchParams.get("limit") || "0");
      if (!currentLimit || currentLimit < 1000) {
        url.searchParams.set("limit", "1000");
      }
      return url.toString();
    } catch {
      if (/limit=\d+/.test(raw)) return raw.replace(/limit=\d+/g, "limit=1000");
      return `${raw}${raw.includes("?") ? "&" : "?"}limit=1000`;
    }
  }

  function isBlogTreeRequest(value) {
    return String(value || "").includes("/rest/v1/blog_trees");
  }

  function isPostsRequest(value) {
    return String(value || "").includes("/rest/v1/posts");
  }

  function readCache(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function writeCache(key, payload) {
    try {
      const text = JSON.stringify(payload);
      sessionStorage.setItem(key, text);
      localStorage.setItem(key, text);
    } catch {}
  }

  function getCachedTreeResponse() {
    const cached = readCache(TREE_CACHE_KEY);
    return Array.isArray(cached) && Array.isArray(cached[0]?.tree) && cached[0].tree.length > 0 ? cached : null;
  }

  function getCachedPostsResponse() {
    const cached = readCache(POSTS_CACHE_KEY);
    return Array.isArray(cached) && cached.length > 0 ? cached : null;
  }

  function saveTreeResponse(payload) {
    if (!Array.isArray(payload) || !Array.isArray(payload[0]?.tree) || payload[0].tree.length === 0) return;
    writeCache(TREE_CACHE_KEY, payload);
  }

  function savePostsResponse(payload) {
    if (!Array.isArray(payload) || payload.length === 0) return;
    const hasRealPost = payload.some((post) => post && (post.id || post.title || post.created_at));
    if (!hasRealPost) return;
    writeCache(POSTS_CACHE_KEY, payload);
  }

  function cacheJsonFromResponse(response, savePayload) {
    response
      .clone()
      .json()
      .then(savePayload)
      .catch(() => {});
  }

  function makeJsonResponse(payload, sourceResponse = null) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "application/json",
        ...(sourceResponse ? Object.fromEntries(sourceResponse.headers.entries()) : {}),
      },
    });
  }

  function protectTreeResponse(response, sourceUrl) {
    if (!isBlogTreeRequest(sourceUrl)) return response;

    if (!response.ok) {
      const cached = getCachedTreeResponse();
      return cached ? makeJsonResponse(cached, response) : response;
    }

    cacheJsonFromResponse(response, saveTreeResponse);
    return response;
  }

  function protectPostsResponse(response, sourceUrl) {
    if (!isPostsRequest(sourceUrl)) return response;

    if (!response.ok) {
      const cached = getCachedPostsResponse();
      return cached ? makeJsonResponse(cached, response) : response;
    }

    cacheJsonFromResponse(response, savePostsResponse);
    return response;
  }

  function protectBlogResponse(response, sourceUrl) {
    return protectPostsResponse(protectTreeResponse(response, sourceUrl), sourceUrl);
  }

  function getFetchMethod(input, init) {
    return String(init?.method || input?.method || "GET").toUpperCase();
  }

  window.fetch = function patchedBlogFetch(input, init) {
    const sourceUrl = typeof input === "string" ? input : input?.url;
    const method = getFetchMethod(input, init);

    if (method !== "GET") {
      return originalFetch.call(this, input, init);
    }

    try {
      const nextUrl = patchPostsUrl(sourceUrl);
      if (sourceUrl && nextUrl !== sourceUrl) {
        const request = typeof input === "string" ? nextUrl : new Request(nextUrl, input);
        return originalFetch.call(this, request, init).then((response) => protectBlogResponse(response, nextUrl));
      }
    } catch (error) {
      console.warn("blog fetch patch skipped", error);
    }

    return originalFetch.call(this, input, init).then((response) => protectBlogResponse(response, sourceUrl));
  };
})();
