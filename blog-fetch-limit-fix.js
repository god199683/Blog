(() => {
  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

  const TREE_CACHE_KEY = "blog.cached.tree.response";

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
    const raw = String(value || "");
    return raw.includes("/rest/v1/blog_trees");
  }

  function getCachedTreeResponse() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(TREE_CACHE_KEY) || localStorage.getItem(TREE_CACHE_KEY) || "null");
      if (Array.isArray(cached) && cached[0]?.tree && Array.isArray(cached[0].tree) && cached[0].tree.length > 0) {
        return cached;
      }
    } catch {
      return null;
    }
    return null;
  }

  function saveTreeResponse(payload) {
    try {
      if (!Array.isArray(payload) || !Array.isArray(payload[0]?.tree) || payload[0].tree.length === 0) return;
      const text = JSON.stringify(payload);
      sessionStorage.setItem(TREE_CACHE_KEY, text);
      localStorage.setItem(TREE_CACHE_KEY, text);
    } catch {
      // Ignore blocked storage.
    }
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

  async function protectTreeResponse(response, sourceUrl) {
    if (!isBlogTreeRequest(sourceUrl)) return response;

    if (!response.ok) {
      const cached = getCachedTreeResponse();
      if (cached) return makeJsonResponse(cached, response);
      return response;
    }

    try {
      const clone = response.clone();
      const payload = await clone.json();
      const hasTree = Array.isArray(payload) && Array.isArray(payload[0]?.tree) && payload[0].tree.length > 0;
      if (hasTree) {
        saveTreeResponse(payload);
        return response;
      }
      const cached = getCachedTreeResponse();
      if (cached) return makeJsonResponse(cached, response);
    } catch {
      const cached = getCachedTreeResponse();
      if (cached) return makeJsonResponse(cached, response);
    }

    return response;
  }

  window.fetch = function patchedBlogFetch(input, init) {
    const sourceUrl = typeof input === "string" ? input : input?.url;

    try {
      const nextUrl = patchPostsUrl(sourceUrl);
      if (sourceUrl && nextUrl !== sourceUrl) {
        const request = typeof input === "string" ? nextUrl : new Request(nextUrl, input);
        return originalFetch.call(this, request, init).then((response) => protectTreeResponse(response, nextUrl));
      }
    } catch (error) {
      console.warn("blog fetch patch skipped", error);
    }

    return originalFetch.call(this, input, init).then((response) => protectTreeResponse(response, sourceUrl));
  };
})();
