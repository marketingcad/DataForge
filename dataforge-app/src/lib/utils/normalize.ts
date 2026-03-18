/**
 * Normalize a phone number to digits only.
 * Returns empty string if the result has fewer than 7 digits (unparseable).
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

/**
 * Format a normalized (digits-only) phone number for display.
 * 11 digits starting with 1 → +1 (XXX) XXX-XXXX
 * 10 digits                  → (XXX) XXX-XXXX
 * other                      → original string unchanged
 */
export function formatPhone(digits: string): string {
  if (!digits) return digits;
  const d = digits.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return digits;
}

/**
 * Normalize an email address to lowercase trimmed string.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Normalize a website URL to its root domain (no protocol, no www, no path).
 * Returns empty string for unparseable or empty inputs.
 *
 * Examples:
 *   https://www.johndoe.com/about → johndoe.com
 *   http://example.com/           → example.com
 *   www.test.co.uk                → test.co.uk
 */
export function normalizeWebsite(raw: string): string {
  if (!raw || raw.trim() === "") return "";

  let url = raw.trim();

  // Prepend protocol if missing so URL() can parse it
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  try {
    const parsed = new URL(url);
    // Remove www. prefix
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}
