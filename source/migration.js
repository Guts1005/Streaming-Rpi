const Database = require('better-sqlite3');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.tmpdir(), 'helmet.db');
const db = new Database(dbPath);

console.log("Before migration:");
console.log(db.prepare("PRAGMA table_info(users)").all().find(c => c.name === 'User_for'));

// Migration SQL to remove DEFAULT
db.transaction(() => {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get().sql;
  
  const newSql = sql
    .replace("CREATE TABLE users", "CREATE TABLE users_new")
    .replace(/User_for TEXT DEFAULT 'Viewer'/, "User_for TEXT")
    .replace(/User_for TEXT DEFAULT "Viewer"/, "User_for TEXT");

  db.prepare(newSql).run();

  const cols = db.prepare("PRAGMA table_info(users_new)").all().map(c => `"${c.name}"`).join(', ');
  db.prepare(`INSERT INTO users_new (${cols}) SELECT ${cols} FROM users`).run();

  db.prepare("DROP TABLE users").run();

  db.prepare("ALTER TABLE users_new RENAME TO users").run();
})();

console.log("After migration:");
console.log(db.prepare("PRAGMA table_info(users)").all().find(c => c.name === 'User_for'));

console.log("Verifying registration...");
const req = new Request('http://localhost:3000/api/users/register', { 
  method: 'POST', 
  body: JSON.stringify({ username: 'default_remove_test', password: 'pw', company_name: 'Aspire', ac: 'Admin' }) 
});
const { POST } = require('./app/api/users/register/route');
POST(req).then(async (res) => {
  const user = db.prepare("SELECT username, ac, User_for FROM users WHERE username='default_remove_test'").get();
  console.log("Registered user:", user);
});
