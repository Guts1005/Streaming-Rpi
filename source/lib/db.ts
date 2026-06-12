import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';

const dbPath = path.join(os.tmpdir(), 'helmet.db');
const db = new Database(dbPath);

export const runQuery = async (sql: string, params: any[] = []): Promise<any> => {
  const stmt = db.prepare(sql);
  const info = stmt.run(params);
  return { id: info.lastInsertRowid, changes: info.changes };
};

export const getQuery = async (sql: string, params: any[] = []): Promise<any> => {
  const stmt = db.prepare(sql);
  return stmt.get(params);
};

export const allQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
  const stmt = db.prepare(sql);
  return stmt.all(params) as any[];
};

async function initDb() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      company_id TEXT,
      customer_id TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT UNIQUE,
      customer_name TEXT,
      company_name TEXT,
      mobile_number TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      device_id TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    )
  `);

  const adminExists = await getQuery(`SELECT id FROM users WHERE username = 'admin'`);
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10);
    await runQuery(`INSERT INTO users (username, password_hash, company_id) VALUES ('admin', ?, 'HQ')`, [hash]);
  }
}

initDb().catch(console.error);

export default db;
