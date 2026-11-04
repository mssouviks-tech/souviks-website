#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const targets = process.argv.slice(2).map((value) => {
  const split = value.indexOf("=");
  if (split < 1 || split === value.length - 1) {
    throw new Error(`Expected label=url, received: ${value}`);
  }
  return { label: value.slice(0, split), url: value.slice(split + 1) };
});

if (targets.length < 2) {
  throw new Error("Pass at least main=url and PR=url.");
}

function routeForPath(pathname) {
  const route = pathname.replace(/\\/+$/, "") || "/";
  if (route === "/" || route.endsWith("/index.html")) return "Homepage";
  if (/\\/products\\/[^/]+(?:\\.html)?$/i.test(route)) return "Product detail";
  if (/\\/products(?:\\.html)?$/i.test(route)) return "Product listing";
  throw new Error(`Unsupported LCP diagnostic route: ${pathname}`);
}


const outputDir = path.resolve("lcp-diagnostic");
const checkpoints = [1250, 2500, 3750, 5000, 6250];
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage"],
});

try {
  for (const target of targets) {
    // One label can be used for multiple routes (homepage and listing). Keep
    // their reports and checkpoint screenshots separate instead of overwriting.
    const routeKey =
      new URL(target.url).pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") ||
      "home";
    const routeType = routeForPath(new URL(target.url).pathname);

    for (const repeat of [1, 2, 3]) {
      const context = await browser.newContext({
        viewport: { width: 412, height: 823 },
        deviceScaleFactor: 1.75,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);

      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200 * 1024,
        uploadThroughput: 93_750,
        connectionType: "cellular3g",
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

      await page.addInitScript(() => {
        const round = (value) =>
          Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
        window.__souviksLcpDiagnostics = { entries: [], longTasks: [] };

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const element = entry.element;
              const rect = element?.getBoundingClientRect?.();
              window.__souviksLcpDiagnostics.entries.push({
                startTime: round(entry.startTime),
                renderTime: round(entry.renderTime),
                loadTime: round(entry.loadTime),
                size: entry.size,
                url: entry.url || null,
                tagName: element?.tagName || null,
                id: element?.id || null,
                className:
                  typeof element?.className === "string"
                    ? element.className
                    : null,
                decoding: element?.getAttribute?.("decoding") || null,
                loading: element?.getAttribute?.("loading") || null,
                fetchpriority: element?.getAttribute?.("fetchpriority") || null,
                rect: rect
                  ? {
                      top: round(rect.top),
                      left: round(rect.left),
                      width: round(rect.width),
                      height: round(rect.height),
                    }
                  : null,
              });
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch (error) {
          window.__souviksLcpDiagnostics.lcpObserverError = String(error);
        }

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__souviksLcpDiagnostics.longTasks.push({
                startTime: round(entry.startTime),
                duration: round(entry.duration),
              });
            }
          }).observe({ type: "longtask", buffered: true });
        } catch {
          // Long-task observation is optional in older Chromium builds.
        }
      });

      let responseStatus = null;
      let navigationError = null;
      try {
        const response = await page.goto(target.url, {
          waitUntil: "commit",
          timeout: 60_000,
        });
        responseStatus = response?.status() ?? null;
      } catch (error) {
        navigationError = String(error);
      }

      const screenshots = [];
      if (!navigationError) {
        for (const checkpoint of checkpoints) {
          const elapsed = await page.evaluate(() => performance.now());
          if (elapsed < checkpoint) {
            await page.waitForTimeout(checkpoint - elapsed);
          }

          const snapshot = await page.evaluate(() => {
            const round = (value) =>
              Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
            const currentPath = location.pathname.replace(/\\/+$/, "") || "/";
            const route = currentPath === "/" || currentPath.endsWith("/index.html")
              ? "Homepage"
              : /\\/products\\/[^/]+(?:\\.html)?$/i.test(currentPath)
                ? "Product detail"
                : "Product listing";
            const heroSelector = route === "Homepage"
              ? ".home-hero-image"
              : route === "Product detail"
                ? "#pdpMainImage"
                : ".products-hero-media";
            const hero = document.querySelector(heroSelector);
            const rect = hero?.getBoundingClientRect();
            const style = hero ? getComputedStyle(hero) : null;
            const resources = performance
              .getEntriesByType("resource")
              .filter((entry) => /index-hero|product-hero|\\/assets\\/images\\/products\\//i.test(entry.name))              .map((entry) => ({
                name: entry.name,
                startTime: round(entry.startTime),
                responseEnd: round(entry.responseEnd),
                duration: round(entry.duration),
                transferSize: entry.transferSize,
                decodedBodySize: entry.decodedBodySize,
              }));

            return {
              at: round(performance.now()),
              readyState: document.readyState,
              fcp: round(
                performance.getEntriesByName("first-contentful-paint")[0]
                  ?.startTime,
              ),
              lcpEntries:
                window.__souviksLcpDiagnostics?.entries?.slice(-5) || [],
              hero: hero
                ? {
                    currentSrc: hero.currentSrc,
                    complete: hero.complete,
                    naturalWidth: hero.naturalWidth,
                    naturalHeight: hero.naturalHeight,
                    opacity: style?.opacity,
                    visibility: style?.visibility,
                    display: style?.display,
                    rect: rect
                      ? {
                          top: round(rect.top),
                          left: round(rect.left),
                          width: round(rect.width),
                          height: round(rect.height),
                        }
                      : null,
                  }
                : null,
              heroResources: resources,
            };
          });

          const filename = `${target.label}-${routeKey}-r${repeat}-${checkpoint}.png`;
          await page.screenshot({
            path: path.join(outputDir, filename),
            fullPage: false,
            animations: "disabled",
          });
          screenshots.push({ checkpoint, filename, snapshot });
        }

        await page.waitForTimeout(500);
      }

      const final = navigationError
        ? { navigationError }
        : await page.evaluate(() => {
            const round = (value) =>
              Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
            const navigation = performance.getEntriesByType("navigation")[0];
            const currentPath = location.pathname.replace(/\\/+$/, "") || "/";
            const route = currentPath === "/" || currentPath.endsWith("/index.html")
              ? "Homepage"
              : /\\/products\\/[^/]+(?:\\.html)?$/i.test(currentPath)
                ? "Product detail"
                : "Product listing";
            const primarySelector = route === "Homepage"
              ? ".home-hero-image"
              : route === "Product detail"
                ? "#pdpMainImage"
                : ".products-hero-media";
            const primaryElement = document.querySelector(primarySelector);
            const primaryStyle = primaryElement ? getComputedStyle(primaryElement) : null;
            const primaryRect = primaryElement?.getBoundingClientRect();
            const resources = performance
              .getEntriesByType("resource")
              .filter((entry) =>
                /index-hero|product-hero|\\/assets\\/images\\/products\\/|site-base\\.css|index\\.css|products\\.css|product\\.css|fonts\\.(?:googleapis|gstatic)/i.test(entry.name),
              )              .map((entry) => ({
                name: entry.name,
                startTime: round(entry.startTime),
                responseEnd: round(entry.responseEnd),
                duration: round(entry.duration),
                transferSize: entry.transferSize,
                decodedBodySize: entry.decodedBodySize,
              }));

            return {
              url: location.href,
              now: round(performance.now()),
              navigation: navigation
                ? {
                    responseStart: round(navigation.responseStart),
                    domContentLoaded: round(
                      navigation.domContentLoadedEventEnd,
                    ),
                    loadEventEnd: round(navigation.loadEventEnd),
                  }
                : null,
              paint: performance
                .getEntriesByType("paint")
                .map((entry) => ({
                  name: entry.name,
                  startTime: round(entry.startTime),
                })),
              lcpEntries:
                window.__souviksLcpDiagnostics?.entries || [],
              route,
              primaryElement: primaryElement
                ? {
                    selector: primarySelector,
                    id: primaryElement.id || null,
                    className: typeof primaryElement.className === "string" ? primaryElement.className : null,
                    src: primaryElement.getAttribute("src"),
                    currentSrc: primaryElement.currentSrc || null,
                    complete: primaryElement.complete,
                    naturalWidth: primaryElement.naturalWidth,
                    naturalHeight: primaryElement.naturalHeight,
                    loading: primaryElement.getAttribute("loading"),
                    decoding: primaryElement.getAttribute("decoding"),
                    fetchpriority: primaryElement.getAttribute("fetchpriority"),
                    opacity: primaryStyle?.opacity,
                    visibility: primaryStyle?.visibility,
                    display: primaryStyle?.display,
                    rect: primaryRect
                      ? {
                          top: round(primaryRect.top),
                          left: round(primaryRect.left),
                          width: round(primaryRect.width),
                          height: round(primaryRect.height),
                        }
                      : null,
                  }
                : null,
              homepageHero: (() => {
                const target = document.querySelector(".home-hero-image");
                if (!target) return null;
                const style = getComputedStyle(target);
                const rect = target.getBoundingClientRect();
                const center = document.elementFromPoint(
                  Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2)),
                  Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2))
                );
                return {
                  complete: target.complete,
                  naturalWidth: target.naturalWidth,
                  zIndex: style.zIndex,
                  opacity: style.opacity,
                  visibility: style.visibility,
                  display: style.display,
                  centerElement: center?.tagName || null,
                  centerClass: typeof center?.className === "string" ? center.className : null,
                };
              })(),
              longTasks:
                window.__souviksLcpDiagnostics?.longTasks || [],
              heroResources: resources,
            };
          });

      const result = {
        label: target.label,
        repeat,
        routeType,

        requestedUrl: target.url,
        responseStatus,
        screenshots,
        final,
      };
      const jsonName = `${target.label}-${routeKey}-r${repeat}.json`;
      await writeFile(
        path.join(outputDir, jsonName),
        JSON.stringify(result, null, 2) + "\n",
        "utf8",
      );
      console.log(
        JSON.stringify({
          label: target.label,
          repeat,
          routeType,

          responseStatus,
          fcp: final.paint?.find((entry) => entry.name === "first-contentful-paint")
            ?.startTime,
          lcp: final.lcpEntries?.at(-1) || null,
          screenshotCheckpoints: screenshots.map((item) => ({
            requested: item.checkpoint,
            capturedAt: item.snapshot.at,
            heroComplete: item.snapshot.hero?.complete,
            naturalWidth: item.snapshot.hero?.naturalWidth,
          })),
        }),
      );

      await context.close();
    }
  }
} finally {
  await browser.close();
}
