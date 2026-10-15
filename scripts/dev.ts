import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import process from "node:process";
const port = Number(process.env.PORT ?? 7400); if (!Number.isInteger(port) || port < 7400 || port > 7499) throw new Error("Port must be in 7400–7499");
const root = resolve("site");
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain" };
createServer(async (req, res) => {
 try { const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname); const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
 if (!file.startsWith(`${root}${sep}`)) { res.writeHead(403).end(); return; }
 const body = await readFile(file); res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }); res.end(body);
 } catch { if (!res.headersSent) res.writeHead(404); res.end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Meigen Sports: http://127.0.0.1:${port}/`));
