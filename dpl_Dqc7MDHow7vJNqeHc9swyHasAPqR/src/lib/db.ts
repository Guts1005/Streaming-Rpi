import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';

const dbPath = path.join(os.tmpdir(), 'helmet.db');
const db = new Database(dbPath);

let initPromise: Promise<void> | null = null;

async function initDb() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      company_id TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const adminExists = db.prepare(`SELECT id FROM users WHERE username = 'admin'`).get();
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10);
    db.prepare(`INSERT INTO users (username, password_hash, company_id, status) VALUES ('admin', ?, 'HQ', 'active')`).run(hash);
  }
}

export const ensureDb = async () => {
  if (!initPromise) {
    initPromise = initDb();
  }
  return initPromise;
};

export const runQuery = async (sql: string, params: any[] = []): Promise<any> => {
  await ensureDb();
  const stmt = db.prepare(sql);
  const info = stmt.run(params);
  return { id: info.lastInsertRowid, changes: info.changes };
};

export const getQuery = async (sql: string, params: any[] = []): Promise<any> => {
  await ensureDb();
  const stmt = db.prepare(sql);
  return stmt.get(params);
};

export const allQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
  await ensureDb();
  const stmt = db.prepare(sql);
  return stmt.all(params) as any[];
};

export default db;
