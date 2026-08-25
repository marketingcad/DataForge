#!/usr/bin/env node
/**
 * Restore an NDJSON backup (a directory of <Table>.ndjson files plus _manifest.json)
 * into a Postgres/Supabase database.
 *
 *   node scripts/restore-backup.mjs --dir="C:/Users/Dev/Desktop/dataforge-backup-2026-08-20T21-51-28" --dry-run
 *   node scripts/restore-backup.mjs --dir="<backup dir>" --url="postgresql://...:6543/postgres"
 *
 * Options
 *   --dir=<path>    backup directory containing *.ndjson + _manifest.json   (required)
 *   --url=<conn>    target connection string (defaults to $TARGET_DATABASE_URL)
 *   --dry-run       validate files only; never connects to a database
 *   --truncate      TRUNCATE every target table before loading (destructive)
 *   --only=A,B      restore just these tables
 *
 * Insert order is derived from the target's real foreign-key graph, and every insert uses
 * ON CONFLICT DO NOTHING, so re-running the script is safe and resumable.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import pg from 'pg';

const args = new Map();
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args.set(m[1], m[2] ?? true);
}
const DIR = args.get('dir');
const DRY = !!args.get('dry-run');
const TRUNCATE = !!args.get('truncate');
const ONLY = args.get('only') ? String(args.get('only')).split(',').map((s) => s.trim()) : null;

/**
 * Read TARGET_DATABASE_URL out of .env.migrate if it is not already in the environment,
 * so the target credentials never have to be typed on a command line.
 */
