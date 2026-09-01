#!/usr/bin/env node
/**
 * Dump a Postgres/Supabase database to NDJSON — the producer side of
 * scripts/restore-backup.mjs, which consumes exactly this layout:
 *
 *   <out-dir>/
 *     _manifest.json      createdAt, database (host/db only — never credentials), counts
 *     <Table>.ndjson      one JSON object per row
 *
 *   node scripts/backup.mjs --estimate
 *   node scripts/backup.mjs
 *   node scripts/backup.mjs --out="C:/Users/Dev/Desktop/df-backup" --exclude=DbNotification
 *
 * Options
 *   --estimate       report row counts + on-disk sizes and exit. Costs almost no
 *                    egress: read this BEFORE spending budget on a full dump.
 *   --out=<dir>      output directory (default: Desktop/dataforge-backup-<timestamp>)
 *   --url=<conn>     source connection (default: $DATABASE_URL, else .env.local, else .env)
 *   --only=A,B       dump just these tables
 *   --exclude=A,B    skip these tables
 *   --batch=N        rows per round trip (default 2000)
 *
 * Why a client-side dump rather than pg_dump: the developer's ISP blocks port
 * 5432, so both the direct connection and the session pooler are unreachable,
 * and pg_dump is not supported through the transaction pooler on 6543. This is
 * the only route that works from this network — see CLAUDE.md.
 *
 * Egress is a metered budget on the Free plan (5 GB/month, shared across
 * Database/Auth/Storage/Realtime). A full dump moves roughly the whole database
 * over the wire, so run --estimate first and exclude what you don't need.
 *
 * LIMITATION: each table is internally consistent (primary-key order), but there
 * is no snapshot across tables. A dump taken while the scraper is inserting can
 * hold a child row whose parent landed in a table already written.
 * restore-backup.mjs inserts in FK order with ON CONFLICT DO NOTHING, so that
 * surfaces as a few skipped rows, not a failed restore. Prefer running this with
 * the auto-keyword loop stopped.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const args = new Map();
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args.set(m[1], m[2] ?? true);
}
const ESTIMATE = !!args.get('estimate');
const BATCH = Number(args.get('batch') || 2000);
const ONLY = args.get('only') ? String(args.get('only')).split(',').map((s) => s.trim()) : null;
const EXCLUDE = args.get('exclude') ? String(args.get('exclude')).split(',').map((s) => s.trim()) : [];

/** Read a key out of an env file. Next.js precedence: .env.local wins over .env. */
function fromEnvFile(file, key) {
  const f = path.resolve(file);
  if (!fs.existsSync(f)) return undefined;
  for (const raw of fs.readFileSync(f, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1 || line.slice(0, eq).trim() !== key) continue;
    return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const CONN = args.get('url') || process.env.DATABASE_URL
  || fromEnvFile('.env.local', 'DATABASE_URL') || fromEnvFile('.env', 'DATABASE_URL');

if (!CONN) {
  console.error('error: no connection string (--url=, $DATABASE_URL, .env.local, or .env)');
  process.exit(1);
}

/** Host + database only. Credentials must never reach stdout, a file, or a commit. */
function safeTarget(conn) {
  try {
    const u = new URL(conn);
    return u.hostname + ':' + (u.port || '5432') + u.pathname;
  } catch {
    return 'unknown';
  }
}
const TARGET = safeTarget(CONN);

/**
 * Supabase project ref, taken from the `postgres.<ref>` username. Recorded in the
 * manifest because more than one project is in play: the pooler host and database
 * name are identical across them, so without the ref a backup directory is
 * ambiguous about which database it actually came from.
 */
function projectRef(conn) {
  try {
    const user = decodeURIComponent(new URL(conn).username || '');
    const m = user.match(/^postgres\.([a-z0-9]+)$/);
    return m ? m[1] : null;
  } catch { return null; }
}
const PROJECT = projectRef(CONN);

const isLocal = CONN.includes('localhost') || CONN.includes('127.0.0.1')
  || CONN.includes('sslmode=disable') || CONN.includes('sslmode=prefer');

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = args.get('out')
  || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Desktop', 'dataforge-backup-' + stamp);

// ---------------------------------------------------------------- connection
// This network measures 545-2700 ms to connect with roughly one failure in six,
// so every statement is retried and a dead client is rebuilt from scratch.
let client = null;

async function connect() {
  const c = new pg.Client({
    connectionString: CONN,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
  });
  await c.connect();
  return c;
}

// DNS here fails in bursts lasting tens of seconds — ENOTFOUND is the network,
// not a bad hostname. Backoff has to outlast a burst or the whole run dies inside
// one, so this retries for ~2 minutes rather than the ~8 seconds a 5x500ms
// doubling would give.
const MAX_ATTEMPTS = 9;
const MAX_WAIT_MS = 20_000;

async function q(sql, params = []) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (!client) client = await connect();
      return await client.query(sql, params);
    } catch (err) {
      lastErr = err;
      try { await client?.end(); } catch { /* already gone */ }
      client = null;
      if (attempt < MAX_ATTEMPTS) {
        const wait = Math.min(500 * 2 ** (attempt - 1), MAX_WAIT_MS);
        console.warn('  retry ' + attempt + '/' + (MAX_ATTEMPTS - 1) + ' after '
          + (err.code || err.message) + ' (' + wait + 'ms)');
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------- discovery
async function listTables() {
  // Ordinary base tables in `public`, read from the catalog rather than the Prisma
  // schema, so anything Prisma doesn't model still gets backed up.
  const { rows } = await q(
    "SELECT c.relname AS table, c.reltuples::bigint AS est_rows, " +
    "       pg_total_relation_size(c.oid) AS bytes " +
    "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
    "WHERE n.nspname = 'public' AND c.relkind = 'r' " +
    "ORDER BY pg_total_relation_size(c.oid) DESC"
  );
  return rows.filter((r) => (!ONLY || ONLY.includes(r.table)) && !EXCLUDE.includes(r.table));
}

/** Single-column primary key, if there is one — lets us paginate by keyset. */
async function primaryKey(table) {
  const { rows } = await q(
    "SELECT a.attname FROM pg_index i " +
    "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) " +
    "WHERE i.indrelid = $1::regclass AND i.indisprimary " +
    "ORDER BY array_position(i.indkey, a.attnum)",
    ['"' + table + '"']
  );
  return rows.length === 1 ? rows[0].attname : null;
}

const fmtBytes = (b) => (Number(b) / 1024 / 1024).toFixed(1) + ' MB';

// ---------------------------------------------------------------- estimate
if (ESTIMATE) {
  console.log('source ' + TARGET + (PROJECT ? '  project ' + PROJECT : '') + '\n');
  const tables = await listTables();
  let total = 0n;
  console.log('table'.padEnd(26) + 'est. rows'.padStart(12) + 'size'.padStart(12));
  for (const t of tables) {
    total += BigInt(t.bytes);
    console.log(t.table.padEnd(26) + String(t.est_rows).padStart(12) + fmtBytes(t.bytes).padStart(12));
  }
  console.log('-'.repeat(50));
  console.log('TOTAL'.padEnd(26) + ''.padStart(12) + fmtBytes(total).padStart(12));
  console.log('\nOn-disk size, the rough ceiling on what a full dump costs in egress.');
  console.log('Free-plan budget is 5 GB/month shared across all Supabase services.');
  await client?.end();
  process.exit(0);
}

// ---------------------------------------------------------------- dump
console.log('source ' + TARGET + (PROJECT ? '  project ' + PROJECT : ''));
console.log('out    ' + OUT + '\n');
fs.mkdirSync(OUT, { recursive: true });

const tables = await listTables();
const counts = {};
let grandTotal = 0;

for (const { table } of tables) {
  const pk = await primaryKey(table);
  const file = path.join(OUT, table + '.ndjson');
  const out = fs.createWriteStream(file, { encoding: 'utf8' });
  let written = 0;
  let cursor = null;

  for (;;) {
    // Keyset beats OFFSET here: OFFSET re-scans every skipped row on each page,
    // which on a 261k-row table is quadratic work for the database.
    let result;
    if (pk) {
      result = cursor === null
        ? await q('SELECT * FROM "' + table + '" ORDER BY "' + pk + '" LIMIT ' + BATCH)
        : await q('SELECT * FROM "' + table + '" WHERE "' + pk + '" > $1 ORDER BY "' + pk + '" LIMIT ' + BATCH, [cursor]);
    } else {
      // No usable single-column key — ctid at least gives a stable physical order.
      result = await q('SELECT * FROM "' + table + '" ORDER BY ctid LIMIT ' + BATCH + ' OFFSET ' + written);
    }
    const rows = result.rows;
    if (rows.length === 0) break;

    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        // Buffers would silently become {"0":12,...} through JSON.stringify and
        // restore as garbage. Fail loudly rather than write a corrupt backup.
        if (Buffer.isBuffer(v)) {
          console.error('\nerror: ' + table + '.' + k + ' is binary (bytea); this script cannot encode it safely.');
          process.exit(1);
        }
      }
      out.write(JSON.stringify(row) + '\n');
    }

    written += rows.length;
    if (pk) cursor = rows[rows.length - 1][pk];
    process.stdout.write('\r  ' + table.padEnd(26) + ' ' + written + ' rows');
    if (rows.length < BATCH) break;
  }

  await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
  counts[table] = written;
  grandTotal += written;
  const size = fs.statSync(file).size;
  console.log('\r  ' + table.padEnd(26) + String(written).padStart(8) + ' rows  ' + fmtBytes(size).padStart(10));
}

fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify({
  createdAt: new Date().toISOString(),
  database: TARGET,
  project: PROJECT,
  tables: Object.keys(counts),
  counts,
  totalRows: grandTotal,
}, null, 2));

await client?.end();
console.log('\n' + grandTotal.toLocaleString() + ' rows across ' + Object.keys(counts).length + ' tables -> ' + OUT);
console.log('Verify with: node scripts/restore-backup.mjs --dir="' + OUT + '" --dry-run');
