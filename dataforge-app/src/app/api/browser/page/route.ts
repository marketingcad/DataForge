import { NextRequest, NextResponse } from "next/server";
import { createBrowserContext } from "@/lib/crawler/core";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { url: string; click?: { x: number; y: number } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, click } = body;
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  const { browser, context } = await createBrowserContext();
  const page = await context.newPage();

  try {
    // Navigate to the URL
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});

    // If a click was requested, relay it to the page
    if (click) {
      const vp = page.viewportSize() ?? { width: 1280, height: 720 };
      const px = Math.round(click.x * vp.width);
      const py = Math.round(click.y * vp.height);

      await page.mouse.click(px, py);

      // Wait for navigation or dynamic content after click
      await Promise.race([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }),
        page.waitForLoadState("networkidle", { timeout: 5000 }),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ]).catch(() => {});
    }

    const finalUrl  = page.url();
    const title     = await page.title();
    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 72,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });

    return NextResponse.json({
      screenshot: Buffer.from(screenshot).toString("base64"),
      url: finalUrl,
      title,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}
