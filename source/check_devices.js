const { Pool } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: 'postgres://postgres.rydzwvgilyobcixfhfxu:vg4kO0zUiEnL2wPL@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' });
pool.query("SELECT * FROM ks_devices;")
  .then(res => { console.table(res.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
