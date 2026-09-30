require("dotenv").config();
const express = require("express");
const mariadb = require("mariadb");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

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

const uploadsDir = path.join(__dirname, "uploads", "cars");
fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `car-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.mimetype))
      return cb(new Error("Разрешены только JPG, PNG и WEBP"));
    cb(null, true);
  },
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function cleanRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const obj = { ...row };
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "bigint") obj[key] = Number(obj[key]);
    });
    return obj;
  });
}

async function query(sql, params = []) {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(sql, params);
    return cleanRows(result);
  } finally {
    if (conn) conn.release();
  }
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function text(value) {
  return String(value ?? "").trim();
}
function optionalText(value) {
  const v = text(value);
  return v || null;
}
function requireText(value, label, max = 150) {
  const v = text(value);
  if (!v)
    throw Object.assign(new Error(`${label}: обязательное поле`), {
      statusCode: 400,
    });
  if (v.length > max)
    throw Object.assign(new Error(`${label}: максимум ${max} символов`), {
      statusCode: 400,
    });
  return v;
}
function optionalLimited(value, label, max) {
  const v = optionalText(value);
  if (v && v.length > max)
    throw Object.assign(new Error(`${label}: максимум ${max} символов`), {
      statusCode: 400,
    });
  return v;
}
function positiveId(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0)
    throw Object.assign(new Error(`${label}: некорректное значение`), {
      statusCode: 400,
    });
  return n;
}
function optionalPositiveId(value, label) {
  if (value === undefined || value === null || value === "") return null;
  return positiveId(value, label);
}
function nonNegativeNumber(
  value,
  label,
  { integer = false, required = true } = {}
) {
  if ((value === undefined || value === null || value === "") && !required)
    return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw Object.assign(
      new Error(`${label}: укажи ${integer ? "целое " : ""}число не меньше 0`),
      { statusCode: 400 }
    );
  }
  return n;
}
function positiveNumber(value, label, { integer = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || (integer && !Number.isInteger(n))) {
    throw Object.assign(
      new Error(`${label}: укажи ${integer ? "целое " : ""}число больше 0`),
      { statusCode: 400 }
    );
  }
  return n;
}
function validatePhone(value, required = true) {
  const v = text(value);
  if (!v && !required) return null;
  const digits = v.replace(/\D/g, "");
  if (!/^[+()\-\s\d]+$/.test(v) || digits.length < 7 || digits.length > 15) {
    throw Object.assign(new Error("Телефон: некорректный номер"), {
      statusCode: 400,
    });
  }
  return v;
}
function validateEmail(value) {
  const v = optionalText(value);
  if (!v) return null;
  if (v.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw Object.assign(new Error("Email: некорректный адрес"), {
      statusCode: 400,
    });
  }
  return v;
}
function normalizeVin(value) {
  const v = text(value).toUpperCase();
  if (!v) return null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) {
    throw Object.assign(
      new Error(
        "VIN должен содержать ровно 17 символов: латинские буквы и цифры без I, O и Q"
      ),
      { statusCode: 400 }
    );
  }
  return v;
}
function validateYear(value) {
  if (value === undefined || value === null || value === "") return null;
  const year = Number(value);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(year) || year < 1886 || year > maxYear) {
    throw Object.assign(
      new Error(`Год выпуска должен быть от 1886 до ${maxYear}`),
      { statusCode: 400 }
    );
  }
  return year;
}
function validateDate(value, label) {
  const v = optionalText(value);
  if (!v) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(v) ||
    Number.isNaN(Date.parse(v.replace(" ", "T")))
  ) {
    throw Object.assign(new Error(`${label}: некорректная дата`), {
      statusCode: 400,
    });
  }
  return v;
}

app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    const rows = await query(
      "SELECT VERSION() AS version, DATABASE() AS database_name"
    );
    res.json({ ok: true, ...rows[0] });
  })
);

app.get(
  "/api/statuses",
  asyncRoute(async (_req, res) => {
    res.json(
      await query(
        "SELECT status_id, name FROM order_statuses ORDER BY status_id"
      )
    );
  })
);

app.get(
  "/api/clients",
  asyncRoute(async (req, res) => {
    const search = `%${req.query.q || ""}%`;
    const rows = await query(
      `
    SELECT c.client_id, c.full_name, c.phone, c.email, c.created_at,
           COUNT(car.car_id) AS car_count,
           GROUP_CONCAT(CONCAT(car.brand, ' ', car.model, ' · ', COALESCE(car.license_plate, 'без номера'))
                        ORDER BY car.car_id SEPARATOR ', ') AS cars
    FROM clients c
    LEFT JOIN cars car ON car.client_id = c.client_id
    WHERE c.full_name LIKE ? OR c.phone LIKE ? OR COALESCE(c.email, '') LIKE ?
    GROUP BY c.client_id
    ORDER BY c.full_name
  `,
      [search, search, search]
    );
    res.json(rows);
  })
);

app.post(
  "/api/clients",
  asyncRoute(async (req, res) => {
    const fullName = requireText(req.body.full_name, "ФИО", 150);
    const phone = validatePhone(req.body.phone);
    const email = validateEmail(req.body.email);
    const result = await query(
      "INSERT INTO clients(full_name, phone, email) VALUES (?, ?, ?)",
      [fullName, phone, email]
    );
    res.status(201).json({ client_id: Number(result.insertId) });
  })
);

app.put(
  "/api/clients/:id",
  asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id, "Клиент");
    const fullName = requireText(req.body.full_name, "ФИО", 150);
    const phone = validatePhone(req.body.phone);
    const email = validateEmail(req.body.email);
    await query(
      "UPDATE clients SET full_name=?, phone=?, email=? WHERE client_id=?",
      [fullName, phone, email, id]
    );
    res.json({ ok: true });
  })
);

app.delete(
  "/api/clients/:id",
  asyncRoute(async (req, res) => {
    await query("DELETE FROM clients WHERE client_id=?", [
      positiveId(req.params.id, "Клиент"),
    ]);
    res.json({ ok: true });
  })
);

app.get(
  "/api/cars",
  asyncRoute(async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.q) {
      const q = `%${text(req.query.q)}%`;
      where.push(
        `(COALESCE(car.license_plate,'') LIKE ? OR car.brand LIKE ? OR c.full_name LIKE ?)`
      );
      params.push(q, q, q);
    }
    if (req.query.model) {
      where.push("car.model LIKE ?");
      params.push(`%${text(req.query.model)}%`);
    }
    if (req.query.vin) {
      where.push(`COALESCE(car.vin,'') LIKE ?`);
      params.push(`%${text(req.query.vin).toUpperCase()}%`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await query(
      `
    SELECT car.car_id, car.client_id, car.vin, car.license_plate, car.brand, car.model, car.year, car.photo_path,
           c.full_name AS client_name,
           (SELECT o.mileage FROM orders o WHERE o.car_id = car.car_id AND o.mileage IS NOT NULL
            ORDER BY o.created_at DESC, o.order_id DESC LIMIT 1) AS mileage
    FROM cars car
    JOIN clients c ON c.client_id = car.client_id
    ${clause}
    ORDER BY car.brand, car.model
  `,
      params
    );
    res.json(rows);
  })
);

app.post(
  "/api/cars",
  asyncRoute(async (req, res) => {
    const clientId = positiveId(req.body.client_id, "Владелец");
    const vin = normalizeVin(req.body.vin);
    const licensePlate = optionalLimited(
      req.body.license_plate,
      "Госномер",
      15
    );
    const brand = requireText(req.body.brand, "Марка", 50);
    const model = requireText(req.body.model, "Модель", 50);
    const year = validateYear(req.body.year);
    const result = await query(
      "INSERT INTO cars(client_id, vin, license_plate, brand, model, year) VALUES (?, ?, ?, ?, ?, ?)",
      [clientId, vin, licensePlate, brand, model, year]
    );
    res.status(201).json({ car_id: Number(result.insertId) });
  })
);

app.put(
  "/api/cars/:id",
  asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id, "Автомобиль");
    const clientId = positiveId(req.body.client_id, "Владелец");
    const vin = normalizeVin(req.body.vin);
    const licensePlate = optionalLimited(
      req.body.license_plate,
      "Госномер",
      15
    );
    const brand = requireText(req.body.brand, "Марка", 50);
    const model = requireText(req.body.model, "Модель", 50);
    const year = validateYear(req.body.year);
    await query(
      `UPDATE cars SET client_id=?, vin=?, license_plate=?, brand=?, model=?, year=? WHERE car_id=?`,
      [clientId, vin, licensePlate, brand, model, year, id]
    );
    res.json({ ok: true });
  })
);

app.post(
  "/api/cars/:id/photo",
  upload.single("photo"),
  asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id, "Автомобиль");
    if (!req.file) return res.status(400).json({ error: "Выбери фотографию" });
    const existing = await query("SELECT photo_path FROM cars WHERE car_id=?", [
      id,
    ]);
    if (!existing.length) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Автомобиль не найден" });
    }
    const photoPath = `/uploads/cars/${req.file.filename}`;
    await query("UPDATE cars SET photo_path=? WHERE car_id=?", [photoPath, id]);
    const oldPath = existing[0].photo_path;
    if (oldPath && oldPath.startsWith("/uploads/cars/")) {
      const oldFile = path.join(__dirname, oldPath.replace(/^\//, ""));
      if (oldFile !== req.file.path) fs.unlink(oldFile, () => {});
    }
    res.status(201).json({ photo_path: photoPath });
  })
);

app.get(
  "/api/employees",
  asyncRoute(async (_req, res) => {
    res.json(
      await query(
        "SELECT employee_id, full_name, position, phone, is_active FROM employees ORDER BY is_active DESC, full_name"
      )
    );
  })
);

app.post(
  "/api/employees",
  asyncRoute(async (req, res) => {
    const fullName = requireText(req.body.full_name, "ФИО", 150);
    const position = requireText(req.body.position, "Должность", 50);
    const phone = validatePhone(req.body.phone, false);
    const isActive = String(req.body.is_active ?? "1") === "0" ? 0 : 1;
    const result = await query(
      "INSERT INTO employees(full_name, position, phone, is_active) VALUES (?, ?, ?, ?)",
      [fullName, position, phone, isActive]
    );
    res.status(201).json({ employee_id: Number(result.insertId) });
  })
);

app.put(
  "/api/employees/:id",
  asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id, "Сотрудник");
    const fullName = requireText(req.body.full_name, "ФИО", 150);
    const position = requireText(req.body.position, "Должность", 50);
    const phone = validatePhone(req.body.phone, false);
    const isActive = String(req.body.is_active ?? "1") === "0" ? 0 : 1;
    await query(
      "UPDATE employees SET full_name=?, position=?, phone=?, is_active=? WHERE employee_id=?",
      [fullName, position, phone, isActive, id]
    );
    res.json({ ok: true });
  })
);

app.get(
  "/api/work-types",
  asyncRoute(async (_req, res) => {
    res.json(
      await query(
        "SELECT work_type_id, name, default_price, estimated_duration FROM work_types ORDER BY name"
      )
    );
  })
);

app.post(
  "/api/work-types",
  asyncRoute(async (req, res) => {
    const name = requireText(req.body.name, "Название работы", 150);
    const price = nonNegativeNumber(req.body.default_price, "Базовая цена");
    const duration =
      req.body.estimated_duration === "" || req.body.estimated_duration == null
        ? null
        : positiveNumber(req.body.estimated_duration, "Время выполнения", {
            integer: true,
          });
    const result = await query(
      "INSERT INTO work_types(name, default_price, estimated_duration) VALUES (?, ?, ?)",
      [name, price, duration]
    );
    res.status(201).json({ work_type_id: Number(result.insertId) });
  })
);

app.put(
  "/api/work-types/:id",
  asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id, "Работа");
    const name = requireText(req.body.name, "Название работы", 150);
    const price = nonNegativeNumber(req.body.default_price, "Базовая цена");
    const duration =
      req.body.estimated_duration === "" || req.body.estimated_duration == null
        ? null
        : positiveNumber(req.body.estimated_duration, "Время выполнения", {
            integer: true,
          });
    await query(
      "UPDATE work_types SET name=?, default_price=?, estimated_duration=? WHERE work_type_id=?",
      [name, price, duration, id]
    );
    res.json({ ok: true });
  })
);

app.get(
  "/api/parts",
  asyncRoute(async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.q) {
      const q = `%${text(req.query.q)}%`;
      where.push(
        `(name LIKE ? OR COALESCE(part_type,'') LIKE ? OR COALESCE(article,'') LIKE ? OR COALESCE(manufacturer,'') LIKE ?)`
      );
      params.push(q, q, q, q);
    }
    if (req.query.name) {
      where.push("name LIKE ?");
      params.push(`%${text(req.query.name)}%`);
    }
    if (req.query.type) {
      where.push(`COALESCE(part_type,'') LIKE ?`);
      params.push(`%${text(req.query.type)}%`);
    }
    if (req.query.article) {
      where.push(`COALESCE(article,'') LIKE ?`);
      params.push(`%${text(req.query.article)}%`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    res.json(
      await query(
        `SELECT part_id, name, part_type, article, manufacturer, stock_quantity, price
                        FROM parts ${clause} ORDER BY name`,
        params
      )
    );
  })
);

app.post(
  "/api/parts",
  asyncRoute(async (req, res) => {
    const name = requireText(req.body.name, "Название запчасти", 150);
    const partType = optionalLimited(req.body.part_type, "Тип запчасти", 100);
    const article = optionalLimited(req.body.article, "Артикул", 50);
    const manufacturer = optionalLimited(
      req.body.manufacturer,
      "Производитель",
      100
    );
    const stock = nonNegativeNumber(req.body.stock_quantity ?? 0, "Остаток", {
      integer: true,
    });
    const price = nonNegativeNumber(req.body.price, "Цена");
    const result = await query(
      "INSERT INTO parts(name, part_type, article, manufacturer, stock_quantity, price) VALUES (?, ?, ?, ?, ?, ?)",
      [name, partType, article, manufacturer, stock, price]
    );
    res.status(201).json({ part_id: Number(result.insertId) });
  })
);

app.put(
  "/api/parts/:id",
  asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id, "Запчасть");
    const name = requireText(req.body.name, "Название запчасти", 150);
    const partType = optionalLimited(req.body.part_type, "Тип запчасти", 100);
    const article = optionalLimited(req.body.article, "Артикул", 50);
    const manufacturer = optionalLimited(
      req.body.manufacturer,
      "Производитель",
      100
    );
    const stock = nonNegativeNumber(req.body.stock_quantity ?? 0, "Остаток", {
      integer: true,
    });
    const price = nonNegativeNumber(req.body.price, "Цена");
    await query(
      "UPDATE parts SET name=?, part_type=?, article=?, manufacturer=?, stock_quantity=?, price=? WHERE part_id=?",
      [name, partType, article, manufacturer, stock, price, id]
    );
    res.json({ ok: true });
  })
);

app.get(
  "/api/orders",
  asyncRoute(async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.q) {
      const s = `%${req.query.q}%`;
      where.push(
        `(COALESCE(car.license_plate,'') LIKE ? OR COALESCE(car.vin,'') LIKE ? OR c.full_name LIKE ? OR car.brand LIKE ? OR car.model LIKE ?)`
      );
      params.push(s, s, s, s, s);
    }
    if (req.query.status_id) {
      where.push("o.status_id=?");
      params.push(req.query.status_id);
    }
    if (req.query.employee_id) {
      where.push("o.employee_id=?");
      params.push(req.query.employee_id);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await query(
      `
    SELECT o.order_id, o.car_id, o.employee_id, o.status_id, o.created_at, o.planned_finish_date,
           o.mileage, o.finished_at, o.complaint, o.diagnosis, o.comment,
           car.vin, car.license_plate, car.brand, car.model, car.year, car.photo_path,
           c.client_id, c.full_name AS client_name,
           e.full_name AS employee_name, s.name AS status_name,
           COALESCE((SELECT SUM(ow.quantity * ow.price) FROM order_works ow WHERE ow.order_id=o.order_id), 0) AS works_total,
           COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id=o.order_id), 0) AS parts_total,
           COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.order_id), 0) AS paid_total
    FROM orders o
    JOIN cars car ON car.car_id=o.car_id
    JOIN clients c ON c.client_id=car.client_id
    LEFT JOIN employees e ON e.employee_id=o.employee_id
    JOIN order_statuses s ON s.status_id=o.status_id
    ${clause}
    ORDER BY o.created_at DESC, o.order_id DESC
  `,
      params
    );
    res.json(
      rows.map((r) => ({
        ...r,
        order_total: Number(r.works_total) + Number(r.parts_total),
      }))
    );
  })
);

app.get(
  "/api/orders/:id",
  asyncRoute(async (req, res) => {
    const orders = await query(
      `
    SELECT o.*, car.vin, car.license_plate, car.brand, car.model, car.photo_path, c.full_name AS client_name,
           e.full_name AS employee_name, s.name AS status_name
    FROM orders o JOIN cars car ON car.car_id=o.car_id JOIN clients c ON c.client_id=car.client_id
    LEFT JOIN employees e ON e.employee_id=o.employee_id JOIN order_statuses s ON s.status_id=o.status_id
    WHERE o.order_id=?`,
      [req.params.id]
    );
    if (!orders.length)
      return res.status(404).json({ error: "Заказ не найден" });
    const works = await query(
      `SELECT ow.order_work_id, ow.work_type_id, wt.name, ow.employee_id, e.full_name AS employee_name, ow.quantity, ow.price
                             FROM order_works ow JOIN work_types wt ON wt.work_type_id=ow.work_type_id
                             LEFT JOIN employees e ON e.employee_id=ow.employee_id WHERE ow.order_id=? ORDER BY ow.order_work_id`,
      [req.params.id]
    );
    const parts = await query(
      `SELECT op.order_part_id, op.part_id, p.name, p.article, op.quantity, op.price
                             FROM order_parts op JOIN parts p ON p.part_id=op.part_id WHERE op.order_id=? ORDER BY op.order_part_id`,
      [req.params.id]
    );
    const payments = await query(
      "SELECT payment_id, amount, payment_date, payment_method FROM payments WHERE order_id=? ORDER BY payment_date",
      [req.params.id]
    );
    res.json({ ...orders[0], works, parts, payments });
  })
);

app.post(
  "/api/orders",
  asyncRoute(async (req, res) => {
    const carId = positiveId(req.body.car_id, "Автомобиль");
    const employeeId = optionalPositiveId(
      req.body.employee_id,
      "Ответственный"
    );
    const statusId = positiveId(req.body.status_id || 1, "Статус");
    const plannedFinishDate = validateDate(
      req.body.planned_finish_date,
      "Плановая дата"
    );
    const mileage = nonNegativeNumber(req.body.mileage, "Пробег", {
      integer: true,
      required: false,
    });
    const complaint = optionalLimited(
      req.body.complaint,
      "Жалоба клиента",
      3000
    );
    const diagnosis = optionalLimited(req.body.diagnosis, "Диагноз", 3000);
    const comment = optionalLimited(req.body.comment, "Комментарий", 3000);
    const result = await query(
      `INSERT INTO orders(car_id, employee_id, status_id, planned_finish_date, mileage, complaint, diagnosis, comment)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        carId,
        employeeId,
        statusId,
        plannedFinishDate,
        mileage,
        complaint,
        diagnosis,
        comment,
      ]
    );
    res.status(201).json({ order_id: Number(result.insertId) });
  })
);

