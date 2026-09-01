# The Google Maps scraper — `scrapeGoogleMapsHeadless()`

File: `src/lib/scraping/google/maps-scraper.ts` (browser plumbing in
`src/lib/scraping/crawler/core.ts`).

This is the piece CLAUDE.md §C6 puts fully off-limits. A change that looks harmless here
can halve the leads collected and go unnoticed for days.

---

## 1. Signature — the contract

```ts
export async function scrapeGoogleMapsHeadless(
  keyword: string,
  location: string,
  maxLeads: number,
  onLog?: (msg: string) => void,
  onLead?: (lead: SerpLead, count: number) => Promise<boolean | void> | boolean | void,
  maxRuntimeMs?: number,
  isDuplicate?: (lead: SerpLead) => boolean,   // SYNCHRONOUS — see SKILL.md I1
  skipNames?: Set<string>,                     // SYNCHRONOUS
  isCancelled?: () => boolean | Promise<boolean>,
  overrideCoords?: { latitude: number; longitude: number },
  sharedBrowser?: import("playwright-core").Browser,
  boost?: boolean,
): Promise<SerpLead[]>
```

```ts
export interface SerpLead {
  businessName: string;
  website?: string; phone?: string; email?: string;
  address?: string; city?: string; state?: string;
  rating?: string; hours?: string; snippet?: string; sourceUrl?: string;
}
```

`isDuplicate` and `skipNames` **must stay synchronous**. That constraint is the whole reason
the dedup cache exists.

---

## 2. Setup

**Pacing.** Every delay goes through `paced()`:

```ts
const paced = (ms: number) =>
  boost ? Math.max(40,  Math.round(ms * 0.25))
        : Math.max(120, Math.round(ms * 0.60));
```

Boost ≈ 25 % of nominal (fast, higher block risk); even normal mode runs at 60 % of the
original delays to cut function time. The floors preserve jitter so timing is not perfectly
robotic.

**Query.** The keyword and location are joined in **shuffled** order:

```ts
const searchQuery = location.trim()
  ? [keyword, location.trim()].sort(() => Math.random() - 0.5).join(" ")
  : keyword;
```

**Browser.** With `sharedBrowser`, create only a context inside it
(`createScraperContext`) — the caller owns the browser. Otherwise `createBrowserContext()`
launches a dedicated one. `ownsBrowser = !sharedBrowser`; in `finally`, always close the
context, close the browser only if owned.

**Geolocation.** `coords = overrideCoords ?? getApproxCoords(location)`, then
`grantPermissions(["geolocation"])` + `setGeolocation(coords)`. Without this, Google Maps
biases results to the server's IP (the Philippines), not the searched city.

`getApproxCoords` matches against a `LOCATION_COORDS` table of all 50 US states plus ~15
major cities, **longest key first** so a city beats the state it sits in; falls back to the
continental US centre `{ 39.8283, -98.5795 }`.

**Navigation.** The coordinates go into the URL too, so centring survives a redirect:

```ts
const searchUrl = "https://www.google.com/maps/search/"
  + encodeURIComponent(searchQuery).replace(/%20/g, "+")
  + `/@${coords.latitude},${coords.longitude},11z/`;
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
```

`page.setDefaultTimeout(15000)`. Then dismiss the consent wall
(`Accept all` / `I agree` / `Agree`, 3 s visibility probe, ignore failures).

**Results gate.** `waitForSelector('div[role="feed"]', { timeout: 15000 })`. On failure,
check for a CAPTCHA and return whatever has been collected — never throw.

**CAPTCHA detector**, used at three separate points:

```ts
url.includes("/sorry/") || url.includes("google.com/sorry")
  || body.innerText includes "unusual traffic" | "captcha"
  || document.querySelector('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]')
```

---

## 3. Phase 1 — fast name discovery

No clicks, no detail pages. One `page.evaluate()` per scroll reads **every** visible name
in a single browser round-trip, instead of one Playwright locator call per article.

