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

test("header: face home control and Work/Explore toggle, no dropdown", async ({ page }) => {
  await boot(page);
  const errs = errors(page);
  await page.goto("/");
  const header = page.locator(".site-header");
  await expect(header.getByRole("button", { name: "Back to the start" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true");
  await expect(header.getByRole("button", { name: "Explore" })).toHaveAttribute("aria-pressed", "false");
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

test("mode switch: sweep swaps content, persists, and maps contact to contact", async ({ page }) => {
  await boot(page);
  await page.goto("/");
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Explore" }).click();
  await expect(page.locator("#hero-title")).toHaveAccessibleName(/person behind the projects/i);
  await expect(page.getByRole("button", { name: "Explore" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400);
  const box = await page.locator("#contact").boundingBox();
  expect(box && box.y < 900 && box.y + box.height > 0).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("button", { name: "Explore" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Back to the start" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(5);
  await expect(page.getByRole("button", { name: "Explore" })).toHaveAttribute("aria-pressed", "true");
});

test("Explore: one gallery that cycles every photo with the glyph wave and wraps", async ({ page }) => {
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
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(5);
    // scrolling back up from the top is just the top; scrolling down works again
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    expect(errs).toEqual([]);
  });
}
