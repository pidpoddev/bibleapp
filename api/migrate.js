const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./db');

async function main() {
  const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }

  await pool.end();
  console.log(`Applied ${statements.length} schema statements.`);
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