```ts
const DISCOVERY_TARGET = Math.max(Math.ceil(maxLeads * 1.1), maxLeads + 6);
const PHASE1_MAX_MS = 35_000;
let phase1Stale = 0;

while (allDiscoveredNames.length < DISCOVERY_TARGET && phase1Stale < 5) {
  if (await isCancelled?.()) return leads;
  if (Date.now() - phase1StartedAt >= PHASE1_MAX_MS) break;   // clock starts HERE,
                                                              // not at scraper start, so
                                                              // browser launch doesn't
                                                              // eat the discovery window
  const visibleNames = await page.evaluate(() => {
    const articles = document.querySelectorAll('div[role="feed"] div[role="article"]');
    const names = [];
    for (let i = 0; i < articles.length; i++) {
      const text = articles[i].querySelector(".fontHeadlineSmall")?.innerText?.trim();
      if (text) names.push(text);
    }
    return names;
  });

  // new names reset phase1Stale to 0; none found increments it
  await page.evaluate(() => {
    const feed = document.querySelector('div[role="feed"]');
    if (feed) feed.scrollTop += 1400;
  });
  await sleep(randInt(paced(350), paced(550)));
}
```

The small 1.1× buffer accounts for ~17 % duplicates. It is deliberately tight: Phase 2
scrolls too and picks up late-discovered names, so a bigger buffer would only cost time.

Then build the target set and log it — this log line is the primary diagnostic that the
whole dedup chain is working:

```ts
const toScrape = new Set(
  allDiscoveredNames.filter(n => !skipNames?.has(n.toLowerCase().trim())));
onLog?.(`Phase 1 done: ${allDiscoveredNames.length} found, ${skippedCount} already in DB → ${toScrape.size} to scrape`);
if (toScrape.size === 0) return leads;   // everything already saved
```

---

## 4. Phase 2 — targeted extraction

Scroll back to `scrollTop = 0`, then walk the feed opening panels **only** for new names.

```ts
const seen = new Set<string>();
let staleRounds = 0;
while (leads.length < maxLeads && staleRounds < 4) {
  if (maxRuntimeMs && Date.now() - startedAt >= maxRuntimeMs) break;  // save what we have
  if (await hasCaptcha()) break;                                      // save what we have
  const childDivs = await page.locator('div[role="feed"] > div').all();
  ...
}
```

Per child div:

1. `article = child.locator('div[role="article"]').first()`; skip if not visible.
2. **Check cancellation and the time limit inside this inner loop too** — otherwise a run
   iterating hundreds of already-seen articles without emitting a lead never notices a stop.
3. Name from `.fontHeadlineSmall` (`innerText`, 2 s timeout). Skip empty or already `seen`;
   otherwise add to `seen` and set `gotNewArticle = true`.
4. **Late skip**: `!toScrape.has(name) && skipNames?.has(name.toLowerCase().trim())`
   → log "already in DB" and continue. A name Phase 1 never saw and that is not in
   `skipNames` falls through and gets scraped.
5. **Card website**: read `a[data-value="Website"]`'s href, strip `www.`, reject anything
   containing `google` and anything in `AGGREGATOR_HOSTS` (or a subdomain of one). Keeping
   `yelp.com` here would make every business linking to Yelp share one "website".
6. **Turbo card-mode (boost only).** Parse phone/address/city/state straight from the card's
   text. If a phone is found, emit the lead and `continue` — **skip the detail panel entirely**.
   Trades the panel-only fields (full address, email) for a large speed win; boost-only for
   exactly that reason. Address heuristic: split lines on `·`, skip rating segments
   (`^\d+(\.\d+)?\s*\(`) and hours (`^(Open|Clos|Opens|Permanently)`), require a digit plus a
   street-type token (`St|Ave|Rd|Blvd|Dr|Ln|Way|Hwy|Ste|Suite|Street|Avenue|Road|Drive|Boulevard|Pkwy|Ct|Pl`).
7. **Detail panel** otherwise, under a hard per-lead race:

   ```ts
   const LEAD_TIMEOUT_MS = boost ? 9_000 : 12_000;
   const PANEL_WAIT_MS   = boost ? 3_000 : 4_000;
   await Promise.race([ (async () => { ... })(),
                        sleep(LEAD_TIMEOUT_MS).then(() => { leadTimedOut = true; }) ]);
   ```

   Inside: click the article (`force: true`, 5 s), then `page.waitForFunction` for an element
   whose `aria-label` **equals the business name**, is **outside the feed**, and already
   contains `[data-item-id="address"]` or `[data-tooltip="Copy phone number"]`.
   This single scoped check is what prevents reading a previous business's stale panel.
   Re-check `leadTimedOut` and `hasCaptcha()` between every await.

