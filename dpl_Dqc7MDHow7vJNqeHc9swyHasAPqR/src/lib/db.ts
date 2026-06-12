import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';

const dbPath = path.join(os.tmpdir(), 'helmet.db');
const db = new sqlite3.Database(dbPath);

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const allQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as any[]);
    });
  });
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
