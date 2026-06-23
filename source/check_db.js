const Database = require('better-sqlite3');
const db = new Database('./helmet.db');

const companies = db.prepare('SELECT * FROM ks_companies').all();
console.log('Companies:', companies);

const users = db.prepare('SELECT id, username, company_id FROM users').all();
console.log('Users:', users);
