import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
    trace: "off",
    launchOptions: executablePath
      ? { executablePath, args: ["--no-sandbox"] }
      : { args: ["--no-sandbox"] },
  },
  reporter: "list",
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
