const { Pool } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: 'postgres://postgres.rydzwvgilyobcixfhfxu:vg4kO0zUiEnL2wPL@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' });
const newUrl = 'https://skiing-estimates-ambient-cadillac.trycloudflare.com';
const query = "UPDATE ks_devices SET api_base_url = $1 WHERE device_name = $2";
pool.query(query, [newUrl, 'Mentor Helmet'])
  .then(res => console.log('Updated rows:', res.rowCount))
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
