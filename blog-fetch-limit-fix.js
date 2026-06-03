(() => {
  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

  window.fetch = function patchedBlogFetch(input, init) {
    try {
      const url = typeof input === "string" ? input : input?.url;
      if (url && url.includes("/rest/v1/posts?") && url.includes("limit=100")) {
        const nextUrl = url.replace(/limit=100(?!\d)/g, "limit=1000");
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
