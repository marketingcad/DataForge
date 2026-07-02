// Boss-controlled feature toggles. Client-safe (no server imports) so both the
// sidebar (client) and settings UI can use it.

export type FeatureKey =
  | "overview"
  | "notes"
  | "scripts"
  | "badges"
  | "challenges"
  | "commissions"
  | "balloon"
  | "leads"
  | "scraping";

export const FEATURES: { key: FeatureKey; label: string; description: string }[] = [
  { key: "overview",    label: "Marketing Overview", description: "The marketing metrics overview page." },
  { key: "notes",       label: "Notes",              description: "Team notes." },
  { key: "scripts",     label: "Scripts",            description: "Call scripts." },
  { key: "badges",      label: "Badges",             description: "Badge management." },
  { key: "challenges",  label: "Challenges",         description: "Marketing tasks / challenges." },
  { key: "commissions", label: "Commissions",        description: "Commission management." },
  { key: "balloon",     label: "Balloon Pop",        description: "The balloon pop game." },
  { key: "leads",       label: "Leads",              description: "The Leads department page." },
  { key: "scraping",    label: "Scraping",           description: "Lead scraping tools." },
];

/** Map a nav href (or route path) to its feature key, or null if it isn't toggleable. */
export function featureForHref(href: string): FeatureKey | null {
  const path = href.split("?")[0];
  if (path === "/marketing") return "overview";
  if (path.startsWith("/marketing/notes")) return "notes";
  if (path.startsWith("/marketing/scripts")) return "scripts";
  if (path.startsWith("/marketing/manage/badges")) return "badges";
  if (path.startsWith("/marketing/manage/tasks")) return "challenges";
  if (path.startsWith("/marketing/manage/commissions")) return "commissions";
  if (path.startsWith("/balloons")) return "balloon";
  if (path.startsWith("/leads")) return "leads";
  if (path.startsWith("/scraping")) return "scraping";
  return null;
}

/** True if a nav href points to a feature the boss has disabled. */
export function isHrefDisabled(href: string, disabled: string[]): boolean {
  const key = featureForHref(href);
  return key != null && disabled.includes(key);
}
