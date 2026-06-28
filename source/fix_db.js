const { Pool } = require('pg');

const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '').replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Adding missing columns to ks_companies...");
    await pool.query(`
      ALTER TABLE ks_companies 
      ADD COLUMN IF NOT EXISTS company_name_on_bill TEXT,
      ADD COLUMN IF NOT EXISTS company_address TEXT,
      ADD COLUMN IF NOT EXISTS csd TEXT,
      ADD COLUMN IF NOT EXISTS ced TEXT,
      ADD COLUMN IF NOT EXISTS opening_bal TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS phone2 TEXT,
      ADD COLUMN IF NOT EXISTS "SMS" TEXT,
      ADD COLUMN IF NOT EXISTS gst_number TEXT,
      ADD COLUMN IF NOT EXISTS registration_no TEXT,
      ADD COLUMN IF NOT EXISTS service_tax_no TEXT,
      ADD COLUMN IF NOT EXISTS tin_no TEXT,
      ADD COLUMN IF NOT EXISTS cst_no TEXT,
      ADD COLUMN IF NOT EXISTS emails TEXT,
      ADD COLUMN IF NOT EXISTS voucher_adjust_date TEXT;
    `);
    console.log("ks_companies updated successfully.");

    console.log("Removing device_id from ks_sites...");
    await pool.query(`
      ALTER TABLE ks_sites DROP COLUMN IF EXISTS device_id;
    `);
    console.log("ks_sites updated successfully.");

    console.log("Adding Foreign Key constraints...");
    
    // We first need to make sure the users.company_id data is valid for an integer cast
    // Some old rows might have '' (empty string) or null. Let's set empty strings to null.
    await pool.query(`UPDATE users SET company_id = NULL WHERE company_id = '';`);

    // ks_customers -> ks_companies
    try {
      await pool.query(`ALTER TABLE ks_customers ADD CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE;`);
      console.log("Added FK to ks_customers.");
    } catch (e) {
      console.log("FK ks_customers already exists or error:", e.message);
    }

    // ks_sites -> ks_companies, ks_customers
    try {
      await pool.query(`ALTER TABLE ks_sites ADD CONSTRAINT fk_sites_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE;`);
      console.log("Added FK ks_sites -> ks_companies.");
    } catch (e) {
      console.log("FK ks_sites -> ks_companies error:", e.message);
    }
    
    try {
      await pool.query(`ALTER TABLE ks_sites ADD CONSTRAINT fk_sites_customer FOREIGN KEY (customer_id) REFERENCES ks_customers(id) ON DELETE CASCADE;`);
      console.log("Added FK ks_sites -> ks_customers.");
    } catch (e) {
      console.log("FK ks_sites -> ks_customers error:", e.message);
    }

    // users -> ks_companies
    try {
      // First alter the type from TEXT to INTEGER
      await pool.query(`ALTER TABLE users ALTER COLUMN company_id TYPE INTEGER USING company_id::integer;`);
      await pool.query(`ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES ks_companies(id) ON DELETE CASCADE;`);
      console.log("Added FK users -> ks_companies.");
    } catch (e) {
      console.log("FK users -> ks_companies error:", e.message);
    }

    console.log("All DB fixes applied!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await pool.end();
  }
}

main();