function connFromEnvFile() {
  const f = path.resolve('.env.migrate');
  if (!fs.existsSync(f)) return undefined;
  for (const raw of fs.readFileSync(f, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() === 'TARGET_DATABASE_URL') {
      return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}
const CONN = args.get('url') || process.env.TARGET_DATABASE_URL || connFromEnvFile();

if (!DIR) {
  console.error('error: --dir=<backup directory> is required');
  process.exit(1);
}
if (!DRY && !CONN) {
  console.error('error: --url=<conn> or $TARGET_DATABASE_URL is required (or pass --dry-run)');
  process.exit(1);
}

const manifestPath = path.join(DIR, '_manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
if (manifest) console.log(`backup created ${manifest.createdAt} from ${manifest.database}`);

let files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.ndjson'))
  .map((f) => f.replace(/\.ndjson$/, ''));
if (ONLY) files = files.filter((t) => ONLY.includes(t));

/** Read an ndjson file, yielding parsed objects; throws with the line number on bad JSON. */
async function* readRows(table) {
  const stream = fs.createReadStream(path.join(DIR, `${table}.ndjson`), { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    n++;
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch (e) {
      throw new Error(`${table}.ndjson line ${n}: ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------- dry run
if (DRY) {
  let total = 0;
  let bad = 0;
  for (const t of files.sort()) {
    let n = 0;
    try {
      for await (const row of readRows(t)) { void row; n++; }
    } catch (e) {
      console.log(`  FAIL  ${t}: ${e.message}`);
      bad++;
      continue;
    }
    total += n;
    const expected = manifest?.tables?.[t];
    const mismatch = expected !== undefined && expected !== n;
    if (mismatch) bad++;
    const mark = expected === undefined ? '   ?' : mismatch ? ' DIFF' : '  ok';
    const suffix = mismatch ? ` (manifest says ${expected})` : '';
    console.log(`${mark}  ${t.padEnd(24)} ${String(n).padStart(7)}${suffix}`);
  }
  console.log(`\n${files.length} tables, ${total.toLocaleString()} rows parsed, ${bad} problem(s)`);
  process.exit(bad ? 1 : 0);
}

// ---------------------------------------------------------------- connect + introspect
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Open a connection, retrying transient failures. DNS for the Supabase pooler
 * intermittently fails to resolve on this network, which would otherwise abort a
 * multi-hundred-megabyte load partway through.
 */
async function connect(attempts = 8) {
  for (let i = 1; i <= attempts; i++) {
    const c = new pg.Client({
      connectionString: CONN,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      query_timeout: 900000,
    });
    // A pooler-side disconnect emits 'error' on an idle client; without a listener
    // that becomes an unhandled exception and kills the process.
    c.on('error', (e) => console.log(`  (connection error: ${e.code || e.message})`));
    try {
      await c.connect();
      return c;
    } catch (e) {
      console.log(`  connect attempt ${i}/${attempts} failed: ${e.code || e.message}`);
      try { await c.end(); } catch { /* already dead */ }
      if (i < attempts) await sleep(3000);
    }
  }
  throw new Error(`could not connect after ${attempts} attempts`);
}

let client = await connect();
console.log('connected to target');

/** Run a query, reconnecting and retrying once per attempt if the connection died. */
async function queryWithRetry(sql, params, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await client.query(sql, params);
    } catch (e) {
      const transient =
        ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', '57P01', '08006', '08003'].includes(e.code) ||
        /connection terminated|server closed|socket hang up/i.test(e.message || '');
      if (!transient || i === attempts) throw e;
      console.log(`  retrying after ${e.code || e.message} (${i}/${attempts})`);
      try { await client.end(); } catch { /* already dead */ }
      await sleep(2000);
      client = await connect();
    }
  }
}

const colRes = await client.query(
  `select table_name, column_name, data_type from information_schema.columns
   where table_schema = 'public' order by table_name, ordinal_position`
);
/** table -> Map(column -> data_type) */
const schema = new Map();
for (const r of colRes.rows) {
  if (!schema.has(r.table_name)) schema.set(r.table_name, new Map());
  schema.get(r.table_name).set(r.column_name, r.data_type);
}
if (schema.size === 0) {
  console.error('error: target public schema has no tables - run "prisma migrate deploy" (then "prisma db push") first');
  process.exit(1);
}

const fkRes = await client.query(
  `select ch.relname as child, pa.relname as parent
   from pg_constraint c
   join pg_class ch on ch.oid = c.conrelid
   join pg_class pa on pa.oid = c.confrelid
   join pg_namespace n on n.oid = ch.relnamespace
   where c.contype = 'f' and n.nspname = 'public'`
);

/** Kahn topological sort: parents before children. Cycles fall back to name order. */
function sortTables(tables) {
  const set = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of fkRes.rows) {
    if (child !== parent && set.has(child) && set.has(parent)) deps.get(child).add(parent);
  }
  const out = [];
  const done = new Set();
  while (out.length < tables.length) {
    const ready = tables.filter((t) => !done.has(t) && [...deps.get(t)].every((d) => done.has(d))).sort();
    if (!ready.length) {
      // cycle - emit whatever is left and let ON CONFLICT / a second run sort it out
      out.push(...tables.filter((t) => !done.has(t)).sort());
      break;
    }
    for (const t of ready) {
      out.push(t);
      done.add(t);
    }
  }
  return out;
}

const missing = files.filter((t) => !schema.has(t));
if (missing.length) console.log(`note: no such table in target, skipping: ${missing.join(', ')}`);
const targets = sortTables(files.filter((t) => schema.has(t)));

if (TRUNCATE) {
  console.log(`TRUNCATE ${targets.length} tables...`);
  await client.query(`TRUNCATE ${targets.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

// ---------------------------------------------------------------- load
/** Coerce a value parsed from JSON into what node-postgres should send for this column type. */
function coerce(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'jsonb' || type === 'json') return JSON.stringify(value);
  if (type === 'ARRAY') return Array.isArray(value) ? value : [value];
  return value;
}

const results = [];
for (const table of targets) {
  const types = schema.get(table);
  const batchSize = Math.max(1, Math.min(500, Math.floor(60000 / types.size)));

  let buffer = [];
  let sent = 0;
  const skippedCols = new Set();

  const flush = async () => {
    if (!buffer.length) return;

    // Only name the columns this batch actually carries. Listing every target column
    // and passing NULL for absent ones would override the column's DEFAULT — that is
    // how a backup taken before "timezone" was added to AppSettings turned a defaulted
    // NOT NULL column into a constraint violation.
    const present = [...types.keys()].filter((c) => buffer.some((row) => row[c] !== undefined));
    if (!present.length) {
      // Rows carry nothing we can map; let DEFAULTs build the row entirely.
      for (let i = 0; i < buffer.length; i++) {
        await queryWithRetry(`INSERT INTO "${table}" DEFAULT VALUES ON CONFLICT DO NOTHING`);
      }
      sent += buffer.length;
      buffer = [];
      return;
    }

    const perRow = present.length;
    const colSql = present.map((c) => `"${c}"`).join(', ');
    const params = [];
    const tuples = buffer.map((row, i) => {
      const ph = present.map((c, j) => {
        params.push(coerce(row[c], types.get(c)));
        return `$${i * perRow + j + 1}`;
      });
      return `(${ph.join(', ')})`;
    });
    await queryWithRetry(
      `INSERT INTO "${table}" (${colSql}) VALUES ${tuples.join(', ')} ON CONFLICT DO NOTHING`,
      params
    );
    sent += buffer.length;
    buffer = [];
  };

  let read = 0;
  try {
    for await (const row of readRows(table)) {
      read++;
      for (const k of Object.keys(row)) if (!types.has(k)) skippedCols.add(k);
      buffer.push(row);
      if (buffer.length >= batchSize) {
        await flush();
        if (sent % 10000 === 0) console.log(`   ${table}: ${sent.toLocaleString()} rows...`);
      }
    }
    await flush();
  } catch (e) {
    console.error(`  FAIL  ${table} after ${sent.toLocaleString()} rows: ${e.message}`);
    results.push({ table, read, sent, error: e.message });
    continue;
  }

  const live = await queryWithRetry(`select count(*)::int n from "${table}"`);
  const note = skippedCols.size ? `  [ignored fields not in target: ${[...skippedCols].join(', ')}]` : '';
  console.log(
    `  ok    ${table.padEnd(24)} loaded ${String(sent).padStart(7)}  table now ${String(live.rows[0].n).padStart(7)}${note}`
  );
  results.push({ table, read, sent, live: live.rows[0].n });
}

// ---------------------------------------------------------------- sequences + summary
const seq = await client.query(
  `select c.relname as table_name, a.attname as column_name,
          pg_get_serial_sequence(quote_ident(c.relname), a.attname) as seq
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
   where n.nspname = 'public' and c.relkind = 'r'
     and pg_get_serial_sequence(quote_ident(c.relname), a.attname) is not null`
);
for (const r of seq.rows) {
  await client.query(
    `select setval($1, coalesce((select max("${r.column_name}") from "${r.table_name}"), 0) + 1, false)`,
    [r.seq]
  );
  console.log(`  seq   reset ${r.seq}`);
}

const failed = results.filter((r) => r.error);
const loaded = results.reduce((a, r) => a + r.sent, 0);
console.log(`\n${results.length} tables, ${loaded.toLocaleString()} rows loaded, ${failed.length} failed`);
if (manifest) {
  for (const r of results) {
    const expected = manifest.tables?.[r.table];
    if (expected !== undefined && r.live !== undefined && expected !== r.live) {
      console.log(`  note ${r.table}: target has ${r.live}, manifest recorded ${expected}`);
    }
  }
}
await client.end();
process.exit(failed.length ? 1 : 0);
