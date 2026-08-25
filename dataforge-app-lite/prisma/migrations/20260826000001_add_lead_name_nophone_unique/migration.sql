-- Close the last concurrent-insert gap for leads that have no usable phone number.
--
-- Lead_phone_normalized_key already guarantees one row per phone number, which covers
-- ~94.8% of leads (125,710 of 132,661). The remaining ~5.2% (6,951 rows) store a blank
-- or too-short phone, so that index does not apply to them and nothing stopped two
-- people scraping the same business at the same moment from inserting it twice:
-- checkDuplicate() only sees committed rows, so both callers pass it.
--
-- This index constrains the business name, but ONLY for rows with no usable phone. That
-- distinction matters: a global unique index on the name is not viable here. 16 names are
-- currently shared by more than one lead — all of them phone-bearing rows, which are
-- legitimately distinct businesses (directory scrapes routinely yield several leads
-- sharing one site-derived name, see the note in src/lib/utils/dedup.ts). Among the
-- phoneless rows, zero names collide, so this applies cleanly.
--
-- insertLead() catches the resulting P2002 and re-runs checkDuplicate() to return the
-- winning row's id, so a lost race still reports a normal "duplicate" result.
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_name_nophone_key"
  ON "Lead" (lower(btrim("businessName")))
  WHERE length(regexp_replace("phone", '\D', '', 'g')) < 7;
