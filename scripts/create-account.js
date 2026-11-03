require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

const mariadb = require("mariadb");
const { hashPassword } = require("../lib/passwords");

const [role, rawEmail, password, rawProfileId] = process.argv.slice(2);
const email = String(rawEmail || "").trim().toLowerCase();
const profileId = rawProfileId ? Number(rawProfileId) : null;

function fail(message) {
  console.error(`\n${message}\n`);
  console.error("Использование:");
  console.error("  node scripts/create-account.js admin admin@example.com Пароль");
  console.error("  node scripts/create-account.js client client@example.com Пароль CLIENT_ID");
  console.error("  node scripts/create-account.js employee master@example.com Пароль EMPLOYEE_ID\n");
  process.exit(1);
}

if (!["admin", "client", "employee"].includes(role)) fail("Укажите роль admin, client или employee.");
if (!/^\S+@\S+\.\S+$/.test(email)) fail("Укажите корректный email.");
if (!password || password.length < 10) fail("Пароль должен содержать минимум 10 символов.");
if (role !== "admin" && (!Number.isSafeInteger(profileId) || profileId <= 0)) {
  fail("Для клиента или сотрудника укажите ID существующей записи в базе.");
}

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "autoservice",
  connectionLimit: 2,
  charset: "utf8mb4",
});

async function main() {
  let connection;
  try {
    connection = await pool.getConnection();
    let clientId = null;
    let employeeId = null;
    let displayName = null;

    if (role === "client") {
      const rows = await connection.query(
        "SELECT client_id, full_name FROM clients WHERE client_id = ?",
        [profileId]
      );
      if (!rows.length) fail(`Клиент с ID ${profileId} не найден.`);
      clientId = profileId;
      displayName = rows[0].full_name;
    }

    if (role === "employee") {
      const rows = await connection.query(
        "SELECT employee_id, full_name FROM employees WHERE employee_id = ?",
        [profileId]
      );
      if (!rows.length) fail(`Сотрудник с ID ${profileId} не найден.`);
      employeeId = profileId;
      displayName = rows[0].full_name;
    }

    await connection.query(
      `INSERT INTO user_accounts (email, password_hash, role, display_name, client_id, employee_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, hashPassword(password), role, displayName, clientId, employeeId]
    );

    console.log(`\nАккаунт ${email} успешно создан.`);
    console.log(`Роль: ${role}`);
    if (clientId) console.log(`Клиент ID: ${clientId}`);
    if (employeeId) console.log(`Сотрудник ID: ${employeeId}`);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.error("Email или профиль уже привязан к другой учётной записи.");
    } else {
      console.error("Не удалось создать аккаунт:", error.message);
    }
    process.exitCode = 1;
  } finally {
    connection?.release();
    await pool.end();
  }
}

main();
