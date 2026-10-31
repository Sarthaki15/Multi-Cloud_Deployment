require("dotenv").config();

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    ssl: {
        rejectUnauthorized: false
    }
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
            "SELECT * FROM tasks ORDER BY id DESC"
        );
        return rows;
    },

    async createTask(title) {
        const [result] = await pool.query(
            "INSERT INTO tasks (title) VALUES (?)",
            [title]
        );
        return result.insertId;
    },

    async toggleTask(id) {
        const [result] = await pool.query(
            "UPDATE tasks SET done = NOT done WHERE id = ?",
            [id]
        );
        return result.affectedRows > 0;
    },

    async deleteTask(id) {
        const [result] = await pool.query(
            "DELETE FROM tasks WHERE id = ?",
            [id]
        );
        return result.affectedRows > 0;
    }
};
