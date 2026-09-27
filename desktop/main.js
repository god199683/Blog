const { app, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");

let server;

const MIME_TYPES = {
  ".apk": "application/vnd.android.package-archive",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolveAssetPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const root = app.getAppPath();
  const assetPath = path.resolve(root, requested);
  return assetPath.startsWith(root) ? assetPath : null;
}

function startLocalServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const assetPath = resolveAssetPath(request.url || "/");
      if (!assetPath) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      fs.stat(assetPath, (error, stat) => {
        if (error || !stat.isFile()) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }

        const extension = path.extname(assetPath).toLowerCase();
        response.writeHead(200, {
          "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        fs.createReadStream(assetPath).pipe(response);
      });
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}/`);
    });
  });
}

function createWindow(startUrl) {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadURL(startUrl);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1:")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  const startUrl = await startLocalServer();
  createWindow(startUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(startUrl);
  });
}).catch((error) => {
  console.error("Failed to start ciel's Blog:", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  server?.close();
});
