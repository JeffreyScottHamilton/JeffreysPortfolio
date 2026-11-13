import { test, expect } from "@playwright/test";
test("header has only modes; Explore keeps the same particle canvas fully colored without hover", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("portfolio-visited", "true");
    const original = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args: any[]) {
      Reflect.apply(original, this, args);
      const label = (window as any).capturePalette;
      if (label && (this.canvas as HTMLCanvasElement).closest(".hero")) {
        (window as any).capturePalette = null;
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
        let colored = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i] - pixels[i + 1] > 30 &&
            pixels[i + 1] - pixels[i + 2] > 5 &&
            pixels[i + 3] > 60
          )
            colored++;
        ((window as any).paletteSamples ??= {})[label] = {
          colored,
          points: args[2],
        };
      }
    };
  });
  await page.goto("/");
  await expect(page.locator(".hero .portrait")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".header img")).toHaveCount(0);
  await expect(page.locator(".header button")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Back to top" })).toHaveAttribute(
    "href",
    "#top",
  );
  const canvas = await page
    .locator(".hero .portrait-particles")
    .elementHandle();
  await page.evaluate(() => ((window as any).capturePalette = "work"));
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).paletteSamples?.work?.colored),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator(".portfolio")).toHaveClass(/explore/);
  await expect(page.locator(".portfolio")).not.toHaveClass(/switching/);
  await page.evaluate(() => ((window as any).capturePalette = "explore"));
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).paletteSamples?.explore?.colored ?? 0,
      ),
    )
    .toBeGreaterThan(500);
  expect(
    await canvas!.evaluate(
      (el) => el === document.querySelector(".hero .portrait-particles"),
    ),
  ).toBe(true);
  const samples = await page.evaluate(() => (window as any).paletteSamples);
  expect(samples.explore.points).toBe(samples.work.points);
  await page.screenshot({
    path: "/workspace/scratch/light-colored-portrait.png",
  });
});
