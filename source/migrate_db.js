const Database = require('better-sqlite3');

async function migrate() {
  const sqlite = new Database('helmet.db');
  
  // Dump tables
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Found SQLite tables:", tables.map(t => t.name));
  
  for (const t of tables) {
    if (t.name === 'sqlite_sequence') continue;
    const schema = sqlite.prepare(`SELECT sql FROM sqlite_master WHERE name='${t.name}'`).get();
    console.log(`\nTable ${t.name} schema:\n`, schema.sql);
  }
}

migrate().catch(console.error);