app.put(
  "/api/orders/:id",
  asyncRoute(async (req, res) => {
    const id = positiveId(req.params.id, "Заказ");
    const carId = positiveId(req.body.car_id, "Автомобиль");
    const employeeId = optionalPositiveId(
      req.body.employee_id,
      "Ответственный"
    );
    const statusId = positiveId(req.body.status_id, "Статус");
    const plannedFinishDate = validateDate(
      req.body.planned_finish_date,
      "Плановая дата"
    );
    const mileage = nonNegativeNumber(req.body.mileage, "Пробег", {
      integer: true,
      required: false,
    });
    const finishedAt = validateDate(req.body.finished_at, "Дата завершения");
    const complaint = optionalLimited(
      req.body.complaint,
      "Жалоба клиента",
      3000
    );
    const diagnosis = optionalLimited(req.body.diagnosis, "Диагноз", 3000);
    const comment = optionalLimited(req.body.comment, "Комментарий", 3000);
    await query(
      `UPDATE orders SET car_id=?, employee_id=?, status_id=?, planned_finish_date=?, mileage=?, finished_at=?, complaint=?, diagnosis=?, comment=? WHERE order_id=?`,
      [
        carId,
        employeeId,
        statusId,
        plannedFinishDate,
        mileage,
        finishedAt,
        complaint,
        diagnosis,
        comment,
        id,
      ]
    );
    res.json({ ok: true });
  })
);

