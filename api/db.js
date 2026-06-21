const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.API_ENV_FILE || '.env.local' });

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return databaseUrl;
  }

  return {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    queueLimit: 0,
  };
}

const pool = mysql.createPool(getDatabaseConfig());

module.exports = { pool };
