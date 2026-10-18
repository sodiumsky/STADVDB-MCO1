const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || undefined,
};

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000,
  decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
  dateStrings: true,
});

// Used by the header badge. Reads no warehouse table.
async function ping() {
  const [rows] = await pool.query('SELECT 1 AS ok, DATABASE() AS db, VERSION() AS version');
  return { database: rows[0].db, version: rows[0].version, host: config.host, port: config.port };
}

module.exports = { pool, config, ping };
