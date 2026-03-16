/**
 * Normalize a phone number to digits only.
 * Returns empty string if the result has fewer than 7 digits (unparseable).
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
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
