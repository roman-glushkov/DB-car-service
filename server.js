require("dotenv").config();
const express = require("express");
const mariadb = require("mariadb");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

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
  const conn = await pool.getConnection();
  try {
    return await conn.query(sql, params);
  } finally {
    conn.release();
  }
}

const route = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);

app.use(express.static(__dirname));

// ---------- проверка соединения ----------
app.get(
  "/api/health",
  route(async (_req, res) => {
    const [row] = await query("SELECT DATABASE() AS db");
    res.json({ ok: true, db: row.db });
  })
);

// ---------- клиенты ----------
app.get(
  "/api/clients",
  route(async (_req, res) => {
    res.json(
      await query(`
        SELECT c.client_id, c.full_name, c.phone, c.email,
               GROUP_CONCAT(CONCAT(car.brand, ' ', car.model, ' · ', COALESCE(car.license_plate, 'без номера'))
                            ORDER BY car.car_id SEPARATOR ', ') AS cars
        FROM clients c
        LEFT JOIN cars car ON car.client_id = c.client_id
        GROUP BY c.client_id
        ORDER BY c.full_name
      `)
    );
  })
);

// ---------- машины ----------
app.get(
  "/api/cars",
  route(async (_req, res) => {
    res.json(
      await query(`
        SELECT car.car_id, car.vin, car.license_plate, car.brand, car.model, car.year, car.photo_path,
               c.full_name AS client_name,
               (SELECT o.mileage FROM orders o WHERE o.car_id = car.car_id AND o.mileage IS NOT NULL
                ORDER BY o.created_at DESC, o.order_id DESC LIMIT 1) AS mileage
        FROM cars car
        JOIN clients c ON c.client_id = car.client_id
        ORDER BY car.brand, car.model
      `)
    );
  })
);

// ---------- сотрудники ----------
app.get(
  "/api/employees",
  route(async (_req, res) => {
    res.json(
      await query(
        "SELECT employee_id, full_name, position, phone, is_active FROM employees ORDER BY is_active DESC, full_name"
      )
    );
  })
);

// ---------- работы ----------
app.get(
  "/api/work-types",
  route(async (_req, res) => {
    res.json(
      await query(
        "SELECT work_type_id, name, default_price, estimated_duration FROM work_types ORDER BY name"
      )
    );
  })
);

// ---------- запчасти ----------
app.get(
  "/api/parts",
  route(async (_req, res) => {
    res.json(
      await query(
        "SELECT part_id, name, part_type, article, manufacturer, stock_quantity, price FROM parts ORDER BY name"
      )
    );
  })
);

// ---------- заказы ----------
app.get(
  "/api/orders",
  route(async (_req, res) => {
    const rows = await query(`
      SELECT o.order_id, o.created_at,
             car.license_plate, car.brand, car.model, car.photo_path,
             c.full_name AS client_name,
             s.name AS status_name,
             COALESCE((SELECT SUM(ow.quantity * ow.price) FROM order_works ow WHERE ow.order_id=o.order_id), 0)
             + COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id=o.order_id), 0) AS order_total
      FROM orders o
      JOIN cars car ON car.car_id = o.car_id
      JOIN clients c ON c.client_id = car.client_id
      JOIN order_statuses s ON s.status_id = o.status_id
      ORDER BY o.created_at DESC, o.order_id DESC
    `);
    res.json(rows.map((r) => ({ ...r, order_total: Number(r.order_total) })));
  })
);

// ---------- оплаты ----------
app.get(
  "/api/payments",
  route(async (_req, res) => {
    res.json(
      await query(`
        SELECT p.payment_id, p.order_id, p.amount, p.payment_date, p.payment_method,
               car.license_plate, car.brand, car.model, c.full_name AS client_name
        FROM payments p
        JOIN orders o ON o.order_id = p.order_id
        JOIN cars car ON car.car_id = o.car_id
        JOIN clients c ON c.client_id = car.client_id
        ORDER BY p.payment_date DESC, p.payment_id DESC
      `)
    );
  })
);

// ---------- отдаём index.html для всего остального ----------
app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

// ---------- обработчик ошибок ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Ошибка сервера" });
});

app.listen(PORT, async () => {
  console.log(`AutoPro: http://localhost:${PORT}`);
  try {
    const [row] = await query("SELECT VERSION() AS version");
    console.log(`MariaDB connected: ${row.version}`);
  } catch (e) {
    console.error("MariaDB connection failed:", e.message);
  }
});