app.post(
  "/api/orders/:id/works",
  asyncRoute(async (req, res) => {
    const orderId = positiveId(req.params.id, "Заказ");
    const workTypeId = positiveId(req.body.work_type_id, "Работа");
    const employeeId = optionalPositiveId(req.body.employee_id, "Мастер");
    const quantity = positiveNumber(req.body.quantity ?? 1, "Количество");
    const price = nonNegativeNumber(req.body.price, "Цена");
    const result = await query(
      "INSERT INTO order_works(order_id, work_type_id, employee_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
      [orderId, workTypeId, employeeId, quantity, price]
    );
    res.status(201).json({ order_work_id: Number(result.insertId) });
  })
);

app.post(
  "/api/orders/:id/parts",
  asyncRoute(async (req, res) => {
    const orderId = positiveId(req.params.id, "Заказ");
    const partId = positiveId(req.body.part_id, "Запчасть");
    const quantity = positiveNumber(req.body.quantity ?? 1, "Количество", {
      integer: true,
    });
    const price = nonNegativeNumber(req.body.price, "Цена");
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const stock = await conn.query(
        "SELECT stock_quantity FROM parts WHERE part_id=? FOR UPDATE",
        [partId]
      );
      if (!stock.length)
        throw Object.assign(new Error("Запчасть не найдена"), {
          statusCode: 404,
        });
      if (Number(stock[0].stock_quantity) < quantity)
        throw Object.assign(new Error("Недостаточно запчастей на складе"), {
          statusCode: 409,
        });
      const result = await conn.query(
        "INSERT INTO order_parts(order_id, part_id, quantity, price) VALUES (?, ?, ?, ?)",
        [orderId, partId, quantity, price]
      );
      await conn.query(
        "UPDATE parts SET stock_quantity=stock_quantity-? WHERE part_id=?",
        [quantity, partId]
      );
      await conn.commit();
      res.status(201).json({ order_part_id: Number(result.insertId) });
    } catch (e) {
      if (conn) await conn.rollback();
      throw e;
    } finally {
      if (conn) conn.release();
    }
  })
);

