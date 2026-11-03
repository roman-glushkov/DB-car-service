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
    req.path === "/.env"
  ) {
    return res.sendStatus(404);
  }
  next();
});

app.use(express.static(__dirname));

async function query(sql, params = []) {
  const conn = await pool.getConnection();
  try {
    return await conn.query(sql, params);
  } finally {
    conn.release();
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
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

// ---------- Маршруты API ----------

app.get(
  "/api/health",
  route(async (_req, res) => {
    const rows = await query("SELECT DATABASE() AS db, VERSION() AS version");
    res.json({ ok: true, db: rows[0].db, version: rows[0].version });
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
        body.actor_name || "Панель автосервиса",
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
        body.actor_name || "Панель автосервиса",
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

// ---------- Отдача index.html ----------
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---------- Обработка ошибок ----------
app.use((error, _req, res, _next) => {
  console.error(error);
  res
    .status(error.status || 500)
    .json({ error: error.message || "Внутренняя ошибка сервера" });
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