8. **Extraction**, scoped to that same panel:

   | Field | Selector / rule |
   |---|---|
   | address | `[data-item-id="address"]` → `innerText`, newlines → spaces, strip leading non-alphanumerics (icon glyphs) |
   | phone | `[data-tooltip="Copy phone number"]` → `innerText`, newlines → spaces |
   | website | `[data-tooltip="Open website"]` href → hostname minus `www.`, rejecting `google.`, `goo.gl`, `youtube.`, `facebook.`, `instagram.`, `twitter.`, `x.com` |
   | city/state | walk address parts from the right for `^([A-Z]{2})(\s+\d{5})?$`; state = the match, city = the part before it |

   `website: details.website ?? cardWebsite` — the panel wins, the card is the fallback.

9. **Emit**: if `isDuplicate?.(lead)` → log and drop. Else `leads.push(lead)` and
   `await onLead?.(lead, leads.length)`.

10. **Close the panel**: `Escape`, then wait ≤1.5 s for the feed to be visible again;
    if it is not, `page.goBack()` and re-check for a CAPTCHA.

11. If `leadTimedOut` → log and `continue`.

**CAPTCHA sentinel.** Detection inside the raced async block cannot return from the outer
loop, so it pushes `{ businessName: "\x00CAPTCHA\x00" }`. After the race, if the last lead
is that sentinel, `leads.pop()` and `return leads` — everything collected is kept.

**Scrolling.** If no new article was seen this round, `staleRounds++`, scroll
`scrollTop += 1400`, sleep `randInt(paced(550), paced(850))`. Any new article resets
`staleRounds = 0`. Four consecutive stale rounds end the phase.

Finally: log, `page.close()`, and the `finally` block closes the context (and the browser
only if owned).

---

## 5. Browser and stealth — `crawler/core.ts`

**`launchScraperBrowser()`** — serialised so concurrent scrapes cannot race a launch.

- On Vercel: `@sparticuz/chromium-min` with a pinned pack URL
  (`chromium-v131.0.1-pack.tar`) + `playwright-core`, headless.
- Locally/desktop: `ensureChromiumInstalled()` first — the desktop app no longer bundles
  Chromium (~650 MB); it downloads it once on first scrape into `PLAYWRIGHT_BROWSERS_PATH`,
  guarded by a module-level promise so concurrent scrapes trigger at most one download.
  Then launch with an explicit `executablePath` when a bundled build is found (so Playwright
  never looks for `chrome-headless-shell`), plus:

  ```
  --disable-blink-features=AutomationControlled
  --disable-dev-shm-usage
  --no-sandbox
  --disable-setuid-sandbox
  --window-size=1920,1080
  ```

**`createScraperContext(browser)`** — the cheap unit. Prefer **one browser, N contexts** to
N browsers.

```ts
userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
viewport: { width: 1280, height: 720 },
locale: "en-US",
timezoneId: "America/New_York",
extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
```

then `addInitScript(STEALTH_SCRIPT)`, then a route handler that **aborts `image`, `media`
and `font`** requests and continues everything else. Google Maps pulls heavy imagery and map
tiles; the data lives in the DOM, so blocking these cuts load time substantially and changes
no results. Documents, scripts and stylesheets must be kept — the SPA needs them to build the
feed DOM and for visibility checks.

**`createBrowserContext()`** = launch + one context (own-browser mode).

**Human-like interaction** (used by the SERP path; `sleep`/`randInt` used throughout):
`humanScroll` steps 250–600 px with 300–700 ms pauses to ~75 % of the page, then scrolls
partway back 40 % of the time; `humanMouseMove` makes 2–4 random moves with 80–220 ms pauses.

---

## 6. `extractFromSerp()` — the secondary path

Same file, used by the SERP streaming route rather than the keyword loop. It types the query
character-by-character into Google with 40–110 ms per keystroke, handles the consent wall,
reads `[role="heading"]` results, clicks each to open the sticky popup
(`g-sticky-content-container`), and parses fields out of the popup's text with the shared
`UTILS` script (`realUrl`, `isExternal`, `extractHost`, `parseField`, `parseAddr`).
It tracks `nameOccurrences` so repeated identical headings select the right `nth()` element.
Tier 2 falls back to knowledge panels when zero leads were emitted.

Rebuild this only after the keyword path works — it is not part of the auto-keyword loop.
