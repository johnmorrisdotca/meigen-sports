import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 7401;
const root = process.cwd();
const output = `${root}/docs/images`;
const probe = createServer();
await new Promise<void>((resolve, reject) => {
 probe.once("error", reject);
 probe.listen(port, "127.0.0.1", () => probe.close((error) => error ? reject(error) : resolve()));
});
mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ["scripts/dev.ts"], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
 let ready = false;
 for (let attempt = 0; attempt < 80; attempt += 1) {
  try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) { ready = true; break; } } catch { /* wait for the server started by this script */ }
  if (server.exitCode !== null) throw new Error(`Demo server exited with ${server.exitCode}`);
  await delay(100);
 }
 if (!ready) throw new Error("Demo server did not start within eight seconds");
 browser = await chromium.launch();
 for (const shot of [
  { name: "hero-desktop", width: 1280, height: 1000, language: "en" },
  { name: "hero-phone", width: 390, height: 1100, language: "en" },
  { name: "hero-phone-ja", width: 390, height: 1100, language: "ja" },
 ]) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 2, isMobile: shot.width < 500, hasTouch: shot.width < 500, reducedMotion: "reduce" });
  await page.goto(`http://127.0.0.1:${port}/?lang=${shot.language}`);
  await page.locator("#quote").waitFor();
  await page.locator("#history").waitFor();
  await page.screenshot({ path: `${output}/${shot.name}.png`, fullPage: false });
  await page.close();
 }
 console.log(`Screenshots written to ${output}`);
} finally {
 await browser?.close();
 server.kill();
 await new Promise<void>((resolve) => { if (server.exitCode !== null) resolve(); else { server.once("exit", () => resolve()); setTimeout(resolve, 1000); } });
}