app.get(
  "/api/payments",
  asyncRoute(async (_req, res) => {
    res.json(
      await query(`
    SELECT p.payment_id, p.order_id, p.amount, p.payment_date, p.payment_method,
           car.license_plate, car.brand, car.model, c.full_name AS client_name
    FROM payments p JOIN orders o ON o.order_id=p.order_id JOIN cars car ON car.car_id=o.car_id
    JOIN clients c ON c.client_id=car.client_id
    ORDER BY p.payment_date DESC, p.payment_id DESC
  `)
    );
  })
);

app.post(
  "/api/payments",
  asyncRoute(async (req, res) => {
    const orderId = positiveId(req.body.order_id, "Заказ");
    const amount = positiveNumber(req.body.amount, "Сумма оплаты");
    const method = optionalLimited(
      req.body.payment_method,
      "Способ оплаты",
      30
    );
    const result = await query(
      "INSERT INTO payments(order_id, amount, payment_method) VALUES (?, ?, ?)",
      [orderId, amount, method]
    );
    res.status(201).json({ payment_id: Number(result.insertId) });
  })
);

app.get(
  "/api/dashboard",
  asyncRoute(async (_req, res) => {
    const [active] = await query(
      `SELECT COUNT(*) AS value FROM orders o JOIN order_statuses s ON s.status_id=o.status_id WHERE s.name NOT IN ('Выдан','Отменён')`
    );
    const [ready] = await query(
      `SELECT COUNT(*) AS value FROM orders o JOIN order_statuses s ON s.status_id=o.status_id WHERE s.name='Готов'`
    );
    const [cars] = await query("SELECT COUNT(*) AS value FROM cars");
    const [low] = await query(
      "SELECT COUNT(*) AS value FROM parts WHERE stock_quantity < 5"
    );
    const [month] = await query(
      `SELECT COALESCE(SUM(amount),0) AS value FROM payments WHERE YEAR(payment_date)=YEAR(CURRENT_DATE()) AND MONTH(payment_date)=MONTH(CURRENT_DATE())`
    );
    const recent = await query(`
    SELECT o.order_id, car.license_plate, car.brand, car.model, car.photo_path, c.full_name AS client_name, s.name AS status_name,
      COALESCE((SELECT SUM(ow.quantity*ow.price) FROM order_works ow WHERE ow.order_id=o.order_id),0)
      + COALESCE((SELECT SUM(op.quantity*op.price) FROM order_parts op WHERE op.order_id=o.order_id),0) AS order_total
    FROM orders o JOIN cars car ON car.car_id=o.car_id JOIN clients c ON c.client_id=car.client_id
    JOIN order_statuses s ON s.status_id=o.status_id ORDER BY o.created_at DESC LIMIT 5
  `);
    res.json({
      active_orders: Number(active.value),
      ready_orders: Number(ready.value),
      cars: Number(cars.value),
      low_stock: Number(low.value),
      month_revenue: Number(month.value),
      recent,
    });
  })
);

