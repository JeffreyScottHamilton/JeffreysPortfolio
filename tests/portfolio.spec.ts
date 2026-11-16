import { expect, test, type Page } from "@playwright/test";
import { certificates, projects } from "../content/portfolio";
import { gallery } from "../content/media";

/** Skip the intro unless a test wants it; optionally start in a mode. */
async function boot(page: Page, mode: "work" | "explore" = "work", intro = false) {
  await page.addInitScript(
    ([m, i]) => {
      if (!i) sessionStorage.setItem("jh-intro-seen", "1");
      if (!sessionStorage.getItem("jh-mode"))
        sessionStorage.setItem("jh-mode", m as string);
    },
    [mode, intro] as const,
  );
}
const errors = (page: Page) => {
  const list: string[] = [];
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => m.type() === "error" && list.push(m.text()));
  return list;
};

test("header: Work/Explore toggle, no dropdown", async ({ page }) => {
  await boot(page);
  const errs = errors(page);
  await page.goto("/");
  const header = page.locator(".site-header");
  await expect(header.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true");
  await expect(header.getByRole("button", { name: "About" })).toHaveAttribute("aria-pressed", "false");
  await expect(header.locator("select, [aria-haspopup], [aria-expanded]")).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("Work: hero copy, eleven projects in order, nine certificates, contact links", async ({ page }) => {
  await boot(page);
  const errs = errors(page);
  await page.goto("/");
  await expect(page.locator("#hero-title")).toHaveAccessibleName(/Jeffrey\s*Hamilton/);
  await expect(page.getByText("I turn ideas into")).toBeVisible();
  const main = page.locator("main");
  const text = (await main.innerText()).replace(/\s+/g, " ");
  let at = 0;
  for (const p of projects) {
    const i = text.indexOf(p.name, at);
    expect(i, `${p.name} after previous project`).toBeGreaterThan(-1);
    at = i;
  }
  for (const c of certificates) {
    const link = page.getByRole("link", { name: `${c.title} certificate, ${c.date}` });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", c.href);
  }
  await expect(page.locator('#contact a[href^="https://github.com/"]')).toHaveCount(1);
  await expect(page.locator('#contact a[href^="mailto:"]')).toHaveCount(1);
  await expect(page.locator('#contact a[href*="linkedin.com"]')).toHaveCount(1);
  await expect(page.locator('main a[href="#"]')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("certificate name shows on keyboard focus", async ({ page }) => {
  await boot(page);
  await page.goto("/");
  const first = page.getByRole("link", { name: new RegExp(`^${certificates[5].title} certificate`) });
  await first.focus();
  await expect(page.getByText(certificates[5].title, { exact: false }).first()).toBeVisible();
});

test("mode switch: dissolve swaps content, persists, and restarts at the top", async ({ page }) => {
  await boot(page);
  await page.goto("/");
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "About" }).click();
  await expect(page.locator("#hero-title")).toHaveAccessibleName(/person behind the projects/i);
  await expect(page.getByRole("button", { name: "About" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1300);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator("#top").getByText("A little of how I got here.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "About" })).toHaveAttribute("aria-pressed", "true");
});

test("Explore: one gallery that cycles every photo with the dot transition and wraps", async ({ page }) => {
  await page.clock.install();
  await boot(page, "explore");
  const errs = errors(page);
  await page.goto("/");
  await expect(page.locator("#top").getByText("A little of how I got here.")).toBeVisible();
  const frame = page.locator("[data-gallery]");
  await expect(frame).toHaveCount(1);
  await frame.scrollIntoViewIfNeeded();
  const seen = new Set<string>();
  for (let i = 0; i <= gallery.length; i++) {
    const src = await frame.locator("img").first().getAttribute("src");
    if (src) seen.add(src.split("?")[0]);
    await page.clock.runFor(7200);
  }
  expect(seen.size).toBe(gallery.length);
  await expect(page.locator('[data-gallery] [aria-label*="ause"]:visible')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("Explore: clicking the photo advances it; the hint shows until the first click", async ({ page }) => {
  await boot(page, "explore");
  const errs = errors(page);
  await page.goto("/");
  const frame = page.locator("[data-gallery]");
  await frame.scrollIntoViewIfNeeded();
  const hint = frame.locator(".photo-wave-hint");
  await expect(hint).toHaveClass(/is-on/, { timeout: 5000 });
  const img = frame.locator("img").first();
  const before = await img.getAttribute("src");
  await frame.locator(".photo-wave-view").click();
  await expect(img).not.toHaveAttribute("src", before ?? "", { timeout: 5000 });
  await expect(hint).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => localStorage.getItem("photo-wave-hint-seen"))).toBe("1");
  // keyboard: the visually hidden Next photo button advances too
  await page.waitForTimeout(2200);
  const now = await img.getAttribute("src");
  await frame.getByRole("button", { name: "Next photo" }).focus();
  await page.keyboard.press("Enter");
  await expect(img).not.toHaveAttribute("src", now ?? "", { timeout: 5000 });
  expect(errs).toEqual([]);
});

for (const width of [390, 768, 1440]) {
  test(`no horizontal overflow at ${width}px in both modes`, async ({ page }) => {
    for (const mode of ["work", "explore"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await boot(page, mode);
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      );
      expect(overflow, `${mode} @${width}`).toBeLessThanOrEqual(0);
    }
  });
}

test("intro plays once with an immediate skip; reduced motion shows the finished hero", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip intro" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(skip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Skip intro" })).toHaveCount(0);
  await page.close();
  const reduced = await browser.newPage({ reducedMotion: "reduce" });
  await reduced.goto("/");
  await expect(reduced.getByRole("button", { name: "Skip intro" })).toHaveCount(0);
  await expect(reduced.locator("#hero-title")).toBeVisible();
  await reduced.close();
});

test("content survives without canvas", async ({ page }) => {
  await boot(page);
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto("/");
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.getByText(projects[10].name).first()).toBeAttached();
});

for (const mode of ["work", "explore"] as const) {
  test(`${mode}: reaching the end loops seamlessly to the top`, async ({ page }) => {
    await boot(page, mode);
    const errs = errors(page);
    await page.goto("/");
    await expect(page.locator("main [data-loop-end]")).toHaveCount(1);
    // scroll like a person (wheel), past the end; the page must wrap to the top
    let wrapped = false,
      deepest = 0;
    for (let i = 0; i < 80 && !wrapped; i++) {
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(60);
      const y = await page.evaluate(() => scrollY);
      if (deepest > 2000 && y < 5) wrapped = true;
      deepest = Math.max(deepest, y);
    }
    expect(wrapped, `wrapped after reaching ${deepest}px`).toBe(true);
    // scrolling back up from the top is just the top; scrolling down works again
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    expect(errs).toEqual([]);
  });
}

test("certificate: click opens it, press-and-drag does not", async ({ page, context }) => {
  await boot(page);
  await page.route("**/*.pdf", (r) => r.fulfill({ status: 200, body: "pdf" }));
  await page.goto("/");
  const box = (await page.locator(".wk-cert-btn").nth(5).boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const opened = context.waitForEvent("page", { timeout: 4000 });
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
  await opened;
  let dragOpened = false;
  context.once("page", () => (dragOpened = true));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 150, cy + 120, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  expect(dragOpened).toBe(false);
});

for (const [width, height] of [
  [390, 664],
  [360, 780],
] as const) {
  test(`phone ${width}×${height}: own composition, no overflow, portrait up top, contact icons in place`, async ({ browser }) => {
    for (const mode of ["work", "explore"] as const) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      const page = await ctx.newPage();
      await boot(page, mode);
      const errs = errors(page);
      await page.goto("/");
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${mode} @${width}: horizontal overflow`).toBeLessThanOrEqual(0);
      // first screen: the hero portrait sits in the upper part of the viewport
      const portrait = page.locator("#top .portrait").first();
      const box = (await portrait.boundingBox())!;
      expect(box.y, `${mode}: portrait top`).toBeLessThan(height * 0.6);
      expect(box.y + box.height, `${mode}: portrait visible on the first screen`).toBeLessThanOrEqual(height);
      // the title overlaps the lower part of the portrait, on the first screen
      const title = (await page.locator("#hero-title").boundingBox())!;
      expect(title.y + title.height).toBeLessThanOrEqual(height);
      expect(title.y).toBeGreaterThan(box.y);
      if (mode === "work") {
        // contact: one screen; the three icons sit inside #contact with ≥ 44px targets
        await page.locator("#contact").scrollIntoViewIfNeeded();
        const c = (await page.locator("#contact").boundingBox())!;
        const links = page.locator("#contact .wk-contact-links a");
        await expect(links).toHaveCount(3);
        for (let i = 0; i < 3; i++) {
          const l = links.nth(i);
          await expect(l).toBeVisible();
          const b = (await l.boundingBox())!;
          expect(b.width).toBeGreaterThanOrEqual(44);
          expect(b.height).toBeGreaterThanOrEqual(44);
          expect(b.x).toBeGreaterThanOrEqual(c.x);
          expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width);
          expect(b.y).toBeGreaterThanOrEqual(c.y);
          expect(b.y + b.height).toBeLessThanOrEqual(c.y + c.height);
        }
        // certificates: one row under a label that opens the full list
        const ys = await page
          .locator("#top .wk-cert")
          .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
        expect(ys.length).toBeGreaterThan(8);
        expect(Math.max(...ys) - Math.min(...ys), "certificates in one row").toBeLessThan(2);
      } else {
        // contact copy is fully formed at rest once it has been reached
        const title = page.locator("#contact .x-c-title");
        await title.scrollIntoViewIfNeeded();
        await expect
          .poll(() => title.evaluate((e) => getComputedStyle(e).getPropertyValue("--dt").trim()))
          .toBe("");
        await expect(page.locator("#contact .x-to-work")).toBeVisible();
      }
      expect(errs).toEqual([]);
      await ctx.close();
    }
  });
}
