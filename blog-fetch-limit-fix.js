(() => {
  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

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

  window.fetch = function patchedBlogFetch(input, init) {
    try {
      const sourceUrl = typeof input === "string" ? input : input?.url;
      const nextUrl = patchPostsUrl(sourceUrl);
      if (sourceUrl && nextUrl !== sourceUrl) {
        console.info("blog posts limit patched", sourceUrl, "=>", nextUrl);
        if (typeof input === "string") {
          return originalFetch.call(this, nextUrl, init);
        }
        return originalFetch.call(this, new Request(nextUrl, input), init);
      }
    } catch (error) {
      console.warn("blog fetch limit patch skipped", error);
    }
    return originalFetch.call(this, input, init);
  };
})();
