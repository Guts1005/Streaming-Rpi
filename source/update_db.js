const Database = require('better-sqlite3');
const db = new Database('./helmet.db');

db.prepare("UPDATE ks_companies SET cnm = 'Aspire Smart Vision' WHERE id = 8").run();
db.prepare("UPDATE ks_companies SET cnm = 'Aspire Smart Vision' WHERE cnm = '8.0'").run();

const companies = db.prepare('SELECT * FROM ks_companies').all();
console.log('Companies:', companies);
