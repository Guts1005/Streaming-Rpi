require('dotenv').config({path: '.env.local'});
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL_NON_POOLING.replace('?sslmode=require', ''), 
  ssl: { rejectUnauthorized: false } 
});

async function run() {
  try {
    const userRes = await pool.query("SELECT id, username FROM users ORDER BY id DESC LIMIT 1");
    if (userRes.rows.length === 0) {
      console.log("No users found");
      return;
    }
    const userId = userRes.rows[0].id;
    
    // Create site if none exists
    let siteId;
    const siteRes = await pool.query("SELECT id FROM ks_sites WHERE user_id = $1 LIMIT 1", [userId]);
    if (siteRes.rows.length === 0) {
       const user = await pool.query("SELECT company_id, username FROM users WHERE id = $1", [userId]);
       const newSite = await pool.query("INSERT INTO ks_sites (user_id, company_id, site_name) VALUES ($1, $2, $3) RETURNING id", [userId, user.rows[0].company_id, user.rows[0].username + "'s Helmet"]);
       siteId = newSite.rows[0].id;
    } else {
       siteId = siteRes.rows[0].id;
    }
    
    await pool.query("INSERT INTO ks_devices (user_id, site_id, device_name, api_base_url, status) VALUES ($1, $2, $3, $4, 'active')", [userId, siteId, 'Dev Pi', 'http://192.168.0.138:5000']);
    
    console.log('Inserted device for user: ' + userRes.rows[0].username + ' with site ' + siteId);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
