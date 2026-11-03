require("dotenv").config();
const express = require("express");
const mariadb = require("mariadb");
const path = require("path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const multer = require("multer");
const { hashPassword, verifyPassword } = require("./lib/passwords");

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

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const blocked = [
    "/server.js",
    "/package.json",
    "/package-lock.json",
    "/migration.sql",
  ];
  if (
    blocked.includes(req.path) ||
    req.path.startsWith("/database/") ||
    req.path.startsWith("/scripts/") ||
    req.path.startsWith("/lib/") ||
    req.path.startsWith("/data/") ||
    req.path.startsWith("/.git/") ||
    req.path === "/.env" ||
    req.path.startsWith("/.env.")
  ) {
    return res.sendStatus(404);
  }
  next();
});

async function query(sql, params = []) {
  const conn = await pool.getConnection();
  try {
    return await conn.query(sql, params);
  } finally {
    conn.release();
  }
}

function httpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, details);
  return error;
}

function route(handler) {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch(next);
  };
}

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw httpError(400, `Некорректный идентификатор: ${label}`);
  }
  return id;
}

function optionalId(value, label) {
  if (value === null || value === undefined || value === "") return null;
  return positiveId(value, label);
}

function cleanText(value, maxLength = 1000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function parseDate(value, label, nullable = true) {
  if ((value === null || value === undefined || value === "") && nullable)
    return null;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw httpError(400, `Некорректная дата: ${label}`);
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw httpError(400, `Некорректная дата: ${label}`);
  }
  return date;
}

async function addOrderEvent(
  conn,
  orderId,
  actor,
  message,
  eventType = "update"
) {
  await conn.query(
    `INSERT INTO order_events (order_id, actor_name, event_type, message) VALUES (?, ?, ?, ?)`,
    [
      orderId,
      cleanText(actor || "Панель автосервиса", 150),
      eventType,
      cleanText(message, 2000),
    ]
  );
}

async function validateEmployeeSkills(conn, employeeId, workTypeIds) {
  if (!employeeId) return;
  const employeeRows = await conn.query(
    "SELECT employee_id, is_active FROM employees WHERE employee_id = ?",
    [employeeId]
  );
  const employee = employeeRows[0];
  if (!employee || !Number(employee.is_active)) {
    throw httpError(400, "Выбранный сотрудник не найден или неактивен");
  }
  if (!workTypeIds.length) return;
  const placeholders = workTypeIds.map(() => "?").join(",");
  const skillRows = await conn.query(
    `SELECT work_type_id FROM employee_work_types WHERE employee_id = ? AND work_type_id IN (${placeholders})`,
    [employeeId, ...workTypeIds]
  );
  const found = new Set(skillRows.map((row) => Number(row.work_type_id)));
  if (workTypeIds.some((id) => !found.has(id))) {
    throw httpError(
      400,
      "У сотрудника нет необходимых навыков для этого заказа"
    );
  }
}

async function findLeastLoadedEmployee(conn, workTypeIds) {
  if (!workTypeIds.length) return null;
  const placeholders = workTypeIds.map(() => "?").join(",");
  const rows = await conn.query(
    `SELECT e.employee_id, COUNT(DISTINCT ewt.work_type_id) AS matched_skills,
       (SELECT COUNT(*) FROM orders active_order
        JOIN order_statuses active_status ON active_status.status_id = active_order.status_id
        WHERE active_order.employee_id = e.employee_id
          AND active_status.name NOT IN ('Готов', 'Выдан', 'Отменён')) AS active_orders
     FROM employees e
     JOIN employee_work_types ewt ON ewt.employee_id = e.employee_id
     WHERE e.is_active = 1 AND ewt.work_type_id IN (${placeholders})
     GROUP BY e.employee_id
     HAVING COUNT(DISTINCT ewt.work_type_id) = ?
     ORDER BY active_orders ASC, e.employee_id ASC LIMIT 1`,
    [...workTypeIds, workTypeIds.length]
  );
  return rows.length ? Number(rows[0].employee_id) : null;
}

// ---------- Авторизация и роли ----------
const SESSION_COOKIE = "autopro_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET обязателен в production.");
}
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "local-development-secret-change-before-deployment";
const ROLE_PATHS = {
  admin: "/admin",
  client: "/client",
  employee: "/employee",
};

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function signSession(accountId, expiresAt) {
  const payload = Buffer.from(
    JSON.stringify({ accountId, expiresAt })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isSafeInteger(data.accountId) || data.expiresAt <= Date.now())
      return null;
    return data;
  } catch {
    return null;
  }
}

function writeSessionCookie(res, accountId) {
  const token = signSession(accountId, Date.now() + SESSION_TTL_SECONDS * 1000);
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
}

async function getSessionUser(req) {
  const token = verifySession(cookieValue(req, SESSION_COOKIE));
  if (!token) return null;
  const rows = await query(
    `SELECT a.account_id, a.email, a.role, a.client_id, a.employee_id, a.is_active,
            e.is_active AS employee_active,
            COALESCE(c.full_name, e.full_name, a.display_name, 'Администратор') AS name
       FROM user_accounts a
       LEFT JOIN clients c ON c.client_id = a.client_id
       LEFT JOIN employees e ON e.employee_id = a.employee_id
      WHERE a.account_id = ? AND a.is_active = 1`,
    [token.accountId]
  );
  return rows[0] || null;
}

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "Войдите в систему." });
      if (!roles.includes(user.role)) {
        return res
          .status(403)
          .json({ error: "Недостаточно прав для этого раздела." });
      }
      if (user.role === "employee" && !Number(user.employee_active)) {
        return res.status(403).json({ error: "Профиль сотрудника неактивен." });
      }
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requirePageRole(role) {
  return async (req, res, next) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.redirect(`/${role}/login`);
      if (user.role !== role)
        return res.redirect(ROLE_PATHS[user.role] || "/login");
      if (user.role === "employee" && !Number(user.employee_active))
        return res.redirect("/employee/login");
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

const uploadDirectory = path.join(__dirname, "uploads", "cars");
fs.mkdirSync(uploadDirectory, { recursive: true });
const carPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      const extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };
      callback(
        null,
        `${crypto.randomUUID()}${extensions[file.mimetype] || ".img"}`
      );
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    callback(
      allowed.includes(file.mimetype)
        ? null
        : httpError(400, "Разрешены только JPG, PNG и WebP."),
      allowed.includes(file.mimetype)
    );
  },
});

