import { test, expect } from "@playwright/test";
const titles = [
  "Plainkit",
  "Bedulo",
  "Slate",
  "Pollly",
  "Bulletin",
  "Counterpoint",
  "Violet Hour",
  "Minecraft Mods",
  "Signal surf",
  "Ultimatum",
  "Buddy",
];
test("Work: intro, exact project order, assets, certificates and contact", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "JeffreyHamilton",
  );
  await expect(page.getByRole("button", { name: /Skip intro/ })).toBeHidden({
    timeout: 7000,
  });
  await expect(page.locator("#path h3")).toHaveText(titles);
  await expect(page.locator(".certificates a")).toHaveCount(9);
  for (const link of await page.locator(".certificates a").all()) {
    await expect(link).toHaveAttribute("href", /\.pdf$/);
    await expect(link).toHaveAccessibleName(/20\d\d/);
  }
  await page.locator(".certificate").first().focus();
  await expect(page.locator(".certificate .tooltip").first()).toBeVisible();
  for (const img of await page.locator(".preview img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  const planned = page.locator(".project-row").filter({
    has: page.getByRole("heading", { name: "Signal surf", exact: true }),
  });
  await expect(planned.getByRole("link")).toHaveCount(0);
  await expect(
    page.locator("#contact").getByRole("link", { name: "GitHub", exact: true }),
  ).toHaveAttribute("href", "https://github.com/JeffreyHamilton6399");
  expect(errors).toEqual([]);
});
test("mode context mapping, session persistence and home behavior", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("The personbehind theprojects.");
  await expect(page.locator(".gallery")).toHaveCount(1);
  await expect(page.locator(".chapter")).toHaveCount(4);
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("#contact")
        .evaluate((e) => Math.abs(e.getBoundingClientRect().top)),
    )
    .toBeLessThan(150);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: /return to the beginning/ }).click();
  await expect(page.locator("h1")).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Explore", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Skip intro/ })).toHaveCount(0);
});
for (const width of [390, 768, 1440])
  test(`layout and touch targets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(2200);
    for (const mode of ["Work", "Explore"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await page.waitForTimeout(800);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390 && mode === "Work")
        for (const a of await page.locator(".certificate").all()) {
          const r = await a.boundingBox();
          expect(r!.width).toBeGreaterThanOrEqual(44);
          expect(r!.height).toBeGreaterThanOrEqual(44);
        }
    }
  });
test("gallery repeats its character wave for every photo and wraps; focus pauses", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator(".gallery").scrollIntoViewIfNeeded();
  await page.clock.runFor(800);
  const gallery = page.locator(".gallery");
  // One image cycle takes six seconds plus the 900ms character sweep.
  for (let i = 1; i <= 14; i++) {
    await page.clock.runFor(7100);
    await expect(gallery).toHaveAttribute("data-index", String(i % 14));
    await expect
      .poll(() =>
        gallery
          .locator("img")
          .evaluate((e: HTMLImageElement) => e.naturalWidth > 0),
      )
      .toBe(true);
  }
  await gallery.getByRole("button").focus();
  const before = await gallery.getAttribute("data-index");
  await page.clock.runFor(15000);
  await expect(gallery).toHaveAttribute("data-index", before!);
});
test("reduced motion, no canvas support, and stable asset failure fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Skip intro/ })).toHaveCount(0);
  await expect(page.locator(".hero .portrait-fallback")).toBeVisible();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator(".gallery").scrollIntoViewIfNeeded();
  await page.waitForTimeout(7000);
  await expect(page.locator(".gallery")).toHaveAttribute("data-index", "0");
  await page.route("**/media/IMG_2499.jpg", (r) => r.abort());
  await page.reload();
  await page.locator(".gallery").scrollIntoViewIfNeeded();
  await expect(page.locator(".photo-fallback")).toBeVisible();
});
test("portrait reveal shares the exact photo coordinates at multiple pointer positions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Work", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(2100);
  const canvas = page.locator(".hero .portrait canvas");
  const r = (await canvas.boundingBox())!;
  for (const [x, y] of [
    [0.5, 0.35],
    [0.42, 0.46],
    [0.6, 0.55],
  ]) {
    await page.mouse.move(r.x + r.width * x, r.y + r.height * y);
    await page.waitForTimeout(550);
    const error = await canvas.evaluate(
      async (el: HTMLCanvasElement, { x, y }) => {
        const im = new Image();
        im.src = "/media/portrait-original.jpg";
        await im.decode();
        const expected = document.createElement("canvas");
        expected.width = el.width;
        expected.height = el.height;
        const c = expected.getContext("2d")!;
        c.drawImage(
          im,
          100,
          245,
          900,
          1080,
          0,
          0,
          expected.width,
          expected.height,
        );
        const px = Math.floor(x * el.width),
          py = Math.floor(y * el.height);
        const a = c.getImageData(px, py, 1, 1).data,
          b = el.getContext("2d")!.getImageData(px, py, 1, 1).data;
        return [0, 1, 2].reduce((sum, i) => sum + Math.abs(a[i] - b[i]), 0) / 3;
      },
      { x, y },
    );
    expect(error).toBeLessThan(20);
  }
});
test("touch gets the real still portrait without hover; offscreen gallery pauses", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Explore", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
  ).toBe(true);
  await page.getByRole("button", { name: "Explore", exact: true }).tap();
  await page.locator(".gallery").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /return to the beginning/ }).tap();
  await page.waitForTimeout(1000);
  await page.clock.install();
  await page.clock.runFor(15000);
  await expect(page.locator(".gallery")).toHaveAttribute("data-index", "0");
  await context.close();
});

test("portrait background stays clear in both modes, including pointer reveal", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Work", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(2100);
  for (const [mode, color] of [
    ["Work", [6, 7, 7]],
    ["Explore", [250, 247, 240]],
  ] as const) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.waitForTimeout(800);
    const canvas = page.locator(".hero .portrait canvas"),
      rect = (await canvas.boundingBox())!;
    await page.mouse.move(
      rect.x + rect.width * 0.08,
      rect.y + rect.height * 0.1,
    );
    await page.waitForTimeout(550);
    const pixel = await canvas.evaluate((el: HTMLCanvasElement) =>
      Array.from(
        el
          .getContext("2d")!
          .getImageData(
            Math.floor(el.width * 0.08),
            Math.floor(el.height * 0.1),
            1,
            1,
          ).data,
      ),
    );
    expect(pixel[3]).toBe(0);
  }
});
test("gallery pause remains set after keyboard focus leaves", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator(".gallery").scrollIntoViewIfNeeded();
  await page.clock.runFor(900);
  const button = page.locator(".gallery").getByRole("button");
  await button.focus();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await page.locator(".chapter-nav a").first().focus();
  const before = await page.locator(".gallery").getAttribute("data-index");
  await page.clock.runFor(15000);
  await expect(page.locator(".gallery")).toHaveAttribute("data-index", before!);
});
