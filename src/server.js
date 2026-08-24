import { createServer as createHttpServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { createApiHandler } from "./handler.js";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT_ATTEMPTS = 11;

export { createApiHandler } from "./handler.js";

export function createApiServer(options = {}) {
  const handler = createApiHandler(options);

  return createHttpServer(async (request, response) => {
    try {
      if (serveStaticAsset(request, response)) return;
      const webRequest = toWebRequest(request);
      const webResponse = await handler(webRequest);
      response.statusCode = webResponse.status;
      for (const [key, value] of webResponse.headers) response.setHeader(key, value);
      response.end(Buffer.from(await webResponse.arrayBuffer()));
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: error.message || "Unexpected server error." }));
    }
  });
}

function serveStaticAsset(request, response) {
  if (!["GET", "HEAD"].includes(request.method)) return false;

  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const match = pathname.match(/^\/assets\/authors\/([a-z-]+\.png)$/);
  if (!match) return false;

  const assetPath = fileURLToPath(new URL(`../assets/authors/${match[1]}`, import.meta.url));
  const body = readFileSync(assetPath);
  response.statusCode = 200;
  response.setHeader("Content-Type", "image/png");
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.end(request.method === "HEAD" ? undefined : body);
  return true;
}

export async function startApiServer({
  server = createApiServer(),
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
  allowFallback = true,
  maxPort = port + DEFAULT_PORT_ATTEMPTS - 1
} = {}) {
  const lastPort = allowFallback ? maxPort : port;

  for (let candidatePort = port; candidatePort <= lastPort; candidatePort += 1) {
    try {
      await listen(server, candidatePort, host);
      return { server, host, port: candidatePort };
    } catch (error) {
      if (error.code !== "EADDRINUSE" || candidatePort === lastPort) throw error;
    }
  }
}

function toWebRequest(request) {
  const origin = `http://${request.headers.host || "127.0.0.1"}`;
  const hasBody = !["GET", "HEAD"].includes(request.method);
  return new Request(new URL(request.url, origin), {
    method: request.method,
    headers: request.headers,
    body: hasBody ? Readable.toWeb(request) : undefined,
    duplex: hasBody ? "half" : undefined
  });
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("error", onError);
      reject(error);
    };

    server.once("error", onError);
    server.listen({ port, host }, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function readPort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer from 1 through 65535.`);
  }
  return port;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hasExplicitPort = process.env.PORT !== undefined;
  const port = hasExplicitPort ? readPort(process.env.PORT, "PORT") : DEFAULT_PORT;
  const host = process.env.HOST || DEFAULT_HOST;

  startApiServer({ port, host, allowFallback: !hasExplicitPort })
    .then(({ port: activePort }) => {
      console.log(`Post template API listening on http://${host}:${activePort}`);
    })
    .catch((error) => {
      console.error(`Unable to start Post template API: ${error.message}`);
      process.exitCode = 1;
    });
}
