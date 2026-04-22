import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { runMigrations } from './schema';

let db: SqlJsDatabase | null = null;
let dbFilePath = '';
let saveTimer: NodeJS.Timeout | null = null;

function findSqlWasm(): string {
  // 1) Ask Node to resolve sql.js's main entry. sql.js's main lives in
  //    node_modules/sql.js/dist/sql-wasm.js — the wasm file is its sibling.
  try {
    const mainPath = require.resolve('sql.js');
    const candidate = path.join(path.dirname(mainPath), 'sql-wasm.wasm');
    if (fs.existsSync(candidate)) return candidate;
  } catch {
    /* fall through to directory walk */
  }

  // 2) Walk up from __dirname looking for node_modules/sql.js/dist/sql-wasm.wasm.
  //    Handles both dev and packaged (asarUnpack) layouts.
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidates = [
      path.join(dir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.join(
        dir,
        'app.asar.unpacked',
        'node_modules',
        'sql.js',
        'dist',
        'sql-wasm.wasm'
      ),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'DutyDojo could not locate sql-wasm.wasm. Make sure "npm install" completed successfully.'
  );
}

export async function initDatabase(filePath: string): Promise<SqlJsDatabase> {
  dbFilePath = filePath;

  const wasmPath = findSqlWasm();
  const wasmBinary = fs.readFileSync(wasmPath);

  const SQL: SqlJsStatic = await initSqlJs({ wasmBinary: wasmBinary.buffer as ArrayBuffer });

  // Load existing DB file if present, otherwise create a new one.
  if (fs.existsSync(filePath)) {
    const bytes = fs.readFileSync(filePath);
    db = new SQL.Database(new Uint8Array(bytes));
  } else {
    // Ensure the directory exists before we try to save.
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  saveDbNow();
  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialised');
  return db;
}

export function getDbFilePath(): string {
  return dbFilePath;
}

/**
 * Persist the in-memory DB to disk immediately.
 */
export function saveDbNow(): void {
  if (!db || !dbFilePath) return;
  const data = db.export();
  const tmpPath = dbFilePath + '.tmp';
  fs.writeFileSync(tmpPath, Buffer.from(data));
  fs.renameSync(tmpPath, dbFilePath);
}

/**
 * Persist the in-memory DB to disk — debounced to coalesce bursts of writes.
 * Call this after every mutation in repositories.
 */
export function saveDb(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      saveDbNow();
    } catch (err) {
      console.error('Failed to save DutyDojo database:', err);
    }
  }, 150);
}
