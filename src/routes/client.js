const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const router = express.Router();
const { pool, query } = require("../config/db");
const { ROOT_DIR } = require("../config/paths");
const { httpError, route, positiveId, cleanText } = require("../utils/validators");
const { requireRole } = require("../middleware/auth");
const carPhotoUpload = require("../middleware/car-upload");
const { addOrderEvent, findLeastLoadedEmployee } = require("../services/order-service");

router.get(
  "/dashboard",
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

router.get(
  "/orders/:id",
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

router.post(
  "/cars",
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

router.post(
  "/cars/:id/photo",
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
        ROOT_DIR,
        req.car.photo_path.replace(/^\//, "")
      );
      fs.promises.unlink(oldFile).catch(() => {});
    }
    res.json({ ok: true, photo_path: photoPath });
  })
);

router.post(
  "/orders",
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

module.exports = router;
