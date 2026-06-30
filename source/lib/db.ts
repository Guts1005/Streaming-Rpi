import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING,
  ssl: { rejectUnauthorized: false },
  max: 2, // Limit connections per serverless instance to prevent exceeding Supabase 15-client limit
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let initPromise: Promise<void> | null = null;

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
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
        "User_for" TEXT,
        signature TEXT,
        is_android TEXT DEFAULT 'y',
        boq_rate TEXT DEFAULT 'N',
        company_id INTEGER,
        CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ks_companies (
        id SERIAL PRIMARY KEY,
        cnm TEXT UNIQUE,
        company_name_on_bill TEXT,
        company_address TEXT,
        csd TEXT,
        ced TEXT,
        opening_bal TEXT,
        phone TEXT,
        phone2 TEXT,
        "SMS" TEXT,
        gst_number TEXT,
        registration_no TEXT,
        service_tax_no TEXT,
        tin_no TEXT,
        cst_no TEXT,
        emails TEXT,
        voucher_adjust_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ks_customers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER,
        cnm TEXT,
        city TEXT,
        state TEXT,
        gst_no TEXT,
        actv TEXT DEFAULT 'Y',
        tdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        udate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ks_sites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        company_id INTEGER,
        customer_id INTEGER,
        site_name TEXT,
        address TEXT,
        dlvry_address TEXT,
        client_mail TEXT,
        contact_person1 TEXT,
        contact_person1_mobile TEXT,
        contact_person1_mail TEXT,
        contact_person2 TEXT,
        contact_person2_mobile TEXT,
        contact_person2_mail TEXT,
        actv TEXT DEFAULT 'Y',
        boq_amount TEXT,
        pmc TEXT,
        from_date TEXT,
        end_date TEXT,
        "HOD" TEXT,
        fl TEXT,
        company_logo TEXT,
        "PMC_logo" TEXT,
        our_logo TEXT,
        graph TEXT,
        max_permissible_indents TEXT,
        boq_added TEXT,
        sft TEXT,
        purchase_sft TEXT,
        internal TEXT,
        ongoing TEXT DEFAULT 'Y',
        sft_block TEXT,
        feedback TEXT,
        tdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        udate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sites_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_sites_customer FOREIGN KEY (customer_id) REFERENCES ks_customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ks_devices (
        id SERIAL PRIMARY KEY,
        company_id BIGINT,
        user_id INTEGER,
        site_id INTEGER,
        device_name TEXT,
        device_id VARCHAR(100),
        mac_id VARCHAR(50),
        api_base_url TEXT,
        pairing_token TEXT UNIQUE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ks_devices_company FOREIGN KEY (company_id) REFERENCES ks_companies(id)
      );

      ALTER TABLE ks_devices ADD COLUMN IF NOT EXISTS active TEXT DEFAULT 'Y';
    `);

    // Ensure 'y' status for testing
    await pool.query(`UPDATE users SET actv = 'y' WHERE actv IS NULL OR actv = ''`);

    const seedCompany = async (id: number, name: string) => {
      const res = await pool.query('SELECT * FROM ks_companies WHERE id = $1', [id]);
      if (res.rows.length === 0) {
        // Also check if name exists to avoid UNIQUE constraint violations
        const nameRes = await pool.query('SELECT * FROM ks_companies WHERE cnm = $1', [name]);
        if (nameRes.rows.length === 0) {
          await pool.query('INSERT INTO ks_companies (id, cnm) VALUES ($1, $2)', [id, name]);
        }
      } else {
        // Update name if it's currently Aspire Smart Vision or outdated
        await pool.query('UPDATE ks_companies SET cnm = $2 WHERE id = $1', [id, name]);
      }
    };

    await seedCompany(6, 'Aspire Sports');
    await seedCompany(7, 'Aspire Survey');
    await seedCompany(8, 'Aspire Projects');

    const seedUser = async (user: string, role: string, companyId: string) => {
      const res = await pool.query('SELECT * FROM users WHERE username = $1', [user]);
      if (res.rows.length === 0) {
        const pw = await bcrypt.hash(user + '123', 10);
        await pool.query('INSERT INTO users (username, pw, ac, company_id, actv) VALUES ($1, $2, $3, $4, $5)', [user, pw, role, companyId, 'y']);
      } else {
        // Force update company id to correct one for seed users
        await pool.query('UPDATE users SET company_id = $2 WHERE username = $1', [user, companyId]);
      }
    };

    await seedUser('admin', 'Admin', '8');
    await seedUser('site', 'Site', '8');
    await seedUser('sports', 'Sports', '6');
    await seedUser('surveyor', 'Surveyor', '7');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Convert SQLite ? to Postgres $1, $2
function convertQuery(sql: string) {
  let counter = 1;
  return sql.replace(/\?/g, () => `$${counter++}`);
}

export async function getQuery(sql: string, params: any[] = []) {
  if (!initPromise) initPromise = initDb();
  await initPromise;
  try {
    const res = await pool.query(convertQuery(sql), params);
    return res.rows[0] || null;
  } catch (error) {
    console.error('Database getQuery error:', error);
    throw error;
  }
}

export async function runQuery(sql: string, params: any[] = []) {
  if (!initPromise) initPromise = initDb();
  await initPromise;
  try {
    const res = await pool.query(convertQuery(sql), params);
    return res.rowCount || 0;
  } catch (error) {
    console.error('Database runQuery error:', error);
    throw error;
  }
}

export async function allQuery(sql: string, params: any[] = []) {
  if (!initPromise) initPromise = initDb();
  await initPromise;
  try {
    const res = await pool.query(convertQuery(sql), params);
    return res.rows;
  } catch (error) {
    console.error('Database allQuery error:', error);
    throw error;
  }
}
