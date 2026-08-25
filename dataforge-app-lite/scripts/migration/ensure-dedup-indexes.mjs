#!/usr/bin/env node
/**
 * Re-assert the Lead dedup indexes after a build.
 *
 * Why this exists: vercel.json builds with `prisma db push`, which reconciles the
 * database against prisma/schema.prisma. Both dedup indexes are *expression* indexes
 * (lower(btrim(...)) and regexp_replace(...)), and Prisma's schema language cannot
 * represent those — so they live only in raw SQL (see
 * prisma/migrations/20260825000000_add_lead_dedup_indexes) and a push can drop them as
 * drift, silently removing the phone-uniqueness guarantee.
 *
 * Running this after the push makes the outcome the same either way. Both statements are
 * IF NOT EXISTS, so this is a no-op when the indexes are already in place.
 *
 * Failures never break the build: without these indexes the app still de-duplicates
 * correctly via checkDuplicate() — only the concurrent-insert backstop is missing. A
 * unique-index failure means real duplicate phone numbers need cleaning up first, which
 * is a data task, not a reason to block a deploy. It logs loudly instead.
 */
import pg from 'pg';

// Match the app's own resolution order (src/lib/prisma.ts).
const CONN = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
if (!CONN) {
  console.log('[dedup-indexes] no POSTGRES_PRISMA_URL/DATABASE_URL set — skipping');
  process.exit(0);
}

const STATEMENTS = [
  {
    name: 'Lead_business_name_key_idx',
    sql: `CREATE INDEX IF NOT EXISTS "Lead_business_name_key_idx"
            ON "Lead" (lower(btrim("businessName")))`,
  },
  {
    name: 'Lead_phone_normalized_key',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "Lead_phone_normalized_key"
            ON "Lead" ((regexp_replace("phone", '\\D', '', 'g')))
            WHERE length(regexp_replace("phone", '\\D', '', 'g')) >= 7`,
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    const c = new pg.Client({
      connectionString: CONN,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      query_timeout: 300000,
    });
    c.on('error', () => { /* pooler hangups are handled by the retry below */ });
    try {
      await c.connect();
      return c;
    } catch (e) {
      console.log(`[dedup-indexes] connect ${i}/${attempts} failed: ${e.code || e.message}`);
      try { await c.end(); } catch { /* already dead */ }
      if (i < attempts) await sleep(3000);
    }
  }
  return null;
}

const client = await connect();
if (!client) {
  console.log('[dedup-indexes] WARNING: could not connect; indexes not verified');
  process.exit(0);
}

let failed = 0;
for (const { name, sql } of STATEMENTS) {
  try {
    await client.query(sql);
    const r = await client.query(`select 1 from pg_indexes where schemaname='public' and indexname=$1`, [name]);
    console.log(`[dedup-indexes] ${name}: ${r.rowCount ? 'present' : 'MISSING'}`);
    if (!r.rowCount) failed++;
  } catch (e) {
    failed++;
    console.log(`[dedup-indexes] WARNING: ${name} could not be created: ${e.message}`);
    if (e.code === '23505') {
      console.log('[dedup-indexes] duplicate phone numbers exist — de-duplicate "Lead", then redeploy');
    }
  }
}
await client.end();
console.log(failed ? `[dedup-indexes] ${failed} index(es) not in place` : '[dedup-indexes] all indexes in place');
process.exit(0);
