import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
const phase = process.argv[2] || "after",
  only = process.argv[3];
const output = path.resolve("docs/review/motion-fix", phase),
  temporary = path.resolve(tmpdir(), "portfolio-motion-review", phase);
await mkdir(output, { recursive: true });
await mkdir(temporary, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const errors = [];
async function clip(name, action, { fresh = false, mobile = false } = {}) {
  if (only && only !== name) return;
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 },
    hasTouch: mobile,
    isMobile: mobile,
    recordVideo: {
      dir: temporary,
      size: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    },
  });
  if (!fresh)
    await context.addInitScript(() =>
      sessionStorage.setItem("portfolio-visited", "true"),
    );
  const created = Date.now();
  let trim = 0;
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push({ clip: name, message: e.message }));
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  if (!fresh) {
    await page.locator('.hero .portrait[data-ready="true"]').waitFor();
    trim = Math.max(0, (Date.now() - created) / 1000 - 0.2);
  }
  await action(page);
  const video = page.video();
  await context.close();
  const source = path.join(temporary, `${name}.webm`);
  await video.saveAs(source);
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(trim),
    "-i",
    source,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "27",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    path.join(output, `${name}.mp4`),
  ]);
  console.log(`${phase}/${name}.mp4`);
}
await clip(
  "intro",
  async (p) => {
    await p.locator('.hero .portrait[data-ready="true"]').waitFor();
    await p.locator(".skip-intro").waitFor({ state: "hidden", timeout: 15000 });
    await p.waitForTimeout(700);
  },
  { fresh: true },
);
await clip("cursor", async (p) => {
  await p.waitForTimeout(1200);
  const r = await p.locator(".hero .portrait").boundingBox();
  let from = [0.36, 0.32];
  await p.mouse.move(r.x + r.width * from[0], r.y + r.height * from[1]);
  await p.waitForTimeout(450);
  for (const [x, y, duration] of [
    [0.45, 0.34, 700],
    [0.56, 0.4, 700],
    [0.65, 0.46, 600],
    [0.4, 0.48, 130],
    [0.65, 0.3, 130],
    [0.45, 0.5, 160],
    [0.55, 0.38, 550],
  ]) {
    const steps = duration > 500 ? 18 : 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await p.mouse.move(
        r.x + r.width * (from[0] + (x - from[0]) * t),
        r.y + r.height * (from[1] + (y - from[1]) * t),
      );
      await p.waitForTimeout(duration / steps);
    }
    from = [x, y];
  }
  await p.waitForTimeout(700);
  await p.mouse.move(25, 110);
  await p.waitForTimeout(4000);
});
await clip("scroll", async (p) => {
  await p.waitForTimeout(900);
  for (const selector of [
    ".opening-pair",
    ".project-row:nth-of-type(2)",
    ".project-row:nth-of-type(5)",
    ".project-row:last-child",
    "#contact",
  ]) {
    const top = await p
      .locator(selector)
      .evaluate((el) => el.getBoundingClientRect().top + scrollY - 130);
    await p.evaluate(async (target) => {
      const start = scrollY,
        t = performance.now();
      await new Promise((done) => {
        function tick(now) {
          const a = Math.min((now - t) / 1800, 1);
          scrollTo({
            top: start + (target - start) * (a * a * (3 - 2 * a)),
            behavior: "instant",
          });
          if (a < 1) requestAnimationFrame(tick);
          else done();
        }
        requestAnimationFrame(tick);
      });
    }, top);
    await p.waitForTimeout(350);
  }
});
await clip("mode", async (p) => {
  await p.waitForTimeout(1000);
  await p.getByRole("button", { name: "Explore", exact: true }).click();
  await p.waitForFunction(
    () =>
      !document.querySelector(".portfolio")?.classList.contains("switching"),
  );
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Work", exact: true }).click();
  await p.waitForFunction(
    () =>
      !document.querySelector(".portfolio")?.classList.contains("switching"),
  );
  await p.waitForTimeout(500);
});
await clip("photos", async (p) => {
  await p.getByRole("button", { name: "Explore", exact: true }).click();
  await p.locator(".gallery").scrollIntoViewIfNeeded();
  await p.waitForTimeout(15100);
});
await clip("return", async (p) => {
  await p.waitForTimeout(900);
  await p.locator("#contact").scrollIntoViewIfNeeded();
  await p.waitForTimeout(700);
  const top = await p
    .locator(".return-scene")
    .evaluate((el) => el.getBoundingClientRect().top + scrollY - 50);
  await p.evaluate(async (target) => {
    const start = scrollY,
      t = performance.now();
    await new Promise((done) => {
      function tick(now) {
        const a = Math.min((now - t) / 2200, 1);
        scrollTo({ top: start + (target - start) * a, behavior: "instant" });
        if (a < 1) requestAnimationFrame(tick);
        else done();
      }
      requestAnimationFrame(tick);
    });
  }, top);
  await p.waitForTimeout(500);
  await p.mouse.wheel(0, -600);
  await p.waitForTimeout(700);
});
await clip(
  "phone-intro",
  async (p) => {
    await p.locator(".skip-intro").waitFor({ state: "hidden", timeout: 15000 });
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(output, "phone.png") });
  },
  { fresh: true, mobile: true },
);
await clip("photos-loop", async (p) => {
  await p.getByRole("button", { name: "Explore", exact: true }).click();
  await p.locator(".gallery").scrollIntoViewIfNeeded();
  for (let i = 1; i <= 14; i++) {
    await p.waitForFunction(
      (index) =>
        document.querySelector(".gallery")?.getAttribute("data-index") ===
        String(index % 14),
      i,
      { timeout: 12000 },
    );
    console.log(`normal-speed gallery: ${i % 14}`);
  }
  await p.waitForTimeout(1200);
});
await clip("field", async (p) => {
  await p.waitForTimeout(800);
  const r = await p.locator(".hero-ribbon").boundingBox();
  await p.mouse.move(r.x + r.width * 0.18, r.y + r.height * 0.8);
  for (let i = 0; i < 28; i++) {
    await p.mouse.move(
      r.x + r.width * (0.18 + i * 0.02),
      r.y + r.height * (0.8 - i * 0.014),
    );
    await p.waitForTimeout(15);
  }
  await p.waitForTimeout(300);
  await p.mouse.move(35, 100);
  await p.waitForTimeout(3800);
});
await browser.close();
console.log(JSON.stringify({ phase, errors }));
