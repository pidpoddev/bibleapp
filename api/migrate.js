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

  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'username'`
  );

  if (columns.length === 0) {
    await pool.query('ALTER TABLE users ADD COLUMN username VARCHAR(40) NULL UNIQUE AFTER recovery_id');
  }

  await pool.query(`
    ALTER TABLE encrypted_items
    MODIFY item_type ENUM(
      'account_session',
      'app_settings',
      'bible_reading_progress',
      'daily_mood',
      'journal_index',
      'journal_entry',
      'studio_journal_entry',
      'verse_state_map',
      'verse_design_index',
      'verse_design_timestamps',
      'saved_designs',
      'saved_designs_backup',
      'legacy_saved_designs',
      'shop_entitlements'
    ) NOT NULL
  `);

  await pool.end();
  console.log(`Applied ${statements.length} schema statements.`);
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