app.get(
  "/api/stats",
  asyncRoute(async (_req, res) => {
    const summary = await query(`
    SELECT
      COALESCE(SUM(p.amount),0) AS revenue,
      COUNT(DISTINCT o.order_id) AS orders_count,
      CASE WHEN COUNT(DISTINCT o.order_id)=0 THEN 0 ELSE COALESCE(SUM(p.amount),0)/COUNT(DISTINCT o.order_id) END AS avg_check
    FROM orders o LEFT JOIN payments p ON p.order_id=o.order_id
    WHERE YEAR(o.created_at)=YEAR(CURRENT_DATE()) AND MONTH(o.created_at)=MONTH(CURRENT_DATE())
  `);
    const months = await query(`
    SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, SUM(amount) AS revenue
    FROM payments WHERE payment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH)
    GROUP BY DATE_FORMAT(payment_date, '%Y-%m') ORDER BY month
  `);
    const works = await query(`
    SELECT wt.name, SUM(ow.quantity) AS count_value
    FROM order_works ow JOIN work_types wt ON wt.work_type_id=ow.work_type_id
    GROUP BY wt.work_type_id, wt.name ORDER BY count_value DESC LIMIT 5
  `);
    res.json({ summary: summary[0], months, popular_works: works });
  })
);

app.get("/{*splat}", (_req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.statusCode || (err.code === "ER_DUP_ENTRY" ? 409 : 500);
  let message = err.message || "Ошибка сервера";
  if (err.code === "ER_ROW_IS_REFERENCED_2")
    message = "Запись нельзя удалить: на неё ссылаются другие данные";
  if (err.code === "ER_DUP_ENTRY")
    message = "Такая запись уже существует (проверь уникальные поля)";
  if (err.code === "LIMIT_FILE_SIZE")
    message = "Фотография должна быть не больше 5 МБ";
  res.status(status).json({ error: message });
});

app.listen(PORT, async () => {
  console.log(`AutoPro: http://localhost:${PORT}`);
  try {
    const rows = await query("SELECT VERSION() AS version");
    console.log(`MariaDB connected: ${rows[0].version}`);
  } catch (e) {
    console.error("MariaDB connection failed:", e.message);
  }
});