// ---------- Вход, выход и проверка текущей учётной записи ----------
app.post(
  "/api/auth/login",
  route(async (req, res) => {
    const email = cleanText(req.body?.email, 190).toLowerCase();
    const password = String(req.body?.password || "");
    const expectedRole = cleanText(req.body?.role, 20);
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
      throw httpError(400, "Введите корректный email и пароль.");
    }
    const rows = await query(
      `SELECT a.account_id, a.email, a.password_hash, a.role, a.is_active, e.is_active AS employee_active
         FROM user_accounts a LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE a.email = ? LIMIT 1`,
      [email]
    );
    const account = rows[0];
    if (
      !account ||
      !Number(account.is_active) ||
      (account.role === "employee" && !Number(account.employee_active)) ||
      !verifyPassword(password, account.password_hash)
    ) {
      throw httpError(401, "Неверный email или пароль.");
    }
    if (expectedRole && account.role !== expectedRole) {
      throw httpError(
        403,
        "Эта учётная запись предназначена для другого кабинета.",
        {
          redirect: ROLE_PATHS[account.role],
        }
      );
    }
    writeSessionCookie(res, Number(account.account_id));
    const userRows = await query(
      `SELECT a.account_id, a.email, a.role, a.client_id, a.employee_id,
              COALESCE(c.full_name, e.full_name, a.display_name, 'Администратор') AS name
         FROM user_accounts a
         LEFT JOIN clients c ON c.client_id = a.client_id
         LEFT JOIN employees e ON e.employee_id = a.employee_id
        WHERE a.account_id = ?`,
      [account.account_id]
    );
    res.json({
      ok: true,
      user: userRows[0],
      redirect: ROLE_PATHS[account.role],
    });
  })
);

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get(
  "/api/auth/me",
  route(async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) throw httpError(401, "Сессия завершена. Войдите снова.");
    res.json({ user });
  })
);

// ---------- Маршруты API ----------

app.get(
  "/api/health",
  route(async (_req, res) => {
    const rows = await query("SELECT DATABASE() AS db, VERSION() AS version");
    res.json({ ok: true, db: rows[0].db, version: rows[0].version });
  })
);

// ---------- API клиентского кабинета ----------
app.get(
  "/api/client/dashboard",
  requireRole("client"),
  route(async (req, res) => {
    const clientRows = await query(
      "SELECT client_id, full_name, phone, email, created_at FROM clients WHERE client_id = ?",
      [req.user.client_id]
    );
    if (!clientRows.length) throw httpError(404, "Профиль клиента не найден.");
    const [cars, orders, workTypes] = await Promise.all([
      query(
        `SELECT car.*,
                (SELECT o.mileage FROM orders o WHERE o.car_id = car.car_id AND o.mileage IS NOT NULL ORDER BY o.created_at DESC, o.order_id DESC LIMIT 1) AS mileage,
                (SELECT MAX(o.created_at) FROM orders o WHERE o.car_id = car.car_id) AS last_service_at
           FROM cars car WHERE car.client_id = ? ORDER BY car.car_id DESC`,
        [req.user.client_id]
      ),
      query(
        `SELECT o.order_id, o.car_id, o.created_at, o.planned_finish_date, o.mileage, o.finished_at,
                o.complaint, o.diagnosis, o.comment, car.brand, car.model, car.license_plate, car.photo_path,
                e.full_name AS employee_name, s.name AS status_name,
                COALESCE((SELECT SUM(ow.quantity * ow.price) FROM order_works ow WHERE ow.order_id = o.order_id), 0)
                + COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id = o.order_id), 0) AS order_total,
                (SELECT GROUP_CONCAT(wt.name ORDER BY wt.name SEPARATOR ', ')
                   FROM order_works ow JOIN work_types wt ON wt.work_type_id = ow.work_type_id
                  WHERE ow.order_id = o.order_id) AS work_summary
           FROM orders o JOIN cars car ON car.car_id = o.car_id
           JOIN order_statuses s ON s.status_id = o.status_id
           LEFT JOIN employees e ON e.employee_id = o.employee_id
          WHERE car.client_id = ? ORDER BY o.created_at DESC, o.order_id DESC`,
        [req.user.client_id]
      ),
      query(
        "SELECT work_type_id, name, default_price, estimated_duration FROM work_types ORDER BY name"
      ),
    ]);
    const orderIds = orders.map((order) => Number(order.order_id));
    const events = orderIds.length
      ? await query(
          `SELECT event_id, order_id, actor_name, event_type, message, created_at
             FROM order_events WHERE order_id IN (${orderIds
               .map(() => "?")
               .join(",")})
            ORDER BY created_at DESC, event_id DESC`,
          orderIds
        )
      : [];
    res.json({ client: clientRows[0], cars, orders, events, workTypes });
  })
);

app.get(
  "/api/client/orders/:id",
  requireRole("client"),
  route(async (req, res) => {
    const orderId = positiveId(req.params.id, "заказа");
    const orders = await query(
      `SELECT o.*, car.brand, car.model, car.license_plate, car.photo_path,
              c.full_name AS client_name, e.full_name AS employee_name, s.name AS status_name
         FROM orders o JOIN cars car ON car.car_id = o.car_id
         JOIN clients c ON c.client_id = car.client_id
         LEFT JOIN employees e ON e.employee_id = o.employee_id
         JOIN order_statuses s ON s.status_id = o.status_id
        WHERE o.order_id = ? AND c.client_id = ?`,
      [orderId, req.user.client_id]
    );
    if (!orders.length) throw httpError(404, "Заказ не найден.");
    const [works, parts, events, payments] = await Promise.all([
      query(
        "SELECT ow.*, wt.name AS work_name FROM order_works ow JOIN work_types wt ON wt.work_type_id = ow.work_type_id WHERE ow.order_id = ?",
        [orderId]
      ),
      query(
        "SELECT op.*, p.name AS part_name FROM order_parts op JOIN parts p ON p.part_id = op.part_id WHERE op.order_id = ?",
        [orderId]
      ),
      query(
        "SELECT event_id, actor_name, event_type, message, created_at FROM order_events WHERE order_id = ? ORDER BY created_at DESC, event_id DESC",
        [orderId]
      ),
      query(
        "SELECT payment_id, amount, payment_date, payment_method FROM payments WHERE order_id = ? ORDER BY payment_date DESC",
        [orderId]
      ),
    ]);
    res.json({ order: orders[0], works, parts, events, payments });
  })
);

