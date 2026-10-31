//=============================================================
// TIER 3: DATA TIER
// Owns the schema and all direct reads/writes to storage.
// Nothing outside this file talks to MySQL directly — the
// application tier goes through the functions exported here.
//
// Connects to any MySQL-compatible database, including AWS RDS.
// Credentials come from environment variables so nothing
// sensitive is hardcoded (see .env.example).
// ============================================================

require("dotenv").config();

const mysql = require("mysql2/promise");
const fs = require("fs");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  ssl: process.env.DB_SSL_CA
    ? {
        ca: fs.readFileSync(process.env.DB_SSL_CA),
        rejectUnauthorized: true
      }
    : undefined
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(140) NOT NULL,
      done TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = {
  initSchema,

  async getAllTasks() {
    const [rows] = await pool.query(
      "SELECT * FROM tasks ORDER BY created_at DESC"
    );
    return rows;
  },

  async createTask(title) {
    const [result] = await pool.query(
      "INSERT INTO tasks (title) VALUES (?)",
      [title]
    );

    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE id = ?",
      [result.insertId]
    );

    return rows[0];
  },

  async toggleTask(id) {
    const [result] = await pool.query(
      "UPDATE tasks SET done = NOT done WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) return null;

    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE id = ?",
      [id]
    );

    return rows[0];
  },

  async deleteTask(id) {
    const [result] = await pool.query(
      "DELETE FROM tasks WHERE id = ?",
      [id]
    );

    return result.affectedRows > 0;
  }
};
