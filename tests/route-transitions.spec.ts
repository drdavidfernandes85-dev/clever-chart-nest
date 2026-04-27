import { test, expect } from "../playwright-fixture";

/**
 * Smoke test: navigate through the public pages and assert the page
 * never goes fully black/blank during transitions.
 *
 * For each navigation we:
 *   1. Trigger a client-side navigation
 *   2. Sample the document multiple times across the transition window
 *   3. Verify visible text exists at every sample
 *   4. Capture window.__routeMetrics for inspection
 */

const PUBLIC_PATHS = ["/", "/login", "/register"] as const;

test.describe("Route transitions", () => {
  test("public pages stay visible during navigation", async ({ page }) => {
    const navMetrics: Array<{ from: string; to: string; metrics: unknown }> = [];

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    for (let i = 0; i < PUBLIC_PATHS.length; i++) {
      const target = PUBLIC_PATHS[(i + 1) % PUBLIC_PATHS.length];
      const from = page.url();

      await page.evaluate((to) => {
        window.history.pushState({}, "", to);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, target);

      // Sample the DOM 5 times across the next ~600ms — none of them
      // should reveal a fully empty document.
      for (let s = 0; s < 5; s++) {
        const visibleText = await page.evaluate(() => {
          const root = document.getElementById("root");
          return (root?.innerText ?? "").trim().length;
        });
        expect(
          visibleText,
          `screen was empty during navigation to ${target} (sample ${s})`,
        ).toBeGreaterThan(0);
        await page.waitForTimeout(120);
      }

      const metrics = await page.evaluate(
        () => (window as any).__routeMetrics ?? null,
      );
      navMetrics.push({ from, to: target, metrics });
    }

    console.log("[route-metrics report]", JSON.stringify(navMetrics, null, 2));
  });
});