app.post(
  "/api/client/cars",
  requireRole("client"),
  route(async (req, res) => {
    const brand = cleanText(req.body?.brand, 50);
    const model = cleanText(req.body?.model, 50);
    const vin = cleanText(req.body?.vin, 17).toUpperCase() || null;
    const plate = cleanText(req.body?.license_plate, 15).toUpperCase() || null;
    const year =
      req.body?.year === "" || req.body?.year == null
        ? null
        : Number(req.body.year);
    if (!brand || !model)
      throw httpError(400, "Укажите марку и модель автомобиля.");
    if (
      year !== null &&
      (!Number.isInteger(year) || year < 1886 || year > 2100)
    ) {
      throw httpError(400, "Укажите корректный год выпуска.");
    }
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))
      throw httpError(400, "VIN должен содержать 17 допустимых символов.");
    const result = await query(
      "INSERT INTO cars (client_id, vin, license_plate, brand, model, year) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.client_id, vin, plate, brand, model, year]
    );
    res.status(201).json({ ok: true, car_id: Number(result.insertId) });
  })
);

function requireOwnedClientCar(req, res, next) {
  Promise.resolve()
    .then(async () => {
      const carId = positiveId(req.params.id, "автомобиля");
      const rows = await query(
        "SELECT car_id, photo_path FROM cars WHERE car_id = ? AND client_id = ?",
        [carId, req.user.client_id]
      );
      if (!rows.length)
        throw httpError(404, "Автомобиль не найден в вашем профиле.");
      req.car = rows[0];
      next();
    })
    .catch(next);
}

