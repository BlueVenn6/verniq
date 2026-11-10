import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");
const outDir = resolve(projectRoot, "out");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
]);

if (!existsSync(outDir)) {
  console.error(`Static export directory does not exist: ${outDir}`);
  console.error("Run `npm run build` before serving the desktop web bundle.");
  process.exit(1);
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const filePath = await resolveStaticPath(requestUrl.pathname);

    if (!filePath) {
      sendNotFound(response);
      return;
    }

    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      sendNotFound(response);
      return;
    }

    const contentType = mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": fileStats.size,
      "Cache-Control": requestUrl.pathname.startsWith("/_next/static/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Static server failed.");
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${outDir} at http://${host}:${port}`);
});

async function resolveStaticPath(pathname) {
  const decodedPath = decodeURIComponent(pathname).replace(/\\/g, "/");
  const segments = decodedPath.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  const safePath = segments.join("/");
  const candidates = buildCandidates(safePath, decodedPath.endsWith("/"));

  for (const candidate of candidates) {
    const resolved = resolve(outDir, candidate);
    if (!isInsideOutDir(resolved)) continue;
    if (existsSync(resolved)) return resolved;
  }

  return null;
}

function buildCandidates(pathname, isDirectoryRequest) {
  if (!pathname) {
    return ["index.html"];
  }

  if (isDirectoryRequest) {
    return [join(pathname, "index.html")];
  }

  const hasExtension = extname(pathname).length > 0;
  return hasExtension
    ? [pathname]
    : [join(pathname, "index.html"), `${pathname}.html`];
}

function isInsideOutDir(filePath) {
  return filePath === outDir || filePath.startsWith(`${outDir}${sep}`);
}

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  response.end("<!doctype html><title>404</title><h1>404</h1><p>This page could not be found.</p>");
}
