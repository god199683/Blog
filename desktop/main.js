const { app, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");

let server;
const DESKTOP_PORT = 43878;

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
    server.listen(DESKTOP_PORT, "127.0.0.1", () => {
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
    icon: path.join(app.getAppPath(), "assets", "ciel-cat.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadURL(`${startUrl}desktop/shell.html`);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(startUrl)) {
      window.webContents.executeJavaScript(`window.desktopTabs?.openTab(${JSON.stringify(url)})`);
      return { action: "deny" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
      event.preventDefault();
      window.webContents.executeJavaScript("window.desktopTabs?.refreshActiveTab()");
      return;
    }
    if (!input.control) return;
    if (input.key.toLowerCase() === "t") {
      event.preventDefault();
      window.webContents.executeJavaScript("window.desktopTabs?.openTab()");
    }
    if (input.key.toLowerCase() === "\\") {
      event.preventDefault();
      window.webContents.executeJavaScript("window.desktopTabs?.toggleSplit()");
    }
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
