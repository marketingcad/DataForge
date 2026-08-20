// Forger's knowledge of how DataForge works. Kept concise (token-efficient) but
// complete enough to answer "where is X", "how do I…", and to hand back clickable
// in-app links. Mirrors the How It Works page. Update this when features change.

export const DATAFORGE_KNOWLEDGE = `
DataForge is a desktop sales-operations app: it scrapes business leads, organises them,
and tracks agent performance. It's an Electron app that runs a local server; closing the
window keeps it running in the system tray.

## Roles
- boss: full access + Settings + Feature Toggles + How It Works.
- admin: full access except boss-only Settings/Feature Toggles.
- team_lead / sales_rep: marketing dept (dashboard, marketing, kanban, calendar, reports view, profile).
- lead_specialist: leads dept (leads, scraping) + only categories/keywords explicitly granted to them.

## Pages & routes (use these as clickable links)
- Dashboard — /dashboard — org-wide metrics, charts, quick actions.
- Leads — /leads — the central lead database, organised as Categories → Subcategories → Folders. A category shows an "Ungrouped" bucket for folders with no subcategory. Leads saved to a category with no specific folder go into that category's auto "Ungrouped" folder. There's also a global "Unfiled" list for leads in no folder at all. Open a folder to search/filter/export leads.
- All Leads (list view) — /leads/list — flat, filterable table; /leads/list?folder=unfiled shows folderless leads.
- Add Lead — /leads/new.
- Scraping — /scraping — two methods:
    • Scrape a Website — /scraping?tab=domain — crawl one domain for contacts.
    • Auto Keywords — /scraping?tab=keywords — saved keyword+location pairs in category folders; "Run now" scrapes once, "Auto run" repeats until stopped. (There is NO scheduling/cron and NO "Search by Google" tab anymore.)
- Reports — /reports — per-agent performance heatmap; shareable public link.
- Kanban — /kanban. Calendar — /calendar. Bug Reports — /feedback.
- Marketing — /marketing (overview, leaderboard); Notes — /marketing/notes; Scripts — /marketing/scripts; My Leads — /marketing/my-leads.
- Achievements: Badges — /marketing/manage/badges; Challenges — /marketing/manage/tasks; Commissions — /marketing/manage/commissions; Balloon Pop — /balloons.
- My Commissions — /my-commissions.
- Admin: Users — /admin/users; Fleet — /admin/fleet.
- Account: My Profile — /profile; Settings — /settings (boss); How It Works — /how-it-works (boss/admin).

## Navigation tips
- Left sidebar reaches every page; double-click a sidebar item (or its hover "open in new tab" icon) to open it in a browser-style tab. Tabs persist across restarts.
- The header breadcrumb shows the trail of pages visited in the current tab; the back arrow or Backspace goes back.
- The feather icon (top bar) toggles Lite Mode — fewer animations, lighter on RAM; it's per-user and remembered.

## Leads details
- Every lead is quality-scored 0–100% by completeness (name, phone, email, address, website, category).
- De-dup: incoming leads are matched by phone/business name and discarded if already present.
- CSV export: from a folder you can export all filtered leads or only not-yet-exported ("unexported") ones; exported leads get an export date stamp.
- Scraped leads and GHL-webhook leads are separate; the Leads board shows scraped leads.

## Auto Keywords details
- Each keyword belongs to a category folder; its leads save into that category.
- City rotation and extra-keyword variations help find fresh leads; adaptive backoff throttles keywords that keep returning duplicates.
`.trim();
