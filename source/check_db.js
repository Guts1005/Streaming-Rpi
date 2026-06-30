require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    let res = await pool.query('SELECT id, user_id, device_name, device_id, api_base_url, status FROM ks_devices');
    console.log("ks_devices:", res.rows);
    res = await pool.query('SELECT id, username, ac, company_id FROM users');
    console.log("users:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
