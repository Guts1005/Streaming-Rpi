const { Pool } = require('pg');

const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '').replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const users = await pool.query('SELECT id, username, ac, company_id FROM users');
    console.log("USERS:");
    console.table(users.rows);

    const companies = await pool.query('SELECT id, cnm FROM ks_companies');
    console.log("COMPANIES:");
    console.table(companies.rows);
    
    const customers = await pool.query('SELECT id, cnm, company_id FROM ks_customers');
    console.log("CUSTOMERS:");
    console.table(customers.rows);

    const sites = await pool.query('SELECT id, site_name, company_id, customer_id FROM ks_sites');
    console.log("SITES:");
    console.table(sites.rows);

  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}
main();
