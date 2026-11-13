import { test, expect } from "@playwright/test";
test("work previews enter from the right and the line forms their frames", async ({
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
  const first = page.locator(".opening-pair article").first();
  const x = await first.evaluate(
    (el) => new DOMMatrix(getComputedStyle(el).transform).m41,
  );
  expect(x).toBeGreaterThan(600);
  const top = await page
    .locator(".opening-pair")
    .evaluate((el) => el.getBoundingClientRect().top + scrollY - 130);
  await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), top);
  await expect
    .poll(() =>
      first.evaluate((el) =>
        Math.abs(new DOMMatrix(getComputedStyle(el).transform).m41),
      ),
    )
    .toBeLessThan(2);
  await expect
    .poll(
      async () =>
        +(
          (await page.locator(".opening-ribbon").getAttribute("data-morph")) ??
          0
        ),
    )
    .toBeGreaterThan(0.99);
});

test("cursor adds original warm portrait colors to moving GPU points", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("portfolio-visited", "true");
    const original = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args: any[]) {
      Reflect.apply(original, this, args);
      if (
        (window as any).captureTint &&
        (this.canvas as HTMLCanvasElement).closest(".hero")
      ) {
        (window as any).captureTint = false;
        const pixels = new Uint8Array(
          this.drawingBufferWidth * this.drawingBufferHeight * 4,
        );
        this.readPixels(
          0,
          0,
          this.drawingBufferWidth,
          this.drawingBufferHeight,
          this.RGBA,
          this.UNSIGNED_BYTE,
          pixels,
        );
        let warm = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i] > pixels[i + 1] + 30 &&
            pixels[i + 1] > pixels[i + 2] + 5 &&
            pixels[i + 3] > 60
          )
            warm++;
        (window as any).warmPoints = warm;
      }
    };
  });
  await page.goto("/");
  await expect(page.locator(".hero .portrait")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const r = (await page.locator(".hero .portrait").boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.45);
  await page.waitForTimeout(450);
  await page.evaluate(() => ((window as any).captureTint = true));
  await expect
    .poll(() => page.evaluate(() => (window as any).warmPoints ?? 0))
    .toBeGreaterThan(100);
});
