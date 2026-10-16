// The demo's own tests: a real browser, real taps. `pnpm test:demo` builds the demo and runs them.
// The server is scripts/dev.ts on port 7401: this package's block of ports is 7400 to 7499, and tests use 7401 and up.
import { defineConfig, devices } from "@playwright/test";

// This package's ports are 7400 to 7499; tests use 7401 unless TEST_PORT names another (a worktree takes its own).
const port = Number(process.env.TEST_PORT ?? 7401);
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.demo.ts",
  fullyParallel: true,
  forbidOnly: true,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, reducedMotion: "reduce", locale: "en-US" },
  webServer: { command: "node scripts/dev.ts", env: { PORT: String(port) }, url: `http://127.0.0.1:${port}/`, reuseExistingServer: false },
  projects: [
    { name: "chromium-phone", use: { ...devices["Desktop Chrome"], ...phone } },
    { name: "chromium-desk", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    // WebKit on a desktop viewport with touch: `isMobile` is Chromium's to honour.
    { name: "webkit-phone", use: { ...devices["Desktop Safari"], viewport: phone.viewport, hasTouch: true } },
  ],
});