app.post(
  "/api/client/cars/:id/photo",
  requireRole("client"),
  requireOwnedClientCar,
  carPhotoUpload.single("photo"),
  route(async (req, res) => {
    if (!req.file) throw httpError(400, "Выберите изображение.");
    const photoPath = `/uploads/cars/${req.file.filename}`;
    await query(
      "UPDATE cars SET photo_path = ? WHERE car_id = ? AND client_id = ?",
      [photoPath, req.car.car_id, req.user.client_id]
    );
    if (req.car.photo_path?.startsWith("/uploads/cars/")) {
      const oldFile = path.join(
        __dirname,
        req.car.photo_path.replace(/^\//, "")
      );
      fs.promises.unlink(oldFile).catch(() => {});
    }
    res.json({ ok: true, photo_path: photoPath });
  })
);

app.post(
  "/api/client/orders",
  requireRole("client"),
  route(async (req, res) => {
    const carId = positiveId(req.body?.car_id, "автомобиля");
    const complaint = cleanText(req.body?.complaint, 5000);
    if (complaint.length < 5)
      throw httpError(400, "Опишите проблему минимум пятью символами.");
    const rawWorks = Array.isArray(req.body?.works) ? req.body.works : [];
    if (!rawWorks.length) throw httpError(400, "Выберите хотя бы одну работу.");
    const works = rawWorks.map((item) => {
      const workTypeId = positiveId(item.work_type_id, "вида работы");
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100)
        throw httpError(400, "Некорректное количество работ.");
      return { workTypeId, quantity };
    });
    const workTypeIds = [...new Set(works.map((item) => item.workTypeId))];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const carRows = await conn.query(
        "SELECT car_id FROM cars WHERE car_id = ? AND client_id = ? FOR UPDATE",
        [carId, req.user.client_id]
      );
      if (!carRows.length)
        throw httpError(403, "Нельзя оформить заказ на чужой автомобиль.");
      const placeholders = workTypeIds.map(() => "?").join(",");
      const workTypeRows = await conn.query(
        `SELECT work_type_id, default_price FROM work_types WHERE work_type_id IN (${placeholders})`,
        workTypeIds
      );
      if (workTypeRows.length !== workTypeIds.length)
        throw httpError(400, "Один или несколько видов работ не найдены.");
      const workTypeMap = new Map(
        workTypeRows.map((row) => [Number(row.work_type_id), row])
      );
      const statusRows = await conn.query(
        "SELECT status_id FROM order_statuses WHERE name = 'Принят' LIMIT 1"
      );
      if (!statusRows.length)
        throw httpError(500, "В справочнике отсутствует статус «Принят».");
      const employeeId = await findLeastLoadedEmployee(conn, workTypeIds);
      const inserted = await conn.query(
        "INSERT INTO orders (car_id, employee_id, status_id, complaint) VALUES (?, ?, ?, ?)",
        [carId, employeeId, statusRows[0].status_id, complaint]
      );
      const orderId = Number(inserted.insertId);
      for (const item of works) {
        const workType = workTypeMap.get(item.workTypeId);
        await conn.query(
          "INSERT INTO order_works (order_id, work_type_id, employee_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
          [
            orderId,
            item.workTypeId,
            employeeId,
            item.quantity,
            workType.default_price,
          ]
        );
      }
      await addOrderEvent(
        conn,
        orderId,
        req.user.name,
        employeeId
          ? "Клиент создал заказ. Мастер подобран автоматически по навыкам и загрузке."
          : "Клиент создал заказ. Ожидается назначение мастера.",
        "created"
      );
      await conn.commit();
      res
        .status(201)
        .json({ ok: true, order_id: orderId, employee_id: employeeId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  })
);

// ---------- API кабинета сотрудника ----------
app.get(
  "/api/employee/dashboard",
  requireRole("employee"),
  route(async (req, res) => {
    const employeeRows = await query(
      "SELECT employee_id, full_name, position, phone, is_active FROM employees WHERE employee_id = ?",
      [req.user.employee_id]
    );
    if (!employeeRows.length || !Number(employeeRows[0].is_active))
      throw httpError(403, "Профиль сотрудника неактивен.");
    const [orders, statuses] = await Promise.all([
      query(
        `SELECT o.order_id, o.car_id, o.status_id, o.created_at, o.planned_finish_date, o.mileage,
                o.finished_at, o.complaint, o.diagnosis, o.comment, car.brand, car.model,
                car.license_plate, car.photo_path, c.full_name AS client_name, c.phone AS client_phone,
                s.name AS status_name,
                (SELECT GROUP_CONCAT(wt.name ORDER BY wt.name SEPARATOR ', ')
                   FROM order_works ow2 JOIN work_types wt ON wt.work_type_id = ow2.work_type_id
                  WHERE ow2.order_id = o.order_id
                    AND (ow2.employee_id = ? OR (o.employee_id = ? AND ow2.employee_id IS NULL))) AS work_summary,
                COALESCE((SELECT SUM(ow3.quantity * ow3.price) FROM order_works ow3 WHERE ow3.order_id = o.order_id), 0)
                + COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id = o.order_id), 0) AS order_total
           FROM orders o JOIN cars car ON car.car_id = o.car_id
           JOIN clients c ON c.client_id = car.client_id
           JOIN order_statuses s ON s.status_id = o.status_id
          WHERE o.employee_id = ? OR EXISTS (
            SELECT 1 FROM order_works assigned_work
             WHERE assigned_work.order_id = o.order_id AND assigned_work.employee_id = ?
          )
          ORDER BY o.planned_finish_date IS NULL, o.planned_finish_date, o.created_at DESC`,
        [
          req.user.employee_id,
          req.user.employee_id,
          req.user.employee_id,
          req.user.employee_id,
        ]
      ),
      query("SELECT status_id, name FROM order_statuses ORDER BY status_id"),
    ]);
    const orderIds = orders.map((order) => Number(order.order_id));
    const [works, events] = orderIds.length
      ? await Promise.all([
          query(
            `SELECT ow.order_id, ow.order_work_id, ow.quantity, ow.price, wt.name AS work_name
               FROM order_works ow JOIN work_types wt ON wt.work_type_id = ow.work_type_id
               JOIN orders assigned_order ON assigned_order.order_id = ow.order_id
              WHERE ow.order_id IN (${orderIds.map(() => "?").join(",")})
                AND (ow.employee_id = ? OR (assigned_order.employee_id = ? AND ow.employee_id IS NULL))
              ORDER BY ow.order_id, ow.order_work_id`,
            [...orderIds, req.user.employee_id, req.user.employee_id]
          ),
          query(
            `SELECT event_id, order_id, actor_name, event_type, message, created_at
               FROM order_events WHERE order_id IN (${orderIds
                 .map(() => "?")
                 .join(",")})
              ORDER BY created_at DESC, event_id DESC`,
            orderIds
          ),
        ])
      : [[], []];
    res.json({ employee: employeeRows[0], orders, works, events, statuses });
  })
);

app.patch(
  "/api/employee/orders/:id",
  requireRole("employee"),
  route(async (req, res) => {
    const orderId = positiveId(req.params.id, "заказа");
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const rows = await conn.query(
        `SELECT o.*, s.name AS status_name FROM orders o
          JOIN order_statuses s ON s.status_id = o.status_id
         WHERE o.order_id = ? AND (o.employee_id = ? OR EXISTS (
           SELECT 1 FROM order_works ow WHERE ow.order_id = o.order_id AND ow.employee_id = ?
         )) FOR UPDATE`,
        [orderId, req.user.employee_id, req.user.employee_id]
      );
      if (!rows.length)
        throw httpError(404, "Заказ не найден или не назначен вам.");
      const current = rows[0];
      const updates = {};
      let nextStatusName = current.status_name;
      if (req.body?.status_id !== undefined) {
        const statusId = positiveId(req.body.status_id, "статуса");
        const statusRows = await conn.query(
          "SELECT status_id, name FROM order_statuses WHERE status_id = ?",
          [statusId]
        );
        if (!statusRows.length) throw httpError(400, "Статус не найден.");
        const allowed = [
          "Диагностика",
          "В работе",
          "Ожидание запчастей",
          "Готов",
        ];
        if (
          statusRows[0].name !== current.status_name &&
          !allowed.includes(statusRows[0].name)
        ) {
          throw httpError(403, "Сотруднику нельзя установить этот статус.");
        }
        updates.status_id = statusId;
        nextStatusName = statusRows[0].name;
      }
      if (req.body?.diagnosis !== undefined)
        updates.diagnosis = cleanText(req.body.diagnosis, 10000) || null;
      if (req.body?.comment !== undefined)
        updates.comment = cleanText(req.body.comment, 10000) || null;
      if (!Object.keys(updates).length)
        throw httpError(400, "Нет данных для обновления.");
      const fields = Object.keys(updates);
      const values = fields.map((field) => updates[field]);
      const finishSql =
        nextStatusName === "Готов"
          ? ", finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP)"
          : "";
      await conn.query(
        `UPDATE orders SET ${fields
          .map((field) => `\`${field}\` = ?`)
          .join(", ")}${finishSql} WHERE order_id = ?`,
        [...values, orderId]
      );
      const changes = [];
      if (
        updates.status_id !== undefined &&
        nextStatusName !== current.status_name
      )
        changes.push(`Статус: «${current.status_name}» → «${nextStatusName}»`);
      if (updates.diagnosis !== undefined)
        changes.push("Обновлена диагностика");
      if (updates.comment !== undefined)
        changes.push("Обновлен комментарий мастера");
      await addOrderEvent(
        conn,
        orderId,
        req.user.name,
        changes.join(". "),
        "employee_update"
      );
      await conn.commit();
      res.json({ ok: true, order_id: orderId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  })
);

// Публичный административный namespace: /api/admin/*.
// Переписываем URL до маршрутизации, сохраняя прежние обработчики админки.
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/admin/")) {
    req.url = req.url.replace(/^\/api\/admin(?=\/|$)/, "/api");
  }
  next();
});

// Все legacy API-методы также доступны только администратору.
app.use("/api", requireRole("admin"));

app.get(
  "/api/accounts",
  route(async (_req, res) => {
    const rows = await query(
      `SELECT a.account_id, a.email, a.role, a.is_active, a.created_at, a.client_id, a.employee_id,
              COALESCE(c.full_name, e.full_name, a.display_name, 'Администратор') AS profile_name
         FROM user_accounts a
         LEFT JOIN clients c ON c.client_id = a.client_id
         LEFT JOIN employees e ON e.employee_id = a.employee_id
        ORDER BY a.created_at DESC, a.account_id DESC`
    );
    res.json(rows);
  })
);

app.get(
  "/api/account-options",
  route(async (_req, res) => {
    const [clients, employees] = await Promise.all([
      query(
        `SELECT c.client_id, c.full_name, c.email, c.phone
           FROM clients c LEFT JOIN user_accounts a ON a.client_id = c.client_id
          WHERE a.account_id IS NULL ORDER BY c.full_name`
      ),
      query(
        `SELECT e.employee_id, e.full_name, e.position, e.is_active
           FROM employees e LEFT JOIN user_accounts a ON a.employee_id = e.employee_id
          WHERE a.account_id IS NULL AND e.is_active = 1 ORDER BY e.full_name`
      ),
    ]);
    res.json({ clients, employees });
  })
);

app.post(
  "/api/accounts",
  route(async (req, res) => {
    const email = cleanText(req.body?.email, 190).toLowerCase();
    const password = String(req.body?.password || "");
    const role = cleanText(req.body?.role, 20);
    const profileId = optionalId(req.body?.profile_id, "профиля");
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw httpError(400, "Укажите корректный email.");
    if (password.length < 10)
      throw httpError(400, "Пароль должен содержать минимум 10 символов.");
    if (!["admin", "client", "employee"].includes(role))
      throw httpError(400, "Неизвестная роль.");
    let clientId = null;
    let employeeId = null;
    let displayName = cleanText(req.body?.display_name, 150) || null;
    if (role === "client") {
      if (!profileId) throw httpError(400, "Выберите клиента.");
      const rows = await query(
        "SELECT client_id, full_name FROM clients WHERE client_id = ?",
        [profileId]
      );
      if (!rows.length) throw httpError(404, "Клиент не найден.");
      clientId = profileId;
      displayName = rows[0].full_name;
    } else if (role === "employee") {
      if (!profileId) throw httpError(400, "Выберите сотрудника.");
      const rows = await query(
        "SELECT employee_id, full_name FROM employees WHERE employee_id = ?",
        [profileId]
      );
      if (!rows.length) throw httpError(404, "Сотрудник не найден.");
      employeeId = profileId;
      displayName = rows[0].full_name;
    } else if (profileId) {
      throw httpError(
        400,
        "Для администратора не выбирается профиль клиента или сотрудника."
      );
    }
    const result = await query(
      "INSERT INTO user_accounts (email, password_hash, role, display_name, client_id, employee_id) VALUES (?, ?, ?, ?, ?, ?)",
      [email, hashPassword(password), role, displayName, clientId, employeeId]
    );
    res.status(201).json({ ok: true, account_id: Number(result.insertId) });
  })
);

app.patch(
  "/api/accounts/:id",
  route(async (req, res) => {
    const accountId = positiveId(req.params.id, "учётной записи");
    const existing = await query(
      "SELECT account_id FROM user_accounts WHERE account_id = ?",
      [accountId]
    );
    if (!existing.length) throw httpError(404, "Учётная запись не найдена.");
    const updates = {};
    if (req.body?.is_active !== undefined) {
      const active = Number(req.body.is_active);
      if (![0, 1].includes(active))
        throw httpError(400, "Некорректный статус учётной записи.");
      if (accountId === req.user.account_id && active === 0)
        throw httpError(400, "Нельзя отключить собственную учётную запись.");
      updates.is_active = active;
    }
    if (req.body?.password !== undefined && String(req.body.password).length) {
      const password = String(req.body.password);
      if (password.length < 10)
        throw httpError(
          400,
          "Новый пароль должен содержать минимум 10 символов."
        );
      updates.password_hash = hashPassword(password);
    }
    if (!Object.keys(updates).length) throw httpError(400, "Нет изменений.");
    const fields = Object.keys(updates);
    await query(
      `UPDATE user_accounts SET ${fields
        .map((field) => `\`${field}\` = ?`)
        .join(", ")} WHERE account_id = ?`,
      [...fields.map((field) => updates[field]), accountId]
    );
    res.json({ ok: true });
  })
);

app.get(
  "/api/order-options",
  route(async (_req, res) => {
    const [cars, statuses, employees, workTypes] = await Promise.all([
      query(
        `SELECT car.car_id, car.brand, car.model, car.license_plate, c.client_id, c.full_name AS client_name FROM cars car JOIN clients c ON c.client_id = car.client_id ORDER BY car.brand, car.model`
      ),
      query(`SELECT status_id, name FROM order_statuses ORDER BY status_id`),
      query(`SELECT e.employee_id, e.full_name, e.position, e.is_active,
            (SELECT GROUP_CONCAT(w.name ORDER BY w.name SEPARATOR ', ') FROM employee_work_types ewt JOIN work_types w ON w.work_type_id = ewt.work_type_id WHERE ewt.employee_id = e.employee_id) AS skills,
            (SELECT GROUP_CONCAT(ewt.work_type_id ORDER BY ewt.work_type_id SEPARATOR ',') FROM employee_work_types ewt WHERE ewt.employee_id = e.employee_id) AS skill_ids
           FROM employees e ORDER BY e.is_active DESC, e.full_name`),
      query(
        `SELECT work_type_id, name, default_price, estimated_duration FROM work_types ORDER BY name`
      ),
    ]);
    res.json({ cars, statuses, employees, workTypes });
  })
);

app.get(
  "/api/orders",
  route(async (_req, res) => {
    const rows = await query(`
    SELECT o.order_id, o.car_id, o.employee_id, o.status_id, o.created_at, o.planned_finish_date, o.mileage, o.finished_at, o.complaint, o.diagnosis, o.comment,
           car.license_plate, car.brand, car.model, car.photo_path, c.full_name AS client_name, e.full_name AS employee_name, s.name AS status_name,
           COALESCE((SELECT SUM(ow.quantity * ow.price) FROM order_works ow WHERE ow.order_id = o.order_id), 0) + COALESCE((SELECT SUM(op.quantity * op.price) FROM order_parts op WHERE op.order_id = o.order_id), 0) AS order_total
    FROM orders o
    JOIN cars car ON car.car_id = o.car_id
    JOIN clients c ON c.client_id = car.client_id
    LEFT JOIN employees e ON e.employee_id = o.employee_id
    JOIN order_statuses s ON s.status_id = o.status_id
    ORDER BY o.created_at DESC, o.order_id DESC
  `);
    res.json(
      rows.map((row) => ({ ...row, order_total: Number(row.order_total) }))
    );
  })
);

app.get(
  "/api/orders/:id",
  route(async (req, res) => {
    const id = positiveId(req.params.id, "order_id");
    const [orders, works, parts, events] = await Promise.all([
      query(
        `SELECT o.*, car.brand, car.model, car.license_plate, c.full_name AS client_name, e.full_name AS employee_name, s.name AS status_name
           FROM orders o JOIN cars car ON car.car_id = o.car_id JOIN clients c ON c.client_id = car.client_id
           LEFT JOIN employees e ON e.employee_id = o.employee_id JOIN order_statuses s ON s.status_id = o.status_id WHERE o.order_id = ?`,
        [id]
      ),
      query(
        `SELECT ow.*, wt.name AS work_name FROM order_works ow JOIN work_types wt ON wt.work_type_id = ow.work_type_id WHERE ow.order_id = ?`,
        [id]
      ),
      query(
        `SELECT op.*, p.name AS part_name FROM order_parts op JOIN parts p ON p.part_id = op.part_id WHERE op.order_id = ?`,
        [id]
      ),
      query(
        `SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC, event_id DESC`,
        [id]
      ),
    ]);
    if (!orders.length) throw httpError(404, "Заказ не найден");
    res.json({ order: orders[0], works, parts, events });
  })
);

app.post(
  "/api/orders",
  route(async (req, res) => {
    const body = req.body || {};
    const carId = positiveId(body.car_id, "автомобиля");
    const complaint = cleanText(body.complaint, 5000);
    if (complaint.length < 5)
      throw httpError(400, "Опишите проблему минимум пятью символами");
    const rawWorks = Array.isArray(body.works) ? body.works : [];
    if (!rawWorks.length)
      throw httpError(400, "Добавьте хотя бы одну работу в заказ");
    const works = rawWorks.map((item) => {
      const workTypeId = positiveId(item.work_type_id, "вида работы");
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100)
        throw httpError(400, "Некорректное количество");
      return { workTypeId, quantity };
    });
    const workTypeIds = [...new Set(works.map((item) => item.workTypeId))];
    const requestedEmployeeId = optionalId(body.employee_id, "сотрудника");
    const mileage =
      body.mileage === "" || body.mileage == null ? null : Number(body.mileage);
    if (mileage !== null && (!Number.isSafeInteger(mileage) || mileage < 0))
      throw httpError(400, "Пробег должен быть неотрицательным");
    const plannedFinishDate = parseDate(
      body.planned_finish_date,
      "плановой даты"
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const carRows = await conn.query(
        "SELECT car_id FROM cars WHERE car_id = ?",
        [carId]
      );
      if (!carRows.length) throw httpError(404, "Автомобиль не найден");
      const placeholders = workTypeIds.map(() => "?").join(",");
      const workTypeRows = await conn.query(
        `SELECT work_type_id, default_price FROM work_types WHERE work_type_id IN (${placeholders})`,
        workTypeIds
      );
      if (workTypeRows.length !== workTypeIds.length)
        throw httpError(400, "Один или несколько видов работ не найдены");
      const workTypeMap = new Map(
        workTypeRows.map((row) => [Number(row.work_type_id), row])
      );
      const statusRows = await conn.query(
        "SELECT status_id FROM order_statuses WHERE name = ? LIMIT 1",
        ["Принят"]
      );
      if (!statusRows.length) throw httpError(400, "Нет статуса «Принят»");
      const employeeId =
        requestedEmployeeId ||
        (await findLeastLoadedEmployee(conn, workTypeIds));
      await validateEmployeeSkills(conn, employeeId, workTypeIds);
      const insertResult = await conn.query(
        "INSERT INTO orders (car_id, employee_id, status_id, planned_finish_date, mileage, complaint) VALUES (?, ?, ?, ?, ?, ?)",
        [
          carId,
          employeeId,
          statusRows[0].status_id,
          plannedFinishDate,
          mileage,
          complaint,
        ]
      );
      const orderId = Number(insertResult.insertId);
      for (const item of works) {
        const workType = workTypeMap.get(item.workTypeId);
        await conn.query(
          "INSERT INTO order_works (order_id, work_type_id, employee_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
          [
            orderId,
            item.workTypeId,
            employeeId,
            item.quantity,
            workType.default_price,
          ]
        );
      }
      await addOrderEvent(
        conn,
        orderId,
        req.user.name,
        employeeId
          ? `Заказ создан. Назначен сотрудник #${employeeId}.`
          : "Заказ создан.",
        "created"
      );
      await conn.commit();
      res
        .status(201)
        .json({ ok: true, order_id: orderId, employee_id: employeeId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  })
);

app.patch(
  "/api/orders/:id",
  route(async (req, res) => {
    const orderId = positiveId(req.params.id, "заказа");
    const body = req.body || {};
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const orderRows = await conn.query(
        "SELECT o.*, s.name AS status_name FROM orders o JOIN order_statuses s ON s.status_id = o.status_id WHERE o.order_id = ? FOR UPDATE",
        [orderId]
      );
      if (!orderRows.length) throw httpError(404, "Заказ не найден");
      const current = orderRows[0];
      const updates = {};
      if (body.status_id !== undefined) {
        const statusId = positiveId(body.status_id, "статуса");
        const statusRows = await conn.query(
          "SELECT status_id, name FROM order_statuses WHERE status_id = ?",
          [statusId]
        );
        if (!statusRows.length) throw httpError(400, "Статус не существует");
        updates.status_id = statusId;
      }
      if (body.employee_id !== undefined) {
        updates.employee_id = optionalId(body.employee_id, "сотрудника");
        const lineRows = await conn.query(
          "SELECT DISTINCT work_type_id FROM order_works WHERE order_id = ?",
          [orderId]
        );
        await validateEmployeeSkills(
          conn,
          updates.employee_id,
          lineRows.map((row) => Number(row.work_type_id))
        );
      }
      if (body.complaint !== undefined) {
        const value = cleanText(body.complaint, 5000);
        if (value.length < 5)
          throw httpError(400, "Описание проблемы слишком короткое");
        updates.complaint = value;
      }
      if (body.diagnosis !== undefined)
        updates.diagnosis = cleanText(body.diagnosis, 10000) || null;
      if (body.comment !== undefined)
        updates.comment = cleanText(body.comment, 10000) || null;
      if (body.planned_finish_date !== undefined)
        updates.planned_finish_date = parseDate(
          body.planned_finish_date,
          "плановой даты"
        );
      if (body.mileage !== undefined) {
        const value =
          body.mileage === "" || body.mileage === null
            ? null
            : Number(body.mileage);
        if (value !== null && (!Number.isSafeInteger(value) || value < 0))
          throw httpError(400, "Некорректный пробег");
        updates.mileage = value;
      }
      if (!Object.keys(updates).length)
        throw httpError(400, "Нет полей для изменения");
      const fields = Object.keys(updates);
      const values = fields.map((field) => updates[field]);
      let newStatusName = current.status_name;
      if (updates.status_id !== undefined) {
        const rows = await conn.query(
          "SELECT name FROM order_statuses WHERE status_id = ?",
          [updates.status_id]
        );
        newStatusName = rows[0].name;
      }
      if (["Готов", "Выдан"].includes(newStatusName)) {
        await conn.query(
          `UPDATE orders SET ${fields
            .map((field) => `\`${field}\` = ?`)
            .join(
              ", "
            )}, finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP) WHERE order_id = ?`,
          [...values, orderId]
        );
      } else {
        await conn.query(
          `UPDATE orders SET ${fields
            .map((field) => `\`${field}\` = ?`)
            .join(", ")} WHERE order_id = ?`,
          [...values, orderId]
        );
      }
      if (updates.employee_id !== undefined) {
        await conn.query(
          "UPDATE order_works SET employee_id = ? WHERE order_id = ?",
          [updates.employee_id, orderId]
        );
      }
      const messages = [];
      if (
        updates.status_id !== undefined &&
        newStatusName !== current.status_name
      )
        messages.push(`Статус: «${current.status_name}» → «${newStatusName}»`);
      if (
        updates.employee_id !== undefined &&
        updates.employee_id !== current.employee_id
      )
        messages.push(
          updates.employee_id
            ? `Назначен сотрудник #${updates.employee_id}`
            : "Сотрудник снят"
        );
      if (updates.diagnosis !== undefined) messages.push("Диагностика");
      if (updates.complaint !== undefined) messages.push("Описание проблемы");
      if (updates.planned_finish_date !== undefined)
        messages.push("Плановая дата");
      if (updates.mileage !== undefined) messages.push("Пробег");
      if (updates.comment !== undefined) messages.push("Комментарий");
      await addOrderEvent(
        conn,
        orderId,
        req.user.name,
        messages.join(". ") || "Заказ обновлён",
        "updated"
      );
      await conn.commit();
      res.json({ ok: true, order_id: orderId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  })
);

async function saveEmployee(req, res, employeeId = null) {
  const body = req.body || {};
  const fullName = cleanText(body.full_name, 150);
  const position = cleanText(body.position, 50);
  const phone = cleanText(body.phone, 20) || null;
  const isActive =
    body.is_active === false || Number(body.is_active) === 0 ? 0 : 1;
  const skillIds = [
    ...new Set(
      (Array.isArray(body.work_type_ids) ? body.work_type_ids : []).map(
        (value) => positiveId(value, "навыка")
      )
    ),
  ];
  if (!fullName || !position) throw httpError(400, "Укажите ФИО и должность");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (skillIds.length) {
      const placeholders = skillIds.map(() => "?").join(",");
      const valid = await conn.query(
        `SELECT work_type_id FROM work_types WHERE work_type_id IN (${placeholders})`,
        skillIds
      );
      if (valid.length !== skillIds.length)
        throw httpError(400, "Работы не существуют");
    }
    let id = employeeId;
    if (id) {
      const existing = await conn.query(
        "SELECT employee_id FROM employees WHERE employee_id = ?",
        [id]
      );
      if (!existing.length) throw httpError(404, "Сотрудник не найден");
      await conn.query(
        "UPDATE employees SET full_name = ?, position = ?, phone = ?, is_active = ? WHERE employee_id = ?",
        [fullName, position, phone, isActive, id]
      );
    } else {
      const result = await conn.query(
        "INSERT INTO employees (full_name, position, phone, is_active) VALUES (?, ?, ?, ?)",
        [fullName, position, phone, isActive]
      );
      id = Number(result.insertId);
    }
    await conn.query("DELETE FROM employee_work_types WHERE employee_id = ?", [
      id,
    ]);
    for (const skillId of skillIds) {
      await conn.query(
        "INSERT INTO employee_work_types (employee_id, work_type_id) VALUES (?, ?)",
        [id, skillId]
      );
    }
    await conn.commit();
    res.status(employeeId ? 200 : 201).json({ ok: true, employee_id: id });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

app.get(
  "/api/employees",
  route(async (_req, res) => {
    res.json(
      await query(`
    SELECT e.employee_id, e.full_name, e.position, e.phone, e.is_active,
           (SELECT GROUP_CONCAT(w.name ORDER BY w.name SEPARATOR ', ') FROM employee_work_types ewt JOIN work_types w ON w.work_type_id = ewt.work_type_id WHERE ewt.employee_id = e.employee_id) AS skills,
           (SELECT GROUP_CONCAT(ewt.work_type_id ORDER BY ewt.work_type_id SEPARATOR ',') FROM employee_work_types ewt WHERE ewt.employee_id = e.employee_id) AS skill_ids
    FROM employees e ORDER BY e.is_active DESC, e.full_name
  `)
    );
  })
);

app.post(
  "/api/employees",
  route((req, res) => saveEmployee(req, res))
);
app.put(
  "/api/employees/:id",
  route((req, res) =>
    saveEmployee(req, res, positiveId(req.params.id, "сотрудника"))
  )
);

app.post(
  "/api/cars/:id/photo",
  carPhotoUpload.single("photo"),
  route(async (req, res) => {
    const carId = positiveId(req.params.id, "автомобиля");
    if (!req.file) throw httpError(400, "Выберите изображение.");
    const rows = await query(
      "SELECT car_id, photo_path FROM cars WHERE car_id = ?",
      [carId]
    );
    if (!rows.length) throw httpError(404, "Автомобиль не найден.");
    const photoPath = `/uploads/cars/${req.file.filename}`;
    await query("UPDATE cars SET photo_path = ? WHERE car_id = ?", [
      photoPath,
      carId,
    ]);
    if (rows[0].photo_path?.startsWith("/uploads/cars/")) {
      const oldFile = path.join(
        __dirname,
        rows[0].photo_path.replace(/^\//, "")
      );
      fs.promises.unlink(oldFile).catch(() => {});
    }
    res.json({ ok: true, photo_path: photoPath });
  })
);

app.get(
  "/api/clients",
  route(async (_req, res) => {
    res.json(
      await query(
        `SELECT c.client_id, c.full_name, c.phone, c.email, GROUP_CONCAT(CONCAT(car.brand, ' ', car.model, ' · ', COALESCE(car.license_plate, 'без номера')) ORDER BY car.car_id SEPARATOR ', ') AS cars FROM clients c LEFT JOIN cars car ON car.client_id = c.client_id GROUP BY c.client_id ORDER BY c.full_name`
      )
    );
  })
);

app.get(
  "/api/cars",
  route(async (_req, res) => {
    res.json(
      await query(`
    SELECT car.car_id, car.vin, car.license_plate, car.brand, car.model, car.year, car.photo_path, c.full_name AS client_name,
           (SELECT o.mileage FROM orders o WHERE o.car_id = car.car_id AND o.mileage IS NOT NULL ORDER BY o.created_at DESC, o.order_id DESC LIMIT 1) AS mileage
    FROM cars car JOIN clients c ON c.client_id = car.client_id ORDER BY car.brand, car.model
  `)
    );
  })
);

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

app.get(
  "/api/payments",
  route(async (_req, res) => {
    res.json(
      await query(`
    SELECT p.payment_id, p.order_id, p.amount, p.payment_date, p.payment_method, car.license_plate, car.brand, car.model, c.full_name AS client_name
    FROM payments p JOIN orders o ON o.order_id = p.order_id JOIN cars car ON car.car_id = o.car_id JOIN clients c ON c.client_id = car.client_id
    ORDER BY p.payment_date DESC, p.payment_id DESC
  `)
    );
  })
);

// ---------- Страницы трёх кабинетов ----------
app.get("/", (_req, res) => res.redirect("/login"));
app.get("/login", (_req, res) =>
  res.sendFile(path.join(__dirname, "login.html"))
);
app.get("/login.html", (_req, res) =>
  res.sendFile(path.join(__dirname, "login.html"))
);
app.get("/admin/login", (_req, res) =>
  res.sendFile(path.join(__dirname, "login.html"))
);
app.get("/client/login", (_req, res) =>
  res.sendFile(path.join(__dirname, "login.html"))
);
app.get("/employee/login", (_req, res) =>
  res.sendFile(path.join(__dirname, "login.html"))
);
app.get("/admin", requirePageRole("admin"), (_req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);
app.get("/index.html", requirePageRole("admin"), (_req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);
app.get("/client", requirePageRole("client"), (_req, res) =>
  res.sendFile(path.join(__dirname, "client.html"))
);
app.get("/client.html", requirePageRole("client"), (_req, res) =>
  res.sendFile(path.join(__dirname, "client.html"))
);
app.get("/employee", requirePageRole("employee"), (_req, res) =>
  res.sendFile(path.join(__dirname, "employee.html"))
);
app.get("/employee.html", requirePageRole("employee"), (_req, res) =>
  res.sendFile(path.join(__dirname, "employee.html"))
);

app.use(express.static(__dirname));

app.get("/{*splat}", (req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "API-маршрут не найден." });
  res.status(404).send("Страница не найдена.");
});

// ---------- Обработка ошибок ----------
app.use((error, _req, res, _next) => {
  console.error(error);
  const status =
    error.code === "ER_DUP_ENTRY"
      ? 409
      : error.status || (error instanceof multer.MulterError ? 400 : 500);
  res.status(status).json({
    error:
      error.code === "ER_DUP_ENTRY"
        ? "Email, VIN или госномер уже используется. Проверьте введённые данные."
        : error.message || "Внутренняя ошибка сервера",
    ...(error.redirect ? { redirect: error.redirect } : {}),
  });
});

// ---------- Запуск сервера ----------
app.listen(PORT, async () => {
  console.log(`AutoPro: http://localhost:${PORT}`);
  try {
    const rows = await query("SELECT DATABASE() AS db, VERSION() AS version");
    console.log(`MariaDB connected: ${rows[0].db} (${rows[0].version})`);
  } catch (error) {
    console.error("MariaDB connection failed:", error.message);
  }
});
