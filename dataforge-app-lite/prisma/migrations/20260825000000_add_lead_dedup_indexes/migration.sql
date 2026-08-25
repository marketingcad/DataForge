-- Make lead uniqueness a database concern instead of an in-memory one.
--
-- Until now uniqueness was advisory: every scraping job read the whole Lead table into
-- memory (~7.6 MB on the wire at 130k leads) and filtered against that snapshot. It was
-- re-fetched per job, so with auto-run looping it became the app's dominant source of
-- Supabase egress, and it grew with the table. Concurrent jobs (scraperMaxConcurrency
-- defaults to 3, and several devices scrape at once) each held a separate snapshot, so
-- the same business could still be inserted twice.
--
-- 1. Functional index on the business-name key.
--    Serves the name half of checkDuplicate(). Not UNIQUE on purpose: directory scrapes
--    legitimately yield many leads sharing one site-derived name, and a hard constraint
--    would permanently reject a genuinely different business with a colliding name.
--    checkDuplicate() merges those instead, which keeps the guarantee without the
--    false-positive risk.
CREATE INDEX IF NOT EXISTS "Lead_business_name_key_idx"
  ON "Lead" (lower(btrim("businessName")));

-- 2. Unique index on the normalized phone number.
--    Phone is the reliable key, so this one is hard-enforced: it closes the concurrent
--    insert race that checkDuplicate() alone cannot (it reads only committed rows).
--    insertLead() catches the resulting P2002 and reports a duplicate.
--    The expression mirrors normalizePhone() in src/lib/utils/normalize.ts: digits only,
--    meaningful at 7+ digits. Leads with no usable phone (stored as "" or "N/A") are
--    excluded by the WHERE clause, so any number of them can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_phone_normalized_key"
  ON "Lead" ((regexp_replace("phone", '\D', '', 'g')))
  WHERE length(regexp_replace("phone", '\D', '', 'g')) >= 7;
