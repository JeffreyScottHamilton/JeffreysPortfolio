import { test, expect } from "@playwright/test";
test("real point momentum persists, springs recover, particle count stays constant and no color photo opens", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("portfolio-visited", "true");
    const original = WebGLRenderingContext.prototype.bufferSubData;
    WebGLRenderingContext.prototype.bufferSubData = function (...args: any[]) {
      if ((this.canvas as HTMLCanvasElement).closest(".hero")) {
        const values = args[2] as Float32Array;
        let max = 0,
          moving = 0;
        for (let i = 0; i < values.length; i += 2) {
          const d = Math.hypot(values[i], values[i + 1]);
          max = Math.max(max, d);
          if (d > 1) moving++;
        }
        (window as any).points = { max, moving, count: values.length / 2 };
      }
      return Reflect.apply(original, this, args);
    };
  });
  await page.goto("/");
  const portrait = page.locator(".hero .portrait");
  await expect(portrait).toHaveAttribute("data-ready", "true");
  const r = (await portrait.boundingBox())!;
  const baseline = await page.evaluate(() => (window as any).points);
  const image = await page.locator(".hero .portrait-particles").screenshot();
  await page.mouse.move(r.x + r.width * 0.28, r.y + r.height * 0.31);
  for (let i = 0; i < 16; i++) {
    await page.mouse.move(
      r.x + r.width * (0.28 + i * 0.024),
      r.y + r.height * (0.31 + i * 0.006),
    );
    await page.waitForTimeout(18);
  }
  await page.waitForTimeout(120);
  const displaced = await page.evaluate(() => (window as any).points);
  expect(displaced.max).toBeGreaterThan(20);
  expect(displaced.moving).toBeGreaterThan(200);
  expect(displaced.count).toBe(baseline.count);
  expect(
    image.equals(await page.locator(".hero .portrait-particles").screenshot()),
  ).toBe(false);
  const photoAlpha = await page
    .locator(".hero .portrait-photo")
    .evaluate((c: HTMLCanvasElement) => {
      const data = c
        .getContext("2d")!
        .getImageData(0, 0, c.width, c.height).data;
      let total = 0;
      for (let i = 3; i < data.length; i += 4) total += data[i];
      return total;
    });
  expect(photoAlpha).toBe(0);
  await page.mouse.move(30, 90);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).points.max)).toBeGreaterThan(
    2,
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).points.max), {
      timeout: 10000,
    })
    .toBeLessThan(displaced.max * 0.25);
});

test("the same live portrait travels from hero to the opening previews and reverses", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("portfolio-visited", "true"),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator(".hero .portrait")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const portrait = await page.locator(".hero .portrait").elementHandle();
  const first = (await portrait!.boundingBox())!;
  const y = await page
    .locator(".opening-pair")
    .evaluate((el) => el.getBoundingClientRect().top + scrollY - 140);
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
  await expect
    .poll(async () => (await portrait!.boundingBox())!.x)
    .toBeLessThan(0);
  expect((await portrait!.boundingBox())!.y).toBeGreaterThan(0);
  await expect(page.locator(".work-edge")).toBeHidden();
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect
    .poll(async () => Math.abs((await portrait!.boundingBox())!.x - first.x))
    .toBeLessThan(2);
});

test("ribbon points take momentum from the shared flow and reduced motion stops it", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("portfolio-visited", "true"),
  );
  await page.goto("/");
  const ribbon = page.locator(".hero-ribbon");
  await expect(ribbon).toHaveAttribute("data-moving", "true");
  const r = (await ribbon.boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.4, r.y + r.height * 0.65);
  for (let i = 0; i < 16; i++) {
    await page.mouse.move(
      r.x + r.width * (0.4 + i * 0.015),
      r.y + r.height * (0.65 - i * 0.007),
    );
    await page.waitForTimeout(15);
  }
  await expect
    .poll(async () => +((await ribbon.getAttribute("data-energy")) ?? 0))
    .toBeGreaterThan(0.2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ribbon).toHaveAttribute("data-moving", "false");
  await expect(ribbon).toHaveAttribute("data-energy", "0.00");
});
