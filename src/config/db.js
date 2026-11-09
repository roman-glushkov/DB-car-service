const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "autoservice",
  connectionLimit: 5,
  charset: "utf8mb4",
});

async function query(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    return await connection.query(sql, params);
  } finally {
    connection.release();
  }
}

module.exports = { pool, query };
