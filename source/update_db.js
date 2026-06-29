const { Pool } = require('pg');
const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '').replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function fixDb() {
  await pool.query("UPDATE ks_devices SET company_id = '1' WHERE id IN (1, 2)");
  await pool.query("UPDATE ks_sites SET company_id = 1 WHERE id IN (1, 2)");
  
  const devices = await pool.query("SELECT * FROM ks_devices WHERE id IN (1, 2)");
  console.table(devices.rows);
  
  pool.end();
}
fixDb().catch(console.error);
