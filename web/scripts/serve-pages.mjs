import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const known = {
  "index.html": "text/html; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
  "styles.css": "text/css; charset=utf-8",
  "brand.png": "image/png",
};
const port = Number(process.env.PORT || 3201);
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw Error("Invalid preview port.");
await readFile(".pages/index.html");
createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) return response.writeHead(405).end();
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  if (path === "/" || path === "/K45movies") return response.writeHead(302, { Location: "/K45movies/" }).end();
  const key = path === "/K45movies/" ? "index.html" : path.replace(/^\/K45movies\//, "");
  if (!Object.hasOwn(known, key)) return response.writeHead(404).end();
  try {
    const bytes = await readFile(".pages/" + key);
    response.writeHead(200, { "Content-Type": known[key], "X-Content-Type-Options": "nosniff", "Content-Length": bytes.length });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch { response.writeHead(404).end(); }
}).listen(port, "127.0.0.1", () => console.log("Static preview at http://127.0.0.1:" + port + "/K45movies/"));
