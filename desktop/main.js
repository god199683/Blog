const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const http = require("http");
const path = require("path");

let server;
let desktopStartUrl = "";
let mainWindow = null;
const DESKTOP_PORT = 43878;
let updateCheckStarted = false;

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
          // Packaged assets do not change while this app version is running.
          // Caching them avoids re-reading the same large editor bundles on every tab visit.
          "Cache-Control": extension === ".html"
            ? "no-cache"
            : "public, max-age=31536000, immutable",
        });
        fs.createReadStream(assetPath).pipe(response);
      });
    });

    const listen = (port) => {
      const onError = (error) => {
        server.off("error", onError);
        // An older app process can still own the default port. Use a temporary
        // local port instead of showing a blank window and immediately quitting.
        if (error?.code === "EADDRINUSE" && port === DESKTOP_PORT) {
          listen(0);
          return;
        }
        reject(error);
      };
      server.once("error", onError);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", onError);
        const address = server.address();
        resolve(`http://127.0.0.1:${address.port}/`);
      });
    };

    listen(DESKTOP_PORT);
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: "#eff8fc",
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), "assets", "conan-icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  let revealTimer = null;
  let reveal;
  const ready = new Promise((resolve) => {
    reveal = () => {
      if (revealTimer) clearTimeout(revealTimer);
      if (!window.isDestroyed() && !window.isVisible()) window.show();
      resolve(window);
    };
  });
  // Showing only after the splash document is painted prevents a black compositor frame at launch.
  window.webContents.once("did-finish-load", () => setTimeout(reveal, 40));
  revealTimer = setTimeout(reveal, 300);
  window.loadFile(path.join(__dirname, "splash.html"));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (desktopStartUrl && url.startsWith(desktopStartUrl)) {
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
    if (input.key === "Tab") {
      event.preventDefault();
      window.webContents.executeJavaScript(`window.desktopTabs?.cycleTab(${input.shift ? -1 : 1})`);
      return;
    }
    if (input.key.toLowerCase() === "t") {
      event.preventDefault();
      window.webContents.executeJavaScript("window.desktopTabs?.openTab()");
    }
    if (input.key.toLowerCase() === "\\") {
      event.preventDefault();
      window.webContents.executeJavaScript("window.desktopTabs?.toggleSplit()");
    }
  });

  return { window, ready };
}

function loadDesktopShell(window) {
  if (!window || window.isDestroyed() || !desktopStartUrl) return;
  window.loadURL(`${desktopStartUrl}desktop/shell.html`);
}

function startAutomaticUpdates() {
  if (updateCheckStarted || !app.isPackaged) return;
  updateCheckStarted = true;
  autoUpdater.autoDownload = true;
  // A per-user NSIS install can be replaced silently on the next launch.
  // This keeps update installers out of the user's way while they are working.
  autoUpdater.autoInstallEvent = "onNextLaunch";
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.on("error", (error) => {
    // Update checks must never delay or prevent ordinary app startup.
    console.warn("Automatic update check failed:", error?.message || error);
  });
  autoUpdater.on("update-downloaded", () => {
    console.info("A ciel's Blog update is ready and will install when the app closes.");
  });

  // Defer network work until the shell and current tabs are already usable.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn("Automatic update check failed:", error?.message || error);
    });
  }, 12_000);
}

ipcMain.handle("desktop:auto-launch:get", () => app.getLoginItemSettings().openAtLogin === true);
ipcMain.handle("desktop:auto-launch:set", (_event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
    args: [],
  });
  return app.getLoginItemSettings().openAtLogin === true;
});

app.whenReady().then(async () => {
  const created = createWindow();
  mainWindow = created.window;
  const serverReady = startLocalServer();
  const [startUrl] = await Promise.all([serverReady, created.ready]);
  desktopStartUrl = startUrl;
  loadDesktopShell(mainWindow);
  startAutomaticUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nextWindow = createWindow();
      mainWindow = nextWindow.window;
      nextWindow.ready.then(() => loadDesktopShell(mainWindow));
    }
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
