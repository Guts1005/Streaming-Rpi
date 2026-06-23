import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'helmet.db');
let db: any = null;
try {
  // If Vercel env is detected, force readonly mode to avoid EROFS error.
  const isVercel = !!process.env.VERCEL;
  db = new Database(dbPath, { readonly: isVercel });
} catch (e) {
  try {
    // Fallback to readonly if default throws EROFS locally for any reason
    db = new Database(dbPath, { readonly: true });
  } catch (e2) {
    console.warn('Could not load better-sqlite3. Using mocked DB locally.');
  }
}

let initPromise: Promise<void> | null = null;

async function initDb() {
  if (!db) return; // Mocked fallback
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 0,
        site_id TEXT,
        emp_id INTEGER,
        ac TEXT,
        designation TEXT,
        employee_name TEXT,
        username TEXT UNIQUE,
        pw TEXT,
        gender TEXT DEFAULT 'M',
        date_of_birth TEXT DEFAULT '0000-00-00',
        address TEXT,
        branch TEXT,
        bank_name TEXT,
        account_no TEXT,
        ifsc_code TEXT,
        pan_no TEXT,
        salary REAL DEFAULT 0.00,
        contact_01 INTEGER DEFAULT 0,
        contact_02 INTEGER DEFAULT 0,
        email_id TEXT,
        forvendorid TEXT,
        shearing TEXT DEFAULT '0',
        date_joining TEXT DEFAULT '0000-00-00',
        added_date TEXT DEFAULT '0000-00-00',
        updated_date TEXT DEFAULT '0000-00-00',
        actv TEXT DEFAULT 'y',
        User_for TEXT,
        signature TEXT,
        is_android TEXT DEFAULT 'y',
        boq_rate TEXT DEFAULT 'N',
        company_id TEXT
      )
    `).run();

    const usersInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
    const existingCols = usersInfo.map((c: any) => c.name);

    const desiredCols = [
      { name: 'user_id', def: 'INTEGER DEFAULT 0' },
      { name: 'site_id', def: 'TEXT' },
      { name: 'emp_id', def: 'INTEGER' },
      { name: 'ac', def: 'TEXT' },
      { name: 'designation', def: 'TEXT' },
      { name: 'employee_name', def: 'TEXT' },
      { name: 'username', def: 'TEXT UNIQUE' },
      { name: 'pw', def: 'TEXT' },
      { name: 'gender', def: "TEXT DEFAULT 'M'" },
      { name: 'date_of_birth', def: "TEXT DEFAULT '0000-00-00'" },
      { name: 'address', def: 'TEXT' },
      { name: 'branch', def: 'TEXT' },
      { name: 'bank_name', def: 'TEXT' },
      { name: 'account_no', def: 'TEXT' },
      { name: 'ifsc_code', def: 'TEXT' },
      { name: 'pan_no', def: 'TEXT' },
      { name: 'salary', def: 'REAL DEFAULT 0.00' },
      { name: 'contact_01', def: 'INTEGER DEFAULT 0' },
      { name: 'contact_02', def: 'INTEGER DEFAULT 0' },
      { name: 'email_id', def: 'TEXT' },
      { name: 'forvendorid', def: 'TEXT' },
      { name: 'shearing', def: "TEXT DEFAULT '0'" },
      { name: 'date_joining', def: "TEXT DEFAULT '0000-00-00'" },
      { name: 'added_date', def: "TEXT DEFAULT '0000-00-00'" },
      { name: 'updated_date', def: "TEXT DEFAULT '0000-00-00'" },
      { name: 'actv', def: "TEXT DEFAULT 'y'" },
      { name: 'User_for', def: 'TEXT' },
      { name: 'signature', def: 'TEXT' },
      { name: 'is_android', def: "TEXT DEFAULT 'y'" },
      { name: 'boq_rate', def: "TEXT DEFAULT 'N'" },
      { name: 'company_id', def: 'TEXT' }
    ];

    for (const col of desiredCols) {
      if (!existingCols.includes(col.name)) {
        db.prepare(`ALTER TABLE users ADD COLUMN ${col.name} ${col.def}`).run();
      }
    }

    // Ensure 'y' status for testing
    db.prepare(`UPDATE users SET actv = 'y' WHERE actv IS NULL OR actv = ''`).run();

    const seedUser = async (user: string, role: string) => {
      const query = db.prepare('SELECT * FROM users WHERE username = ?').get(user);
      if (!query) {
        const pw = await bcrypt.hash(user + '123', 10);
        db.prepare('INSERT INTO users (username, pw, ac, company_id, actv) VALUES (?, ?, ?, ?, ?)').run(user, pw, role, '8.0', 'y');
      }
    };

    await seedUser('admin', 'Admin');
    await seedUser('site', 'Site');
    await seedUser('sports', 'Sports');
    await seedUser('surveyor', 'Surveyor');

    db.prepare(`
      CREATE TABLE IF NOT EXISTS ks_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cnm TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const companyQuery = db.prepare("SELECT * FROM ks_companies WHERE id = 8 OR cnm = 'Aspire Smart Vision'").get();
    if (!companyQuery) {
      db.prepare("INSERT INTO ks_companies (id, cnm) VALUES (8, 'Aspire Smart Vision')").run();
    }
  } catch (error) {
    console.warn('Vercel Read-Only environment detected, skipping DB writes.');
  }
}

export async function getQuery(sql: string, params: any[] = []) {
  if (!db) return null; // Mocked fallback
  if (!initPromise) initPromise = initDb();
  await initPromise;
  try {
    return db.prepare(sql).get(...params);
  } catch (error) {
    console.error('Database getQuery error:', error);
    throw error;
  }
}

export async function runQuery(sql: string, params: any[] = []) {
  if (!db) return null; // Mocked fallback
  if (!initPromise) initPromise = initDb();
  await initPromise;
  try {
    return db.prepare(sql).run(...params);
  } catch (error) {
    console.error('Database runQuery error:', error);
    throw error;
  }
}

export async function allQuery(sql: string, params: any[] = []) {
  if (!db) return []; // Mocked fallback
  if (!initPromise) initPromise = initDb();
  await initPromise;
  try {
    return db.prepare(sql).all(...params);
  } catch (error) {
    console.error('Database allQuery error:', error);
    throw error;
  }
}
