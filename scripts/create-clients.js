require("dotenv").config({
  path: require("node:path").join(__dirname, "..", ".env"),
});
const mariadb = require("mariadb");
const { hashPassword } = require("../lib/passwords");

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "autoservice",
  connectionLimit: 5,
  charset: "utf8mb4",
});

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("Подключение к базе...");

    // 1. Обновляем пустые email
    await conn.query(`
      UPDATE clients 
      SET email = CONCAT('client_', client_id, '@autopro.ru') 
      WHERE email IS NULL OR email = ''
    `);

    // 2. Получаем всех клиентов, у которых еще нет аккаунта
    const clients = await conn.query(`
      SELECT c.client_id, c.email, c.full_name 
      FROM clients c 
      LEFT JOIN user_accounts ua ON ua.client_id = c.client_id 
      WHERE ua.account_id IS NULL
    `);

    console.log(`Найдено клиентов без аккаунта: ${clients.length}`);
    const passwordHash = hashPassword("qwerty1234");

    for (const client of clients) {
      await conn.query(
        "INSERT INTO user_accounts (email, password_hash, role, client_id, display_name) VALUES (?, ?, 'client', ?, ?)",
        [client.email, passwordHash, client.client_id, client.full_name]
      );
      console.log(`Создан аккаунт: ${client.email}`);
    }

    console.log("Готово! Все клиенты могут войти с паролем qwerty1234");
  } catch (error) {
    console.error("Ошибка:", error.message);
  } finally {
    conn?.release();
    await pool.end();
  }
}

main();
